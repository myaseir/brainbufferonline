from typing import Optional
from app.core.security import decode_access_token
from app.db.redis import redis_client

async def get_user_from_token(token: str) -> Optional[str]:
    try:
        payload = decode_access_token(token)
        return payload.get("sub") if payload else None
    except:
        return None

async def redis_lock_user(user_id: str) -> bool:
    return redis_client.set(f"lock:user:{user_id}", "locked", ex=10, nx=True) == 1

async def redis_release_lock(user_id: str):
    redis_client.delete(f"lock:user:{user_id}")