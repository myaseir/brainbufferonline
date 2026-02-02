import uuid
import json
import logging
from datetime import datetime, timezone
from fastapi import HTTPException
from app.repositories.match_repo import MatchRepository
from app.repositories.user_repo import UserRepository
from app.db.redis import redis_client

# Set up logging to catch those Upstash errors
logger = logging.getLogger("uvicorn.error")

class MatchmakingService:
    def __init__(self):
        self.match_repo = MatchRepository()
        self.user_repo = UserRepository()

    async def find_or_create_match(self, user_id: str):
        # 1. 💰 Wallet Check
        user = await self.user_repo.get_by_id(user_id)
        if not user or user.get("wallet_balance", 0) < 50:
            raise HTTPException(status_code=400, detail="Insufficient funds")

        try:
            # 2. 🕵️ Check if user is already in the pool
            is_in_pool = redis_client.sismember("matchmaking_pool", user_id)
            if is_in_pool:
                return {"status": "WAITING", "user_id": user_id}

            # 3. 🎲 Try to find an opponent
            opponent_id = redis_client.spop("matchmaking_pool")

            if opponent_id:
                if isinstance(opponent_id, bytes):
                    opponent_id = opponent_id.decode('utf-8')

                # Handle self-match edge case
                if opponent_id == str(user_id):
                    redis_client.sadd("matchmaking_pool", user_id)
                    return {"status": "WAITING"}

                # --- ✅ MATCH FOUND: DEDUCT & CREATE ---
                # We deduct here because we are sure a match is starting
                await self.user_repo.update_wallet(user_id, -50.0)
                
                match_id = f"match_{uuid.uuid4().hex[:8]}"

                # 🚨 SAFETY UPDATE: Wrap DB creation in try/except 
                try:
                    await self.match_repo.create_match_record(match_id, opponent_id, user_id, 50.0)
                    
                    # Notify the opponent who was already waiting
                    redis_client.set(f"notify:{opponent_id}", match_id, ex=30)
                    
                    return {
                        "status": "MATCHED",
                        "match_id": match_id,
                        "opponent_id": opponent_id,
                        "entry_fee": 50.0
                    }

                except Exception as db_error:
                    logger.error(f"❌ Failed to create match in DB: {db_error}")
                    
                    # 1. Refund the current user immediately
                    await self.user_repo.update_wallet(user_id, 50.0)
                    
                    # 2. Put the opponent back in the pool (so they don't lose their spot/money)
                    redis_client.sadd("matchmaking_pool", opponent_id)
                    
                    raise HTTPException(status_code=500, detail="Match creation failed. Funds refunded.")

            else:
                # --- ⏳ JOIN THE POOL ---
                # We deduct upfront to "lock" the player in
                await self.user_repo.update_wallet(user_id, -50.0)
                
                # Critical: If this Redis call fails, we must refund immediately!
                try:
                    redis_client.sadd("matchmaking_pool", user_id)
                except Exception as redis_err:
                    logger.error(f"Redis sadd failed: {redis_err}")
                    await self.user_repo.update_wallet(user_id, 50.0) # REFUND
                    raise HTTPException(status_code=500, detail="Matchmaking server busy. Funds refunded.")

                return {"status": "WAITING", "user_id": user_id}

        except HTTPException as he:
            raise he
        except Exception as e:
            logger.error(f"Matchmaking Error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")

    async def check_notif(self, user_id: str):
        try:
            notif = redis_client.get(f"notify:{user_id}")
            if notif:
                redis_client.delete(f"notify:{user_id}")
                return notif.decode() if isinstance(notif, bytes) else notif
        except Exception as e:
            logger.error(f"Notification check failed: {e}")
        return None

    async def cancel_matchmaking(self, user_id: str):
        """Removes user from pool and refunds the 50 PKR."""
        try:
            # Atomic removal attempt
            removed = redis_client.srem("matchmaking_pool", user_id)
            
            if removed:
                # ONLY refund if they were successfully taken out of the pool
                await self.user_repo.update_wallet(user_id, 50.0)
                logger.info(f"✅ User {user_id} cancelled and was refunded 50 PKR.")
                return {"status": "cancelled", "refunded": True}
            else:
                # If NOT in pool, they might already be in a match
                notif = redis_client.get(f"notify:{user_id}")
                if notif:
                    return {"status": "error", "message": "Match already started. Cannot cancel."}
                
                return {"status": "not_in_pool", "refunded": False}

        except Exception as e:
            logger.error(f"Cancel Matchmaking Redis Error: {e}")
            raise HTTPException(status_code=500, detail="Service unavailable. Could not verify refund.")