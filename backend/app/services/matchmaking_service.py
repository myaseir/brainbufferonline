import uuid
import json
from datetime import datetime, timezone
from fastapi import HTTPException
from app.repositories.match_repo import MatchRepository
from app.repositories.user_repo import UserRepository
from app.db.redis import redis_client

class MatchmakingService:
    def __init__(self):
        self.match_repo = MatchRepository()
        self.user_repo = UserRepository()

    async def find_or_create_match(self, user_id: str):
        # 1. 💰 Wallet Check
        user = await self.user_repo.get_by_id(user_id)
        if not user or user.get("wallet_balance", 0) < 50:
            raise HTTPException(status_code=400, detail="Insufficient funds")

        # 2. 🕵️ Check if user is already in the pool
        # Using a List (LPOP/RPUSH) is more reliable for queues than a Set (SPOP)
        is_in_pool = redis_client.sismember("matchmaking_pool", user_id)
        if is_in_pool:
            return {"status": "WAITING", "user_id": user_id}

        # 3. 🎲 Try to find an opponent
        opponent_id = redis_client.spop("matchmaking_pool")

        if opponent_id:
            if isinstance(opponent_id, bytes):
                opponent_id = opponent_id.decode('utf-8')

            # --- 🤝 MATCH FOUND! ---
            if opponent_id == str(user_id):
                redis_client.sadd("matchmaking_pool", user_id)
                return {"status": "WAITING"}

            # --- ✅ SUCCESS: CREATE THE MATCH ---
            match_id = f"match_{uuid.uuid4().hex[:8]}"
            
            # Deduct fee from the player who JUST joined to trigger the match
            await self.user_repo.update_wallet(user_id, -50.0)

            # Create record in MongoDB
            await self.match_repo.create_match_record(match_id, opponent_id, user_id, 50.0)
            
            # 🚀 SYNC FIX: Use the 'notify:' prefix to match your WebSocket loop
            # This is why you were likely stuck—the WebSocket was looking for 'notify:'
            # while this file was setting 'match_notif:'
            redis_client.set(f"notify:{opponent_id}", match_id, ex=30)
            
            return {
                "status": "MATCHED",
                "match_id": match_id,
                "opponent_id": opponent_id,
                "entry_fee": 50.0
            }

        else:
            # --- ⏳ JOIN THE POOL ---
            # Deduct upfront to "lock" the player in
            await self.user_repo.update_wallet(user_id, -50.0)
            redis_client.sadd("matchmaking_pool", user_id)
            
            return {"status": "WAITING", "user_id": user_id}

    async def check_notif(self, user_id: str):
        """Helper for HTTP polling if not using WebSockets for everything."""
        notif = redis_client.get(f"notify:{user_id}")
        if notif:
            redis_client.delete(f"notify:{user_id}")
            return notif.decode() if isinstance(notif, bytes) else notif
        return None

    async def cancel_matchmaking(self, user_id: str):
        """Refunds the user and removes them from the pool."""
        removed = redis_client.srem("matchmaking_pool", user_id)
        if removed:
            # Refund the 50 PKR locked during join
            await self.user_repo.update_wallet(user_id, 50.0)
        return {"status": "cancelled"}