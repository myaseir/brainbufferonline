from app.db.mongodb import db
from app.db.redis import redis_client
from bson import ObjectId
import json
from datetime import datetime, timezone

class MatchRepository:
    def __init__(self):
        pass

    @property
    def collection(self):
        """Lazy-loading to ensure db.db is initialized."""
        if db.db is None:
            raise ConnectionError("MongoDB not initialized. Call connect_to_mongo() first.")
        return db.db.matches 

    async def create_match_record(self, match_id: str, p1_id: str, p2_id: str, stake: float):
        match_doc = {
            "match_id": match_id,
            "player1_id": ObjectId(p1_id),
            "player2_id": ObjectId(p2_id),
            "stake": stake,
            "status": "ongoing",
            "created_at": datetime.now(timezone.utc)
        }
        await self.collection.insert_one(match_doc)
        return match_id

    async def finalize_match(self, match_id: str, winner_id: str, scores: dict):
        # Ensure scores are JSON serializable
        await self.collection.update_one(
            {"match_id": match_id},
            {
                "$set": {
                    "status": "completed",
                    "winner_id": ObjectId(winner_id) if winner_id and winner_id != "DRAW" else None,
                    "scores": scores,
                    "finished_at": datetime.now(timezone.utc)
                }
            }
        )

    # --- 🚀 SCALABLE REDIS MATCHMAKING HELPERS ---

    async def push_to_queue(self, user_id: str):
        """
        🚀 KEY SYNC: Changed 'matchmaking:pool' to 'matchmaking_pool' 
        to match your MatchmakingService.
        """
        redis_client.sadd("matchmaking_pool", str(user_id))

    async def pop_match_pair(self):
        """Atomics pull for two players."""
        players = redis_client.spop("matchmaking_pool", count=2)
        # Standardize to strings immediately for logic elsewhere
        if players:
            return [p.decode() if isinstance(p, bytes) else str(p) for p in players]
        return None

    async def cleanup_queue(self, user_id: str):
        """Removes a player if they disconnect while waiting."""
        redis_client.srem("matchmaking_pool", str(user_id))