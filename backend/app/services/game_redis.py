import os
import logging
from typing import Optional
from app.core.security import decode_access_token
from app.db.redis import redis_client

logger = logging.getLogger("uvicorn.error")

async def get_user_from_token(token: str, bot_id: Optional[str] = None) -> Optional[str]:
    # 🔥 FIX: Load inside the function to ensure .env is ready
    master_secret = os.getenv("SECRET_KEY", "697b11d212267043f3c25731697b392a0a7f2c914a954987")
    
    # 1. Clean the strings
    clean_token = str(token).strip().replace('"', '').replace("'", "")
    clean_secret = str(master_secret).strip().replace('"', '').replace("'", "")

    # 🤖 1. BOT BYPASS LOGIC
    if clean_token == clean_secret:
        logger.info(f"🤖 Bot Service Verified: {bot_id}")
        return bot_id if bot_id else "BOT_001"

    # 👤 2. HUMAN JWT LOGIC
    try:
        payload = decode_access_token(token)
        return payload.get("sub") if payload else None
    except Exception as e:
        logger.warning(f"❌ Token Auth Failed: {str(e)}")
        return None

async def redis_lock_user(user_id: str) -> bool:
    # Upstash returns 'OK' for successful SET NX
    res = redis_client.set(f"lock:user:{user_id}", "locked", ex=10, nx=True)
    return res in [True, 1, "OK", "ok"]

async def redis_release_lock(user_id: str):
    redis_client.delete(f"lock:user:{user_id}")