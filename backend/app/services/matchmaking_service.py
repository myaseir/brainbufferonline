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
import httpx # Add this at the top of your file
import os


# Set up logging to catch those Upstash errors
logger = logging.getLogger("uvicorn.error")
BOT_SERVER_URL = os.getenv("BOT_SERVER_URL", "http://127.0.0.1:10000")
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

                    # Wait for a human for 3 seconds
                    for _ in range(5):
                        await asyncio.sleep(1)
                        notif = redis_client.get(f"notify:{user_id}")
                    if notif:
                        return {"status": "MATCHED", "match_id": notif.decode()}

    # 3. ATTEMPT TO LEAVE POOL FOR BOT
    # If srem returns 0, someone else popped us right as we timed out!
                    if redis_client.srem("matchmaking_pool", user_id) == 0:
        # Wait a split second for the notification to arrive
                        await asyncio.sleep(0.5)
                        notif = redis_client.get(f"notify:{user_id}")
                    if notif:
                        return {"status": "MATCHED", "match_id": notif.decode()}

                    # 🔥 BOT FALLBACK STARTS HERE 🔥
                    # If we reached here, no human was found in 3 seconds.
                    
                    # 1. Remove user from human pool so a human doesn't join late
                    redis_client.srem("matchmaking_pool", user_id)
                    
                    # 2. Pick a random Bot ID
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

                    # ✅ TRIGGER THE BOT: Wake it up via HTTP
                    # We use create_task so we don't block the user's response
                    asyncio.create_task(self.trigger_bot_spawn(match_id))

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
        """
        Removes user from pool and refunds the 50 PKR. 
        Professional Update: Also refunds if a match was found but the game hasn't truly started.
        """
        try:
            # 1. Standard Case: User is still in the pool
            removed = redis_client.srem("matchmaking_pool", user_id)
            if removed:
                await self.user_repo.update_wallet(user_id, 50.0)
                logger.info(f"✅ User {user_id} cancelled and was refunded 50 PKR.")
                return {"status": "cancelled", "refunded": True}
            
            # 2. Professional Fallback: User was just 'popped' but hasn't played a single round
            notif = redis_client.get(f"notify:{user_id}")
            if notif:
                match_id = notif.decode() if isinstance(notif, bytes) else str(notif)
                match_key = f"match:live:{match_id}"
                
                
                # Check if the user has posted any score yet
                has_score = redis_client.hexists(match_key, f"score:{user_id}")
                
                if not has_score:
                    # Clear the notification and refund
                    redis_client.delete(f"notify:{user_id}")
                    await self.user_repo.update_wallet(user_id, 50.0)
                    logger.info(f"✅ User {user_id} refunded for unstarted match: {match_id}")
                    return {"status": "cancelled", "refunded": True}
                else:
                    return {"status": "error", "message": "Match in progress. Refund unavailable."}

            return {"status": "not_in_pool", "refunded": False}

        except Exception as e:
            logger.error(f"Cancel Matchmaking Error: {e}")
            raise HTTPException(status_code=500, detail="Service unavailable. Could not verify refund.")
        
    async def trigger_bot_spawn(self, match_id: str):
        print(f"DEBUG: Attempting to wake up bot for {match_id}...") # Standard print always shows
        bot_url = f"{BOT_SERVER_URL}/spawn-bot"
    
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                bot_url, 
                json={"match_id": match_id},
                timeout=5.0
            )
            print(f"DEBUG: Bot Server responded with: {response.status_code}")
            logger.info(f"🚀 Bot Triggered successfully for match: {match_id}")
        except Exception as e:
            print(f"DEBUG: CRITICAL BOT TRIGGER FAILURE: {e}")
            logger.error(f"⚠️ Failed to trigger bot: {e}")