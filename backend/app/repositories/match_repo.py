from app.db.mongodb import db
from bson import ObjectId

class MatchRepository:
    def __init__(self):
        self.collection = db.client.brain_buffer.matches

    async def create_match(self, match_data: dict):
        result = await self.collection.insert_one(match_data)
        match_data["_id"] = str(result.inserted_id)
        return match_data

    async def get_waiting_match(self):
        # Find a match that has Player 1 but no Player 2
        return await self.collection.find_one({"player2_id": None, "is_active": True})

    async def add_player_to_match(self, match_id: str, player2_id: str):
        await self.collection.update_one(
            {"_id": ObjectId(match_id)},
            {"$set": {"player2_id": player2_id, "status": "started"}}
        )
        return await self.collection.find_one({"_id": ObjectId(match_id)})