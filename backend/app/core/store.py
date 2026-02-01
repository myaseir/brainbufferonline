from upstash_redis.asyncio import Redis
from app.core.config import settings

# --- 🚀 SCALABLE REDIS CLIENT ---
# This replaces the local variables: connected_matchmaking_users, active_matches, user_locks
# We use the 'asyncio' version for better performance in FastAPI
redis = Redis(
    url=settings.UPSTASH_REDIS_REST_URL,
    token=settings.UPSTASH_REDIS_REST_TOKEN
)

# --- 📝 REDIS KEY DOCUMENTATION ---
# Instead of Python variables, we now use these Redis keys:
#
# 1. Matchmaking Queue (Set): 
#    Key: "matchmaking:pool"
#    Command: redis.sadd("matchmaking:pool", user_id)
#
# 2. Active Matches (Hash): 
#    Key: "match:active:{match_id}"
#    Command: redis.hset(f"match:active:{match_id}", mapping=match_data)
#
# 3. User Locks (String with TTL): 
#    Key: "lock:user:{user_id}"
#    Command: redis.set(f"lock:user:{user_id}", "locked", ex=10, nx=True)