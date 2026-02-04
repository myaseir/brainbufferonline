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
    🚀 UPSTASH OPTIMIZED: Uses efficient polling to wait for game rounds.
    Replaces Pub/Sub to prevent 'Redis object has no attribute pubsub' errors.
    """
    match_key = f"match:live:{match_id}"
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        # 1. Fetch current state
        raw_state = await asyncio.to_thread(redis_client.hgetall, match_key)
        match_state = {to_str(k): to_str(v) for k, v in raw_state.items()}
        
        rounds_json = match_state.get("rounds")
        
        # 2. Check if both rounds and opponent details are present
        if rounds_json:
            opponent_id = None
            opponent_name = "Opponent"
            
            # Look for the other player's name in the hash
            for key, value in match_state.items():
                if key.startswith("name:") and key != f"name:{user_id}":
                    opponent_id = key.split(":")[1]
                    opponent_name = value
                    break
            
            # Only return if we found the opponent (ensures proper UI start)
            if opponent_id:
                return json.loads(rounds_json), opponent_name, opponent_id

        # 3. Wait briefly before next poll to stay under Upstash quotas
        await asyncio.sleep(1.0)
        
    raise TimeoutError("Match initialization timed out.")

async def finalize_match(ws, match_id, user_id, opponent_id, result_type, my_score, op_score, op_name, user_repo):
    """
    🚀 OPTIMIZED: Uses the centralized process_match_payout for secure transactions.
    This ensures History, Stats, and Wallet are all updated in one atomic step.
    """
    match_key = f"match:live:{match_id}"
    lock_key = f"lock:finalizing:{match_id}"
    
    # 🔒 Atomic Lock: Ensure only one thread/player processes the transaction
    locked = await asyncio.to_thread(redis_client.set, lock_key, "true", nx=True, ex=30)
    
    if locked:
        logger.info(f"Finalizing match {match_id}. User {user_id} is Master Processor.")
        
        # 1. Fetch fresh scores from Redis
        raw_data = await asyncio.to_thread(redis_client.hgetall, match_key)
        match_data = {to_str(k): to_str(v) for k, v in raw_data.items()}
        
        f_my_score = int(match_data.get(f"score:{user_id}", 0))
        f_op_score = int(match_data.get(f"score:{opponent_id}", 0))
        my_name = match_data.get(f"name:{user_id}", "You")

        # 2. Determine Winner/Draw status
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

        # 3. 💰 CENTRALIZED TRANSACTION (The Fix)
        # This replaces manual wallet and history calls.
        # It handles Wallet, Stats, and History internally in a DB Transaction.
        payout_success = await user_repo.process_match_payout(
            match_id=match_id,
            winner_id=winner_id,
            player1_id=user_id,
            player2_id=opponent_id,
            p1_score=f_my_score,
            p2_score=f_op_score,
            is_draw=is_draw
        )

        if not payout_success:
            logger.error(f"❌ Payout/History failed for match {match_id}")

        # 4. Prepare results for WebSocket broadcast
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

        # 5. Atomic State Update in Redis
        # gameplay.py's monitor loop picks this up within 1 second.
        pipe = redis_client.pipeline()
        pipe.hset(match_key, f"status:{user_id}", "FINISHED")
        pipe.hset(match_key, f"status:{opponent_id}", "FINISHED")
        pipe.hset(match_key, "finalized", "true")
        pipe.hset(match_key, f"final_result:{user_id}", json.dumps(results[user_id]))
        pipe.hset(match_key, f"final_result:{opponent_id}", json.dumps(results[opponent_id]))
        await asyncio.to_thread(pipe.exec) 
        
        return results[user_id]
    
    return None