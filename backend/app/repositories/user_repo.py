from app.db.mongodb import db
from bson import ObjectId, errors
from typing import Optional
from datetime import datetime, timezone

class UserRepository:
    def __init__(self):
        pass

    @property
    def collection(self):
        if db.db is None:
            raise ConnectionError("MongoDB 'brain_buffer' not initialized.")
        return db.db.users

    # --- 🔍 FETCH METHODS ---

    async def get_by_email(self, email: str) -> Optional[dict]:
        return await self.collection.find_one({"email": email})

    async def get_by_username(self, username: str) -> Optional[dict]:
        """✅ Fixes the AttributeError in auth_service"""
        return await self.collection.find_one({"username": username})

    async def get_by_id(self, user_id: str) -> Optional[dict]:
        try:
            return await self.collection.find_one({"_id": ObjectId(user_id)})
        except errors.InvalidId:
            return None

    # --- ✍️ WRITE METHODS ---

    async def create_user(self, user_data: dict) -> str:
        """Handles new user insertion during signup verification"""
        user_data.setdefault("wallet_balance", 0.0)
        user_data.setdefault("total_wins", 0)
        user_data.setdefault("total_matches", 0)
        user_data.setdefault("recent_matches", [])
        user_data.setdefault("created_at", datetime.now(timezone.utc))
        
        result = await self.collection.insert_one(user_data)
        return str(result.inserted_id)

    async def update_wallet(self, user_id: str, amount: float) -> bool:
        try:
            clean_amount = round(float(amount), 2)
            query = {"_id": ObjectId(user_id)}
            if clean_amount < 0:
                query["wallet_balance"] = {"$gte": abs(clean_amount)}

            result = await self.collection.update_one(
                query,
                {"$inc": {"wallet_balance": clean_amount}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"❌ Wallet Update Error: {e}")
            return False

    # --- 📊 STATS & HISTORY METHODS ---

    async def record_match_stats(self, user_id: str, is_win: bool):
        """Updates total games played and total wins"""
        try:
            update_data = {"$inc": {"total_matches": 1}}
            if is_win:
                update_data["$inc"]["total_wins"] = 1
            
            await self.collection.update_one({"_id": ObjectId(user_id)}, update_data)
        except Exception as e:
            print(f"❌ Stats Update Error: {e}")

    async def add_match_to_history(self, user_id: str, match_entry: dict):
        """Pushes match result to history array with a 10-item limit"""
        try:
            await self.collection.update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$push": {
                        "recent_matches": {
                            "$each": [match_entry],
                            "$position": 0,
                            "$slice": 10
                        }
                    }
                }
            )
        except Exception as e:
            print(f"❌ History Push Error: {e}")