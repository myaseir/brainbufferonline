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
        # --- 1. JOIN & INIT ---
        user = await user_repo.get_by_id(u_id_str)
        username = user.get("username", "Unknown")
        
        # ✅ FIX: Upstash-redis hset does not support 'mapping'. Use individual calls.
        await asyncio.to_thread(redis_client.hset, match_key, f"name:{u_id_str}", username)
        await asyncio.to_thread(redis_client.hset, match_key, f"status:{u_id_str}", "PLAYING")
        await asyncio.to_thread(redis_client.hset, match_key, f"last_seen:{u_id_str}", time.time())
        
        await asyncio.to_thread(redis_client.hsetnx, match_key, f"score:{u_id_str}", "0")
        await asyncio.to_thread(redis_client.hincrby, match_key, "active_conns", 1)

        # Host logic: generate rounds only once
        is_host = await asyncio.to_thread(redis_client.set, f"init:{match_id}", "true", nx=True, ex=30)
        if is_host:
            game_rounds = generate_fair_game(20)
            await asyncio.to_thread(redis_client.hset, match_key, "rounds", json.dumps(game_rounds))
            await asyncio.to_thread(redis_client.expire, match_key, 600)
        
        # Block until both players are connected
        rounds_data, opponent_name, opponent_id = await wait_for_match_ready(match_key, u_id_str)

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
                    if data.get("type") == "SCORE_UPDATE":
                        new_score = int(data.get("score", 0))
                        # ✅ FIX: Removed mapping here as well
                        await asyncio.to_thread(redis_client.hset, match_key, f"score:{u_id_str}", new_score)
                        await asyncio.to_thread(redis_client.hset, match_key, f"last_seen:{u_id_str}", time.time())

                    if data.get("type") == "GAME_OVER":
                        await asyncio.to_thread(redis_client.hset, match_key, f"status:{u_id_str}", "FINISHED")
            except:
                pass

        listen_task = asyncio.create_task(listen_to_client())

        # --- 3. MONITOR LOOP (Live Sync) ---
        last_sync_score = -1
        last_sync_op_score = -1

        while True:
            await asyncio.sleep(1.0) 
            
            raw_data = await asyncio.to_thread(redis_client.hgetall, match_key)
            match_data = {to_str(k): to_str(v) for k, v in raw_data.items()}
            
            final_result_json = match_data.get(f"final_result:{u_id_str}")
            if final_result_json:
                await websocket.send_json({"type": "RESULT", **json.loads(final_result_json)})
                break 

            my_score = int(match_data.get(f"score:{u_id_str}", 0))
            op_score = int(match_data.get(f"score:{opponent_id}", 0))
            my_status = match_data.get(f"status:{u_id_str}")
            op_status = match_data.get(f"status:{opponent_id}")
            op_last_seen = float(match_data.get(f"last_seen:{opponent_id}", 0))

            # A. Opponent Timeout Check
            time_since_op_seen = time.time() - op_last_seen
            if op_status != "FINISHED" and time_since_op_seen > GRACE_PERIOD_SECONDS:
                if await asyncio.to_thread(redis_client.set, f"fin_lock:{match_id}", "locked", nx=True, ex=10):
                    await finalize_match(websocket, match_id, u_id_str, opponent_id, "OPPONENT_FLED", my_score, op_score, opponent_name, user_repo)
                continue

            # B. Both Finished or Early Win
            if (my_status == "FINISHED" and op_status == "FINISHED") or \
               (op_status == "FINISHED" and my_status == "PLAYING" and my_score > op_score):
                
                if await asyncio.to_thread(redis_client.set, f"fin_lock:{match_id}", "locked", nx=True, ex=10):
                    res = "WON" if my_score > op_score else ("LOST" if op_score > my_score else "DRAW")
                    await finalize_match(websocket, match_id, u_id_str, opponent_id, res, my_score, op_score, opponent_name, user_repo)
                continue

            if my_score != last_sync_score or op_score != last_sync_op_score:
                await websocket.send_json({
                    "type": "SYNC_STATE",
                    "your_score": my_score,
                    "opponent_score": op_score
                })
                last_sync_score, last_sync_op_score = my_score, op_score

    except WebSocketDisconnect:
        logger.info(f"Player {u_id_str} disconnected from match {match_id}")

        match_data = redis_client.hgetall(match_key)
        status = match_data.get("status")

        # ---------------------------------------------------------
        # SCENARIO A: Game was LIVE (Someone raged quit)
        # ---------------------------------------------------------
        if status == "IN_PROGRESS":
            logger.info(f"Match {match_id} abandoned by {u_id_str}. Awarding win.")
            redis_client.hset(match_key, "status", "FINISHED")
            
            # Identify Winner
            p1 = match_data.get("p1_id")
            p2 = match_data.get("p2_id")
            # If P1 left, P2 is the winner (and vice versa)
            winner_id = p2 if str(u_id_str) == str(p1) else p1

            # Payload: Tell the survivor they won
            win_payload = {
                "type": "RESULT",
                "status": "WON",
                "my_score": 0,  # You can fetch real score if needed
                "op_score": 0,
                "summary": "Opponent Fled! You Win! (+90 PKR)"
            }
            await asyncio.to_thread(redis_client.publish, f"match_{match_id}", json.dumps(win_payload))
            
            # TODO: Call your DB function here to update wallets!
            # await db_finalize_match(match_id, winner_id=winner_id, reason="ABANDONED")

        # ---------------------------------------------------------
        # SCENARIO B: Game hadn't started yet (Setup phase)
        # ---------------------------------------------------------
        elif status == "WAITING" or status == "CREATED":
            logger.info(f"Match {match_id} aborted pre-game.")
            redis_client.hset(match_key, "status", "ABORTED")

            # Payload: Tell the survivor the match is cancelled
            abort_payload = {
                "type": "MATCH_ABORTED",
                "leaver_name": "Opponent",
                "reason": "Disconnected before start"
            }
            await asyncio.to_thread(redis_client.publish, f"match_{match_id}", json.dumps(abort_payload))

            # TODO: Ensure no money was taken, or issue immediate refund here.

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