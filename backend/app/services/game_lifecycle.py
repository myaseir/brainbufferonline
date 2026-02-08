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
                return json.loads(rounds_json), opponent_name, opponent_id

        # 3. Adaptive polling: Wait 1s between checks to save Upstash quota
        await asyncio.sleep(2.0)
        
    raise TimeoutError("Match initialization timed out waiting for opponent.")

async def finalize_match(ws, match_id, user_id, opponent_id, result_type, my_score, op_score, op_name, user_repo):
    """
    🚀 TRANSACTIONAL FINALIZE: Securely handles winner determination and payout.
    """
    match_key = f"match:live:{match_id}"
    lock_key = f"lock:finalizing:{match_id}"
    
    # 🔒 Atomic Lock for Master Processor
    locked = await asyncio.to_thread(redis_client.set, lock_key, "true", nx=True, ex=30)
    
    if locked:
        logger.info(f"🏁 Finalizing match {match_id}. Processor: {user_id}")
        
        raw_data = await asyncio.to_thread(redis_client.hgetall, match_key)
        match_data = {to_str(k): to_str(v) for k, v in raw_data.items()}
        
        f_my_score = int(match_data.get(f"score:{user_id}", 0))
        f_op_score = int(match_data.get(f"score:{opponent_id}", 0))
        my_name = match_data.get(f"name:{user_id}", "You")

        is_draw = False
        winner_id = None
        
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
            
            summary_caller = f"Match {status_caller}"
            summary_op = f"Match {status_op}"

        # 💰 Execute DB Transaction (Wallet + History)
        payout_success = await user_repo.process_match_payout(
            match_id=match_id,
            winner_id=winner_id,
            player1_id=user_id,
            player2_id=opponent_id,
            p1_score=f_my_score,
            p2_score=f_op_score,
            is_draw=is_draw
        )

        # 4. Results Payload
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

        # 5. ✅ UPSTASH FIX: Use direct calls instead of pipeline.exec() to avoid crashes
        # The Upstash SDK handles these high-speed sequential writes very well.
        redis_client.hset(match_key, f"status:{user_id}", "FINISHED")
        redis_client.hset(match_key, f"status:{opponent_id}", "FINISHED")
        redis_client.hset(match_key, "finalized", "true")
        redis_client.hset(match_key, f"final_result:{user_id}", json.dumps(results[user_id]))
        redis_client.hset(match_key, f"final_result:{opponent_id}", json.dumps(results[opponent_id]))
        
        return results[user_id]
    
    return None