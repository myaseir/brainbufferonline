from app.db.mongodb import db
from app.db.redis import redis_client
from bson import ObjectId
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger("uvicorn.error")

class MatchRepository:
    def __init__(self):
        pass

    # --- 🛡️ SAFETY HELPER ---
    def _to_id(self, id_val):
        """
        Converts to ObjectId only if it's a valid 24-char hex string.
        Returns the original string if it's a Bot ID (e.g., 'BOT_001').
        """
        if not id_val:
            return None
        id_str = str(id_val)
        if ObjectId.is_valid(id_str):
            return ObjectId(id_str)
        return id_str

    @property
    def collection(self):
        """Lazy-loading to ensure db.db is initialized."""
        if db.db is None:
            raise ConnectionError("MongoDB not initialized. Call connect_to_mongo() first.")
        return db.db.matches 

    async def create_match_record(self, match_id: str, p1_id: str, p2_id: str, stake: float):
        # ✅ FIX: Using _to_id for player IDs to prevent BOT_XXX crashes
        match_doc = {
            "match_id": match_id,
            "player1_id": self._to_id(p1_id),
            "player2_id": self._to_id(p2_id),
            "stake": stake,
            "status": "ongoing",
            "created_at": datetime.now(timezone.utc)
        }
        await self.collection.insert_one(match_doc)
        return match_id

    async def finalize_match(self, match_id: str, winner_id: str, scores: dict):
        # ✅ FIX: Using _to_id for winner_id
        await self.collection.update_one(
            {"match_id": match_id},
            {
                "$set": {
                    "status": "completed",
                    "winner_id": self._to_id(winner_id) if winner_id and winner_id != "DRAW" else None,
                    "scores": scores,
                    "finished_at": datetime.now(timezone.utc)
                }
            }
        )

    # --- 🚀 SCALABLE REDIS MATCHMAKING HELPERS ---

    async def push_to_queue(self, user_id: str):
        redis_client.sadd("matchmaking_pool", str(user_id))

    async def pop_match_pair(self):
        players = redis_client.spop("matchmaking_pool", count=2)
        if players:
            return [p.decode() if isinstance(p, bytes) else str(p) for p in players]
        return None

    async def cleanup_queue(self, user_id: str):
        redis_client.srem("matchmaking_pool", str(user_id))