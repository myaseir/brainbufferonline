from upstash_redis import Redis
from app.core.config import settings
import logging

logger = logging.getLogger("uvicorn.error")

# Initialize Upstash Redis Client
redis_client = Redis(
    url=settings.UPSTASH_REDIS_REST_URL, 
    token=settings.UPSTASH_REDIS_REST_TOKEN
)

# --- LUA SCRIPT FOR ATOMIC MATCHMAKING ---
# This script ensures that finding an opponent and removing them is ONE action.
MATCH_LUA_SCRIPT = """
local pool_key = KEYS[1]
local user_id = ARGV[1]

-- 1. Try to find a random opponent from the pool
local opponent = redis.call('SRANDMEMBER', pool_key)

if opponent then
    if opponent ~= user_id then
        -- Successfully found an opponent! Remove them and return ID
        redis.call('SREM', pool_key, opponent)
        return opponent
    else
        -- We picked ourselves. Ensure we are in the pool and return WAITING.
        redis.call('SADD', pool_key, user_id)
        return "WAITING"
    end
end

-- 2. Pool was empty, add ourselves and wait
redis.call('SADD', pool_key, user_id)
return "WAITING"
"""

class RedisManager:
    @staticmethod
    def get_client():
        return redis_client

    @staticmethod
    async def set_player_online(user_id: str):
        redis_client.set(f"online:{user_id}", "true", ex=60)

    @staticmethod
    async def is_player_online(user_id: str) -> bool:
        return redis_client.exists(f"online:{user_id}") == 1

    @staticmethod
    async def try_match_or_join(user_id: str):
        """
        ATOMIC: Tries to find an opponent. 
        Returns opponent_id (str) if matched, or "WAITING" if added to pool.
        """
        try:
            # Upstash .eval() takes (script, keys, args)
            result = redis_client.eval(MATCH_LUA_SCRIPT, ["matchmaking_pool"], [user_id])
            return result
        except Exception as e:
            logger.error(f"Lua Matchmaking Error: {e}")
            return "WAITING"

    @staticmethod
    async def remove_from_matchmaking(user_id: str):
        """Removes a player from the pool (used for cleanup/cancellation)."""
        return redis_client.srem("matchmaking_pool", user_id)

    @staticmethod
    async def store_match_state(match_id: str, data: dict):
        # Using hset with a dictionary works well for storing match metadata
        # which the Bot Service will poll to detect new games.
        redis_client.hset(f"match:{match_id}", values=data)
        redis_client.expire(f"match:{match_id}", 3600)

# Create a singleton instance
redis_mgr = RedisManager()