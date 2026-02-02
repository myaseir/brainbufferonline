import asyncio
import json
from app.db.redis import redis_client
from app.services.game_utils import to_str

async def wait_for_match_ready(match_key: str, user_id: str, timeout: int = 30):
    start_time = asyncio.get_event_loop().time()
    
    while (asyncio.get_event_loop().time() - start_time) < timeout:
        raw_state = redis_client.hgetall(match_key)
        match_state = {to_str(k): to_str(v) for k, v in raw_state.items()}
        
        rounds_json = match_state.get("rounds")
        
        opponent_id = None
        opponent_name = "Waiting..."
        
        for key, value in match_state.items():
            if key.startswith("name:") and key != f"name:{user_id}":
                opponent_id = key.replace("name:", "")
                opponent_name = value
                break
        
        if rounds_json and opponent_id:
            return json.loads(rounds_json), opponent_name, opponent_id
        
        await asyncio.sleep(0.5)
        
    raise TimeoutError("Match initialization timed out.")

async def finalize_match(ws, match_id, user_id, opponent_id, result_type, my_score, op_score, op_name, user_repo):
    """
    1. Sets a lock to ensure only one server processes the result.
    2. Updates Redis INSTANTLY so the UI gets the result.
    3. Saves to the DB in the background.
    """
    match_key = f"match:live:{match_id}"
    lock_key = f"lock:finalizing:{match_id}"
    
    # Try to acquire lock (valid for 30s)
    if redis_client.set(lock_key, "true", nx=True, ex=30):
        print(f"DEBUG: {user_id} acquired lock. Finalizing match...")
        
        # 1. Prepare Data
        # We fetch fresh scores just in case, though usually passed args are sufficient
        final_my_score = int(redis_client.hget(match_key, f"score:{user_id}") or 0)
        final_op_score = int(redis_client.hget(match_key, f"score:{opponent_id}") or 0)
        
        result_data = {
            "summary": "Match Over",
            "my_score": final_my_score,
            "op_score": final_op_score,
            "opponent_name": op_name
        }
        
        result_for_caller = result_data.copy()
        result_for_opponent = result_data.copy()
        
        # ---------------------------------------------------------
        # 🚨 FIX: Handle OPPONENT_FLED Logic correctly
        # ---------------------------------------------------------
        if result_type == "OPPONENT_FLED":
            # If opponent fled, the caller (survivor) WINS automatically
            result_for_caller["status"] = "WON"
            result_for_caller["summary"] = "Opponent Disconnected! You Win!"
            
            # The opponent effectively abandoned/lost
            result_for_opponent["my_score"] = final_op_score
            result_for_opponent["op_score"] = final_my_score
            result_for_opponent["status"] = "LOST"
            result_for_opponent["summary"] = "You abandoned the match."
            
        else:
            # Standard Score Comparison
            result_for_caller["status"] = "WON" if final_my_score > final_op_score else ("LOST" if final_op_score > final_my_score else "DRAW")
            
            result_for_opponent["my_score"] = final_op_score
            result_for_opponent["op_score"] = final_my_score
            result_for_opponent["status"] = "WON" if final_op_score > final_my_score else ("LOST" if final_my_score > final_op_score else "DRAW")

        # 2. ⚡ WRITE TO REDIS IMMEDIATELY
        pipe = redis_client.pipeline()
        pipe.hset(match_key, f"status:{user_id}", "FINISHED")
        pipe.hset(match_key, f"status:{opponent_id}", "FINISHED")
        pipe.hset(match_key, f"final_result:{user_id}", json.dumps(result_for_caller))
        pipe.hset(match_key, f"final_result:{opponent_id}", json.dumps(result_for_opponent))
        pipe.hset(match_key, "finalized", "true")
        
        # Upstash SDK uses .exec(), not .execute()
        pipe.exec() 
        
        print(f"DEBUG: Results written to Redis for match {match_id}")

        # 3. 🐢 SAVE TO DB IN BACKGROUND
        asyncio.create_task(
            user_repo.save_match_result(
                match_id, user_id, opponent_id, result_type, final_my_score, final_op_score
            )
        )
        
        return result_for_caller
    
    print(f"DEBUG: {user_id} failed to get lock (already processing).")
    return None