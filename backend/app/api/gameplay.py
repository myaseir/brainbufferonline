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

    match_key = f"match:live:{match_id}"
    user_repo = UserRepository()
    GRACE_PERIOD_SECONDS = 10
    listen_task = None
    
    try:
        # --- INIT ---
        user = await user_repo.get_by_id(user_id)
        username = user.get("username", "Unknown")
        
        redis_client.hset(match_key, f"name:{user_id}", username)
        redis_client.hsetnx(match_key, f"score:{user_id}", "0")
        redis_client.hset(match_key, f"status:{user_id}", "PLAYING")
        redis_client.hset(match_key, f"last_seen:{user_id}", time.time())
        redis_client.hincrby(match_key, "active_conns", 1)

        is_host = redis_client.set(f"init:{match_id}", "true", nx=True, ex=30)
        if is_host:
            game_rounds = generate_fair_game(20)
            redis_client.hset(match_key, "rounds", json.dumps(game_rounds))
            redis_client.expire(match_key, 600)
        
        rounds_data, opponent_name, opponent_id = await wait_for_match_ready(match_key, user_id)

        current_my_score = int(redis_client.hget(match_key, f"score:{user_id}") or 0)
        current_op_score = int(redis_client.hget(match_key, f"score:{opponent_id}") or 0)

        await websocket.send_json({
            "type": "GAME_START",
            "rounds": rounds_data,
            "opponent_name": opponent_name,
            "your_current_score": current_my_score,
            "op_current_score": current_op_score
        })

        # --- LISTENER ---
        async def listen_to_client():
            try:
                while True:
                    data = await websocket.receive_json()
                    redis_client.hset(match_key, f"last_seen:{user_id}", time.time())
                    if data.get("type") == "SCORE_UPDATE":
                        new_score = int(data.get("score", 0))
                        current = int(redis_client.hget(match_key, f"score:{user_id}") or 0)
                        if new_score > current:
                            redis_client.hset(match_key, f"score:{user_id}", new_score)
                    if data.get("type") == "GAME_OVER":
                        redis_client.hset(match_key, f"status:{user_id}", "FINISHED")
            except:
                pass

        listen_task = asyncio.create_task(listen_to_client())

        # --- MONITOR LOOP ---
        while True:
            await asyncio.sleep(0.1) 
            
            # 1. READ RESULT FROM REDIS (Source of Truth)
            final_result_json = redis_client.hget(match_key, f"final_result:{user_id}")
            if final_result_json:
                print(f"DEBUG: Found result in Redis for {user_id}. Sending...")
                try:
                    await websocket.send_json({"type": "RESULT", **json.loads(final_result_json)})
                except Exception as e:
                    print(f"ERROR sending result: {e}")
                break 
            
            # Check global finalized flag
            if redis_client.hget(match_key, "finalized") == "true":
                # If finalized is true but we didn't find our result yet, we loop again to find it
                # (It might be microseconds away in the pipeline)
                continue

            # Fetch State
            raw_data = redis_client.hgetall(match_key)
            match_data = {to_str(k): to_str(v) for k, v in raw_data.items()}
            
            my_score = int(match_data.get(f"score:{user_id}", 0))
            op_score = int(match_data.get(f"score:{opponent_id}", 0))
            my_status = match_data.get(f"status:{user_id}")
            op_status = match_data.get(f"status:{opponent_id}")
            active_conns = int(match_data.get("active_conns", 0))
            op_last_seen = float(match_data.get(f"last_seen:{opponent_id}", 0))

            # --- DECISION LOGIC ---
            
            # A. Opponent Fled
            if active_conns < 2 and op_status != "FINISHED":
                time_away = time.time() - op_last_seen
                
                # I win immediately if I am already done
                if my_status == "FINISHED":
                     await finalize_match(websocket, match_id, user_id, opponent_id, "WON", my_score, op_score, opponent_name, user_repo)
                     continue

                if time_away > GRACE_PERIOD_SECONDS:
                    await finalize_match(websocket, match_id, user_id, opponent_id, "OPPONENT_FLED", my_score, op_score, opponent_name, user_repo)
                    continue
                else:
                    await websocket.send_json({"type": "WAITING_FOR_OPPONENT", "seconds_left": int(GRACE_PERIOD_SECONDS - time_away)})
                    continue

            # B. Early Win (They finished, I passed their score)
            if op_status == "FINISHED" and my_status == "PLAYING" and my_score > op_score:
                await finalize_match(websocket, match_id, user_id, opponent_id, "WON", my_score, op_score, opponent_name, user_repo)
                continue

            # C. Both Finished
            if my_status == "FINISHED" and op_status == "FINISHED":
                res = "WON" if my_score > op_score else ("LOST" if op_score > my_score else "DRAW")
                await finalize_match(websocket, match_id, user_id, opponent_id, res, my_score, op_score, opponent_name, user_repo)
                continue

            # Sync State
            await websocket.send_json({
                "type": "SYNC_STATE",
                "your_score": my_score,
                "opponent_score": op_score
            })

    except WebSocketDisconnect:
        pass
    finally:
        redis_client.hincrby(match_key, "active_conns", -1)
        if listen_task: listen_task.cancel()