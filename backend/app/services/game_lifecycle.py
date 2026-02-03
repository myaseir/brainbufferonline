import asyncio
import json
import logging
from app.db.redis import redis_client
from app.services.game_utils import to_str

logger = logging.getLogger("uvicorn.error")

async def wait_for_match_ready(match_key: str, user_id: str, timeout: int = 30):
    start_time = asyncio.get_event_loop().time()
    
    while (asyncio.get_event_loop().time() - start_time) < timeout:
        # Use to_thread to keep the server responsive
        raw_state = await asyncio.to_thread(redis_client.hgetall, match_key)
        match_state = {to_str(k): to_str(v) for k, v in raw_state.items()}
        
        rounds_json = match_state.get("rounds")
        opponent_id = None
        opponent_name = "Waiting..."
        
        # Faster lookup: Only iterate keys starting with "name:"
        for key, value in match_state.items():
            if key.startswith("name:") and key != f"name:{user_id}":
                opponent_id = key.split(":")[1]
                opponent_name = value
                break
        
        if rounds_json and opponent_id:
            return json.loads(rounds_json), opponent_name, opponent_id
        
        await asyncio.sleep(1.0) # Increased to 1s to save Upstash quota
        
    raise TimeoutError("Match initialization timed out.")

async def finalize_match(ws, match_id, user_id, opponent_id, result_type, my_score, op_score, op_name, user_repo):
    match_key = f"match:live:{match_id}"
    lock_key = f"lock:finalizing:{match_id}"
    
    # Try to acquire lock atomically
    locked = await asyncio.to_thread(redis_client.set, lock_key, "true", nx=True, ex=30)
    
    if locked:
        logger.info(f"Finalizing match {match_id}. User {user_id} is processor.")
        
        # 1. Fetch fresh scores and names in one go
        raw_data = await asyncio.to_thread(redis_client.hgetall, match_key)
        match_data = {to_str(k): to_str(v) for k, v in raw_data.items()}
        
        f_my_score = int(match_data.get(f"score:{user_id}", 0))
        f_op_score = int(match_data.get(f"score:{opponent_id}", 0))
        my_name = match_data.get(f"name:{user_id}", "You")

        # 2. Logic for Result
        if result_type == "OPPONENT_FLED":
            winner_id, loser_id = user_id, opponent_id
            status_caller, status_op = "WON", "LOST"
            summary_caller = "Opponent Disconnected! You Win!"
            summary_op = "You abandoned the match."
        else:
            if f_my_score > f_op_score:
                winner_id, loser_id = user_id, opponent_id
                status_caller, status_op = "WON", "LOST"
            elif f_op_score > f_my_score:
                winner_id, loser_id = opponent_id, user_id
                status_caller, status_op = "LOST", "WON"
            else:
                winner_id, loser_id = None, None
                status_caller, status_op = "DRAW", "DRAW"
            
            summary_caller = f"Match {status_caller}"
            summary_op = f"Match {status_op}"

        # Prepare payloads
        res_caller = {
            "status": status_caller,
            "summary": summary_caller,
            "my_score": f_my_score,
            "op_score": f_op_score,
            "opponent_name": op_name
        }
        res_opponent = {
            "status": status_op,
            "summary": summary_op,
            "my_score": f_op_score,
            "op_score": f_my_score,
            "opponent_name": my_name
        }

        # 3. ⚡ ATOMIC REDIS PIPELINE
        # ✅ FIX: Removed 'mapping' keyword. Calling hset with key-value pairs directly.
        pipe = redis_client.pipeline()
        pipe.hset(match_key, f"status:{user_id}", "FINISHED")
        pipe.hset(match_key, f"status:{opponent_id}", "FINISHED")
        pipe.hset(match_key, f"final_result:{user_id}", json.dumps(res_caller))
        pipe.hset(match_key, f"final_result:{opponent_id}", json.dumps(res_opponent))
        pipe.hset(match_key, "finalized", "true")
        
        await asyncio.to_thread(pipe.exec) 

        # 4. 🐢 DB SYNC (Handles payouts and records)
        asyncio.create_task(
            user_repo.process_match_payout(
                match_id=match_id,
                winner_id=winner_id,
                player1_id=user_id,
                player2_id=opponent_id,
                p1_score=f_my_score,
                p2_score=f_op_score,
                is_draw=(winner_id is None)
            )
        )
        
        return res_caller
    
    return None