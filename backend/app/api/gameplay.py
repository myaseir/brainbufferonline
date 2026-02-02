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

async def game_websocket_endpoint(websocket: WebSocket, match_id: str, token: str = Query(...)):
    await websocket.accept()
    user_id = await get_user_from_token(token)
    if not user_id: 
        await websocket.close()
        return

    u_id_str = str(user_id)
    match_key = f"match:live:{match_id}"
    user_repo = UserRepository()
    GRACE_PERIOD_SECONDS = 10
    listen_task = None
    
    try:
        # --- 1. INIT (Thread-Safe) ---
        user = await user_repo.get_by_id(u_id_str)
        username = user.get("username", "Unknown")
        
        # Use to_thread for all Upstash hits to prevent blocking
        await asyncio.to_thread(redis_client.hset, match_key, f"name:{u_id_str}", username)
        await asyncio.to_thread(redis_client.hsetnx, match_key, f"score:{u_id_str}", "0")
        await asyncio.to_thread(redis_client.hset, match_key, f"status:{u_id_str}", "PLAYING")
        await asyncio.to_thread(redis_client.hset, match_key, f"last_seen:{u_id_str}", time.time())
        await asyncio.to_thread(redis_client.hincrby, match_key, "active_conns", 1)

        is_host = await asyncio.to_thread(redis_client.set, f"init:{match_id}", "true", nx=True, ex=30)
        if is_host:
            game_rounds = generate_fair_game(20)
            await asyncio.to_thread(redis_client.hset, match_key, "rounds", json.dumps(game_rounds))
            await asyncio.to_thread(redis_client.expire, match_key, 600)
        
        rounds_data, opponent_name, opponent_id = await wait_for_match_ready(match_key, u_id_str)

        # 2. Get initial scores
        scores = await asyncio.to_thread(redis_client.hmget, match_key, f"score:{u_id_str}", f"score:{opponent_id}")
        current_my_score = int(scores[0] or 0)
        current_op_score = int(scores[1] or 0)

        await websocket.send_json({
            "type": "GAME_START",
            "rounds": rounds_data,
            "opponent_name": opponent_name,
            "your_current_score": current_my_score,
            "op_current_score": current_op_score
        })

        # --- 3. LISTENER (Throttled Writes) ---
        async def listen_to_client():
            try:
                while True:
                    data = await websocket.receive_json()
                    
                    # Update score only if it actually changed to save WRITES
                    if data.get("type") == "SCORE_UPDATE":
                        new_score = int(data.get("score", 0))
                        # Atomic update: only set if new_score > current in Redis logic
                        # For now, let's just do it every 2 seconds or on change
                        await asyncio.to_thread(redis_client.hset, match_key, f"score:{u_id_str}", new_score)
                        await asyncio.to_thread(redis_client.hset, match_key, f"last_seen:{u_id_str}", time.time())

                    if data.get("type") == "GAME_OVER":
                        await asyncio.to_thread(redis_client.hset, match_key, f"status:{u_id_str}", "FINISHED")
            except:
                pass

        listen_task = asyncio.create_task(listen_to_client())

        # --- 4. MONITOR LOOP (Quota Saver) ---
        # 🚀 CHANGE: Increased sleep from 0.1 to 1.0
        # Checking once per second is plenty for a brain game!
        while True:
            await asyncio.sleep(1.0) 
            
            # Fetch State in ONE command using hgetall
            raw_data = await asyncio.to_thread(redis_client.hgetall, match_key)
            match_data = {to_str(k): to_str(v) for k, v in raw_data.items()}
            
            # 1. Result Check
            final_result_json = match_data.get(f"final_result:{u_id_str}")
            if final_result_json:
                await websocket.send_json({"type": "RESULT", **json.loads(final_result_json)})
                break 

            my_score = int(match_data.get(f"score:{u_id_str}", 0))
            op_score = int(match_data.get(f"score:{opponent_id}", 0))
            my_status = match_data.get(f"status:{u_id_str}")
            op_status = match_data.get(f"status:{opponent_id}")
            active_conns = int(match_data.get("active_conns", 0))
            op_last_seen = float(match_data.get(f"last_seen:{opponent_id}", 0))

            # --- DECISION LOGIC ---
            # A. Opponent Fled
            if active_conns < 2 and op_status != "FINISHED":
                time_away = time.time() - op_last_seen
                if my_status == "FINISHED":
                     await finalize_match(websocket, match_id, u_id_str, opponent_id, "WON", my_score, op_score, opponent_name, user_repo)
                     continue
                if time_away > GRACE_PERIOD_SECONDS:
                    await finalize_match(websocket, match_id, u_id_str, opponent_id, "OPPONENT_FLED", my_score, op_score, opponent_name, user_repo)
                    continue
                else:
                    await websocket.send_json({"type": "WAITING_FOR_OPPONENT", "seconds_left": int(GRACE_PERIOD_SECONDS - time_away)})
                    continue

            # B. Early Win / Both Finished
            if (op_status == "FINISHED" and my_status == "PLAYING" and my_score > op_score) or (my_status == "FINISHED" and op_status == "FINISHED"):
                res = "WON" if my_score > op_score else ("LOST" if op_score > my_score else "DRAW")
                await finalize_match(websocket, match_id, u_id_str, opponent_id, res, my_score, op_score, opponent_name, user_repo)
                continue

            # Sync State to Frontend
            await websocket.send_json({
                "type": "SYNC_STATE",
                "your_score": my_score,
                "opponent_score": op_score
            })

    except WebSocketDisconnect:
        pass
    finally:
        await asyncio.to_thread(redis_client.hincrby, match_key, "active_conns", -1)
        if listen_task: listen_task.cancel()