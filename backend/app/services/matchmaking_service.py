import uuid
import json
import logging
import asyncio # 🔥 Added for the timer
import random  # 🔥 Added for picking a bot
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
                await self.user_repo.update_wallet(user_id, -50.0)
                
                match_id = f"match_{uuid.uuid4().hex[:8]}"

                try:
                    await self.match_repo.create_match_record(match_id, opponent_id, user_id, 50.0)
                    redis_client.set(f"notify:{opponent_id}", match_id, ex=30)
                    
                    return {
                        "status": "MATCHED",
                        "match_id": match_id,
                        "opponent_id": opponent_id,
                        "entry_fee": 50.0
                    }

                except Exception as db_error:
                    logger.error(f"❌ Failed to create match in DB: {db_error}")
                    await self.user_repo.update_wallet(user_id, 50.0)
                    redis_client.sadd("matchmaking_pool", opponent_id)
                    raise HTTPException(status_code=500, detail="Match creation failed. Funds refunded.")

            else:
                # --- ⏳ JOIN THE POOL & START BOT TIMER ---
                await self.user_repo.update_wallet(user_id, -50.0)
                
                try:
                    redis_client.sadd("matchmaking_pool", user_id)

                    # 🔥 NEW: 3-SECOND WAIT FOR HUMAN
                    for _ in range(3):
                        await asyncio.sleep(1)
                        # Check if a human 'popped' us while we were sleeping
                        notif = redis_client.get(f"notify:{user_id}")
                        if notif:
                            match_id = notif.decode() if isinstance(notif, bytes) else notif
                            return {"status": "MATCHED", "match_id": match_id}

                    # 🔥 NEW: BOT FALLBACK (After 3 seconds)
                    # 1. Remove user from human pool
                    redis_client.srem("matchmaking_pool", user_id)
                    
                    # 2. Pick a random Pakistani Bot (BOT_001 to BOT_020)
                    bot_num = random.randint(1, 20)
                    bot_id = f"BOT_{bot_num:03d}"
                    match_id = f"match_{uuid.uuid4().hex[:8]}"

                    # 3. Create Record & Redis Metadata
                    await self.match_repo.create_match_record(match_id, bot_id, user_id, 50.0)
                    
                    match_key = f"match:live:{match_id}"
                    redis_client.hset(match_key, mapping={
                        "p1_id": user_id,
                        "p2_id": bot_id,
                        "status": "CREATED",
                        "bet_amount": "50.0"
                    })
                    redis_client.expire(match_key, 600)

                    return {
                        "status": "MATCHED",
                        "match_id": match_id,
                        "opponent_id": bot_id,
                        "entry_fee": 50.0
                    }

                except Exception as redis_err:
                    logger.error(f"Bot/Pool Error: {redis_err}")
                    await self.user_repo.update_wallet(user_id, 50.0) 
                    redis_client.srem("matchmaking_pool", user_id)
                    raise HTTPException(status_code=500, detail="Matchmaking server busy. Funds refunded.")

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
            removed = redis_client.srem("matchmaking_pool", user_id)
            if removed:
                await self.user_repo.update_wallet(user_id, 50.0)
                logger.info(f"✅ User {user_id} cancelled and was refunded 50 PKR.")
                return {"status": "cancelled", "refunded": True}
            else:
                notif = redis_client.get(f"notify:{user_id}")
                if notif:
                    return {"status": "error", "message": "Match already started. Cannot cancel."}
                return {"status": "not_in_pool", "refunded": False}
        except Exception as e:
            logger.error(f"Cancel Matchmaking Redis Error: {e}")
            raise HTTPException(status_code=500, detail="Service unavailable. Could not verify refund.")