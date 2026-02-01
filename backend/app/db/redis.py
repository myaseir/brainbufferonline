from upstash_redis import Redis
from app.core.config import settings
import logging

logger = logging.getLogger("uvicorn.error")

# Initialize Upstash Redis Client
# This uses HTTP (Port 443), which is firewall-proof and highly scalable
redis_client = Redis(
    url=settings.UPSTASH_REDIS_REST_URL, 
    token=settings.UPSTASH_REDIS_REST_TOKEN
)

class RedisManager:
    @staticmethod
    async def set_player_online(user_id: str):
        """Sets a player as online with a 60-second heartbeat."""
        # We use a prefix 'online:' to keep data organized
        redis_client.set(f"online:{user_id}", "true", ex=60)

    @staticmethod
    async def is_player_online(user_id: str) -> bool:
        """Checks if a player is currently online."""
        return redis_client.exists(f"online:{user_id}") == 1

    @staticmethod
    async def add_to_matchmaking(user_id: str):
        """Adds a player to the global matchmaking pool."""
        redis_client.sadd("matchmaking_pool", user_id)

    @staticmethod
    async def pop_match_pair():
        """Attempts to pull two players for a match (Atomic)."""
        # SPOP pulls random elements and removes them from the set
        # This prevents two servers from picking the same player
        players = redis_client.spop("matchmaking_pool", count=2)
        return players if len(players) == 2 else None

    @staticmethod
    async def store_match_state(match_id: str, data: dict):
        """Stores match data (stakes, players, etc.) in a Hash."""
        # Hashes are perfect for storing objects in Redis
        redis_client.hset(f"match:{match_id}", mapping=data)
        # Set expiry for 1 hour so dead matches don't clog memory
        redis_client.expire(f"match:{match_id}", 3600)

# Create a singleton instance to use across the app
redis_mgr = RedisManager()