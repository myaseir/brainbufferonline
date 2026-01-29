from app.db.mongodb import db
from bson import ObjectId, errors
from typing import Optional

class UserRepository:
    def __init__(self):
        pass

    @property
    def collection(self):
        """
        Refined to use the db.db instance we initialized in mongodb.py.
        """
        if db.db is None:
            raise ConnectionError("MongoDB database 'brain_buffer' is not initialized. Ensure connect_to_mongo() has run.")
        return db.db.users

    async def get_by_email(self, email: str) -> Optional[dict]:
        return await self.collection.find_one({"email": email})

    async def get_by_username(self, username: str) -> Optional[dict]:
        return await self.collection.find_one({"username": username})

    async def get_by_id(self, user_id: str) -> Optional[dict]:
        try:
            return await self.collection.find_one({"_id": ObjectId(user_id)})
        except errors.InvalidId:
            return None

    async def create_user(self, user_data: dict) -> str:
        result = await self.collection.insert_one(user_data)
        return str(result.inserted_id)

    async def update_wallet(self, user_id: str, amount: float):
        try:
            await self.collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$inc": {"wallet_balance": amount}}
            )
        except errors.InvalidId:
            print(f"❌ Failed to update wallet: Invalid User ID {user_id}")

    async def increment_wins(self, user_id: str):
        try:
            await self.collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$inc": {"total_wins": 1}}
            )
        except errors.InvalidId:
            print(f"❌ Failed to increment wins: Invalid User ID {user_id}")