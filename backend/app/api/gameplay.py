import json
import time
import asyncio
from fastapi import WebSocket, WebSocketDisconnect, Query
from app.db.redis import redis_client
from app.repositories.user_repo import UserRepository
from app.services.game_utils import to_str
from app.services.game_redis import get_user_from_token
from app.services.game_generator import generate_fair_game
from app.services.game_lifecycle import wait_for_match_ready, finalize_match
import logging

logger = logging.getLogger("uvicorn.error")

async def game_websocket_endpoint(websocket: WebSocket, match_id: str, token: str = Query(...)):
    await websocket.accept()
    
    # 1. Authenticate user
    user_id = await get_user_from_token(token)
    if not user_id: 
        await websocket.close()
        return

    u_id_str = str(user_id)
    match_key = f"match:live:{match_id}"
    user_repo = UserRepository()
    GRACE_PERIOD_SECONDS = 15 
    listen_task = None

    try:
        # 🚀 2. RECONNECTION KILL-SWITCH
        # Check if this match is already finished before doing anything else
        raw_data = await asyncio.to_thread(redis_client.hgetall, match_key)
        match_data = {to_str(k): to_str(v) for k, v in raw_data.items()}

        if match_data.get("finalized") == "true":
            final_res = match_data.get(f"final_result:{u_id_str}")
            if final_res:
                logger.info(f"User {u_id_str} reconnected to a finished match. Sending result.")
                await websocket.send_json({"type": "RESULT", **json.loads(final_res)})
                await websocket.close()
                return

        # --- Standard Match Logic ---
        user = await user_repo.get_by_id(u_id_str)
        username = user.get("username", "Unknown")
        
        # Metadata Setup
        pipe = redis_client.pipeline()
        pipe.hset(match_key, f"name:{u_id_str}", username)
        pipe.hset(match_key, f"status:{u_id_str}", "PLAYING")
        pipe.hset(match_key, f"last_seen:{u_id_str}", time.time())
        pipe.hsetnx(match_key, f"score:{u_id_str}", "0")
        pipe.hincrby(match_key, "active_conns", 1)
        await asyncio.to_thread(pipe.exec)

        # Host initialization
        is_host = await asyncio.to_thread(redis_client.set, f"init:{match_id}", "true", nx=True, ex=30)
        
        if is_host:
            game_rounds = generate_fair_game(20)
            await asyncio.to_thread(redis_client.hset, match_key, "rounds", json.dumps(game_rounds))
            await asyncio.to_thread(redis_client.expire, match_key, 600)
            
            signal_data = {
                "rounds": game_rounds,
                "op_name": username,
                "op_id": u_id_str
            }
            await asyncio.to_thread(redis_client.publish, f"match_init:{match_id}", json.dumps(signal_data))
        
        # Wait for both players to be ready
        # --- Standard Match Logic ---
        # ... (Metadata setup and Host init code stays same) ...

        # 🚀 3. THE ARENA INITIALIZATION
        try:
            # THIS LINE WAS MISSING: It actually triggers the wait
            rounds_data, opponent_name, opponent_id = await wait_for_match_ready(match_id, u_id_str)
        except Exception as e:
            if "timed out" in str(e).lower():
                logger.error(f"Match {match_id} timed out. Refunding user {u_id_str}.")
                
                # 1. Send the cancellation message to the frontend
                await websocket.send_json({
                    "type": "MATCH_CANCELLED",
                    "reason": "Opponent failed to connect. Your entry fee has been refunded."
                })
                
                # 2. 🔥 TRIGGER REFUND LOGIC
                from app.services.wallet_service import WalletService
                wallet_service = WalletService()
                
                # Get the bet amount from Redis match metadata
                bet_raw = await asyncio.to_thread(redis_client.hget, match_key, "bet_amount")
                # Fallback to 50.0 if not found
                bet_amount = float(to_str(bet_raw)) if bet_raw else 50.0

                # Call the method from your WalletService class
                await wallet_service.refund_user(u_id_str, bet_amount)
                
                await websocket.close()
                return
            raise e # If it's not a timeout, let the main error handler catch it

        # 4. START THE GAME
        await websocket.send_json({
            "type": "GAME_START",
            "rounds": rounds_data,
            "opponent_name": opponent_name,
            "match_id": match_id
        })

        # --- 2. CLIENT LISTENER ... (rest of the file remains the same)

        await websocket.send_json({
            "type": "GAME_START",
            "rounds": rounds_data,
            "opponent_name": opponent_name,
            "match_id": match_id
        })

        # --- 2. CLIENT LISTENER (Incoming Scores) ---
        async def listen_to_client():
            try:
                while True:
                    data = await websocket.receive_json()
                    
                    # Connection Heartbeat
                    if data.get("type") == "PING":
                        await websocket.send_json({"type": "PONG"})
                        continue

                    if data.get("type") == "SCORE_UPDATE":
                        new_score = int(data.get("score", 0))
                        await asyncio.to_thread(redis_client.hset, match_key, f"score:{u_id_str}", new_score)
                        await asyncio.to_thread(redis_client.hset, match_key, f"last_seen:{u_id_str}", time.time())

                    if data.get("type") == "GAME_OVER":
                        await asyncio.to_thread(redis_client.hset, match_key, f"status:{u_id_str}", "FINISHED")
            except:
                pass

        listen_task = asyncio.create_task(listen_to_client())

        # --- 3. MONITOR LOOP ---
        last_sync_score = -1
        last_sync_op_score = -1

        while True:
            await asyncio.sleep(1.0) 
            
            raw_data = await asyncio.to_thread(redis_client.hgetall, match_key)
            match_data = {to_str(k): to_str(v) for k, v in raw_data.items()}
            
            # Instant Sync check
            final_res_json = match_data.get(f"final_result:{u_id_str}")
            if final_res_json:
                await websocket.send_json({"type": "RESULT", **json.loads(final_res_json)})
                break 

            my_score = int(match_data.get(f"score:{u_id_str}", 0))
            op_score = int(match_data.get(f"score:{opponent_id}", 0))
            my_status = match_data.get(f"status:{u_id_str}")
            op_status = match_data.get(f"status:{opponent_id}")
            op_last_seen = float(match_data.get(f"last_seen:{opponent_id}", 0))

            # A. Opponent Timeout (Flee)
            time_since_op_seen = time.time() - op_last_seen
            if op_status != "FINISHED" and time_since_op_seen > GRACE_PERIOD_SECONDS:
                await finalize_match(websocket, match_id, u_id_str, opponent_id, "OPPONENT_FLED", my_score, op_score, opponent_name, user_repo)
                continue

            # B. Normal Completion Logic (With Tie-Breaker support)
            # Both players finished? End it.
            if my_status == "FINISHED" and op_status == "FINISHED":
                await finalize_match(websocket, match_id, u_id_str, opponent_id, "NORMAL", my_score, op_score, opponent_name, user_repo)
                continue
            
            # If one is finished but other has higher score? End it (Winner found).
            elif op_status == "FINISHED" and my_status == "PLAYING" and my_score > op_score:
                await finalize_match(websocket, match_id, u_id_str, opponent_id, "NORMAL", my_score, op_score, opponent_name, user_repo)
                continue

            elif my_status == "FINISHED" and op_status == "PLAYING" and op_score > my_score:
                await finalize_match(websocket, match_id, u_id_str, opponent_id, "NORMAL", my_score, op_score, opponent_name, user_repo)
                continue

            # Note: If one is finished and scores are EQUAL, the loop continues 
            # to let the playing user try to score higher.

            # C. Score Syncing
            if my_score != last_sync_score or op_score != last_sync_op_score:
                await websocket.send_json({
                    "type": "SYNC_STATE",
                    "your_score": my_score,
                    "opponent_score": op_score
                })
                last_sync_score, last_sync_op_score = my_score, op_score

    except WebSocketDisconnect:
        logger.info(f"Player {u_id_str} disconnected")
    except Exception as e:
        logger.error(f"Gameplay Error: {e}")
    finally:
        await asyncio.to_thread(redis_client.hincrby, match_key, "active_conns", -1)
        if listen_task: 
            listen_task.cancel()
        try:
            await websocket.close()
        except:
            pass