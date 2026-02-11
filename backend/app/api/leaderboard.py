import json
import logging
import asyncio
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.repositories.user_repo import UserRepository
from app.db.redis import redis_client

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

class LeaderboardResponse(BaseModel):
    top_players: List[Dict[str, Any]]
    global_stats: Dict[str, Any]

def to_str(val):
    if val is None: return ""
    return val.decode("utf-8") if isinstance(val, bytes) else str(val)

@router.get("/stats")
async def get_leaderboard_stats():
    user_repo = UserRepository()
    cache_key = "cache:leaderboard_full"
    loop = asyncio.get_event_loop()
    
    # 1. ⚡ ULTRA-FAST CACHE HIT
    # Offload sync Redis call to a thread to prevent blocking
    cached_result = await loop.run_in_executor(None, redis_client.get, cache_key)
    if cached_result:
        return JSONResponse(content=json.loads(cached_result))

    try:
        # 2. Get Top Data from Redis
        top_data = await loop.run_in_executor(None, lambda: redis_client.zrevrange("leaderboard:wins", 0, 9, withscores=True))
        
        # Sync from MongoDB if Redis is empty
        if not top_data:
            cursor = user_repo.collection.find({}, {"username": 1, "total_wins": 1, "wallet_balance": 1}).sort("total_wins", -1).limit(20)
            mongo_users = await cursor.to_list(length=20)
            
            if mongo_users:
                def sync_to_redis():
                    sync_pipe = redis_client.pipeline()
                    for u in mongo_users:
                        u_id = str(u["_id"])
                        sync_pipe.zadd("leaderboard:wins", {u_id: u.get("total_wins", 0)})
                        sync_pipe.setex(f"user:fast_profile:{u_id}", 3600, json.dumps({
                            "username": u.get("username", "Unknown"),
                            "wallet_balance": u.get("wallet_balance", 0)
                        }))
                    sync_pipe.execute()
                await loop.run_in_executor(None, sync_to_redis)
                top_data = await loop.run_in_executor(None, lambda: redis_client.zrevrange("leaderboard:wins", 0, 9, withscores=True))

        # 🚀 3. BATCH FETCH PROFILES (MGET)
        # Reduces network round-trips to Upstash from 10+ down to just 1
        u_id_strs = [to_str(user_id) for user_id, _ in top_data]
        profile_keys = [f"user:fast_profile:{uid}" for uid in u_id_strs]
        
        cached_profiles = await loop.run_in_executor(None, redis_client.mget, profile_keys)
        
        top_players = []
        for i, (user_id, wins) in enumerate(top_data):
            u_id_str = u_id_strs[i]
            profile_raw = cached_profiles[i] if i < len(cached_profiles) else None
            
            if profile_raw:
                p_data = json.loads(profile_raw)
                name, balance = p_data["username"], p_data["wallet_balance"]
            else:
                user_data = await user_repo.get_by_id(u_id_str)
                name = user_data.get("username", "Unknown") if user_data else "Unknown"
                balance = user_data.get("wallet_balance", 0) if user_data else 0

            top_players.append({
                "rank": i + 1,
                "username": name,
                "total_wins": int(wins),
                "wallet_balance": float(balance)
            })

        # 🚀 4. CALCULATE SYSTEM LIQUIDITY (Hardened against IndexError)
        db = user_repo.collection.database
        pipeline = [{"$group": {"_id": None, "total": {"$sum": "$wallet_balance"}}}]
        
        user_res = await db["users"].aggregate(pipeline).to_list(1)
        
        # Safe extraction: Check if list has items before accessing index 0
        liquidity_val = user_res[0].get("total", 0) if user_res and len(user_res) > 0 else 0

        # 5. ASSEMBLE FINAL RESPONSE
        final_response = {
            "top_players": top_players,
            "global_stats": {
                "total_pool": liquidity_val,
                "system_liquidity": liquidity_val,
                "currency": "PKR",
                "active_players": len(top_players)
            }
        }

        # Cache final result to protect Upstash quota limits
        await loop.run_in_executor(None, lambda: redis_client.set(cache_key, json.dumps(final_response), ex=300))
        
        return final_response

    except Exception as e:
        logger.error(f"Leaderboard Critical Error: {str(e)}")
        # Provide more detail for debugging during development
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")