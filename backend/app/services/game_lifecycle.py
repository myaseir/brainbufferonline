import asyncio
import json
import logging
import time
from app.db.redis import redis_client
from app.services.game_utils import to_str
from app.services.wallet_service import WalletService

logger = logging.getLogger("uvicorn.error")

async def wait_for_match_ready(match_id: str, user_id: str, timeout: int = 30):
    """
    🚀 UPSTASH OPTIMIZED: Efficient polling for match readiness.
    Ensures that both players are present in Redis before starting the UI.
    """
    match_key = f"match:live:{match_id}"
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        # 1. Fetch current state
        raw_state = await asyncio.to_thread(redis_client.hgetall, match_key)
        match_state = {to_str(k): to_str(v) for k, v in raw_state.items()}
        
        rounds_json = match_state.get("rounds")
        
        # 2. Check for Rounds and Opponent
        if rounds_json:
            opponent_id = None
            opponent_name = "Opponent"
            
            # Find the other player's metadata
            for key, value in match_state.items():
                if key.startswith("name:") and key != f"name:{user_id}":
                    opponent_id = key.split(":")[1]
                    opponent_name = value
                    break
            
            # Only start the game if the opponent has connected and set their name
            if opponent_id:
                logger.info(f"Match {match_id} Ready: {user_id} vs {opponent_name}")
                
                # 🚀 ADD THIS: Save details for Admin Dashboard
                match_info = {"id": match_id, "p1_name": user_id, "p2_name": opponent_name, "stake": 50} # Adjust stake as needed
                redis_client.set(f"match_details:{match_id}", json.dumps(match_info), ex=1800)
                redis_client.sadd("active_matches_set", match_id)
                
                return json.loads(rounds_json), opponent_name, opponent_id

        # 3. Adaptive polling: Wait 1s between checks to save Upstash quota
        await asyncio.sleep(2.0)
        
    raise TimeoutError("Match initialization timed out waiting for opponent.")

async def finalize_match(ws, match_id, user_id, opponent_id, result_type, my_score, op_score, op_name, user_repo):
    """
    🚀 UPDATED FINALIZE: Handles Paid Friendly Matches with Early Termination support.
    """
    match_key = f"match:live:{match_id}"
    lock_key = f"lock:finalizing:{match_id}"
    
    locked = await asyncio.to_thread(redis_client.set, lock_key, "true", nx=True, ex=30)
    
    if locked:
        logger.info(f"🏁 Finalizing match {match_id}. Reason: {result_type}")
        redis_client.srem("active_matches_set", match_id)
        redis_client.delete(f"match_details:{match_id}")
        
        raw_data = await asyncio.to_thread(redis_client.hgetall, match_key)
        match_data = {to_str(k): to_str(v) for k, v in raw_data.items()}
        
        # Get the actual scores from Redis (source of truth)
        f_my_score = int(match_data.get(f"score:{user_id}", 0))
        f_op_score = int(match_data.get(f"score:{opponent_id}", 0))
        my_name = match_data.get(f"name:{user_id}", "You")

        is_draw = False
        winner_id = None
        
        # 1. Determine Winner based on Score or Fleeing
        if result_type == "OPPONENT_FLED":
            winner_id = user_id
            status_caller, status_op = "WON", "LOST"
            summary_caller = "Opponent Fled! You Win! (+90 PKR)"
            summary_op = "Match Abandoned."
        else:
            if f_my_score > f_op_score:
                winner_id = user_id
                status_caller, status_op = "WON", "LOST"
            elif f_op_score > f_my_score:
                winner_id = opponent_id
                status_caller, status_op = "LOST", "WON"
            else:
                is_draw = True
                status_caller, status_op = "DRAW", "DRAW"
            
            # 2. Add "Early Victory" text if the match ended early
            prefix = "Early " if result_type == "EARLY_WIN" else ""
            summary_caller = f"{prefix}Victory! (+90 PKR)" if status_caller == "WON" else f"Match {status_caller}"
            summary_op = f"Opponent won by score." if status_op == "LOST" else f"Match {status_op}"

        # 3. Process Payout (Always happens since money is involved)
        payout_task = asyncio.create_task(
            user_repo.process_match_payout(
                match_id=match_id,
                winner_id=winner_id,
                player1_id=user_id,
                player2_id=opponent_id,
                p1_score=f_my_score,
                p2_score=f_op_score,
                is_draw=is_draw
            )
        )
        payout_task.add_done_callback(lambda t: logger.error(f"Payout Error: {t.exception()}") if t.exception() else None)

        # 4. Results Payload for Frontend
        results = {
            user_id: {
                "type": "RESULT",
                "status": status_caller,
                "summary": summary_caller,
                "my_score": f_my_score,
                "op_score": f_op_score,
                "opponent_name": op_name
            },
            opponent_id: {
                "type": "RESULT",
                "status": status_op,
                "summary": summary_op,
                "my_score": f_op_score,
                "op_score": f_my_score,
                "opponent_name": my_name
            }
        }

        # 5. Atomic Update to Redis
        final_update = {
            f"status:{user_id}": "FINISHED",
            f"status:{opponent_id}": "FINISHED",
            "finalized": "true",
            f"final_result:{user_id}": json.dumps(results[user_id]),
            f"final_result:{opponent_id}": json.dumps(results[opponent_id])
        }
        
        for field, value in final_update.items():
            await asyncio.to_thread(redis_client.hset, match_key, field, value)
        
        return results[user_id]
    
    return None