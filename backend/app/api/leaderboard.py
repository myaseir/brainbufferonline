import json
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from redis import asyncio as aioredis  # Async client is mandatory for efficiency

from app.repositories.user_repo import UserRepository
from app.db.redis import redis_client # Ensure this is initialized as an async client

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

class LeaderboardResponse(BaseModel):
    top_players: List[Dict[str, Any]]
    global_stats: Dict[str, Any]

@router.get("/stats")
async def get_leaderboard_stats():
    user_repo = UserRepository()
    cache_key = "cache:leaderboard_full"
    
    # 1. Instant Cache Return: Bypasses DB, Redis Logic, and Pydantic Validation
    cached_result = await redis_client.get(cache_key)
    if cached_result:
        return JSONResponse(content=json.loads(cached_result))

    try:
        # 2. Get Top 10 IDs (Awaited/Non-blocking)
        top_data = await redis_client.zrevrange("leaderboard:wins", 0, 9, withscores=True)
        
        # 🔄 Rare Event: Syncing Redis from MongoDB
        if not top_data:
            cursor = user_repo.collection.find({}, {"username": 1, "total_wins": 1, "wallet_balance": 1}).sort("total_wins", -1).limit(20)
            mongo_users = await cursor.to_list(length=20)
            
            if mongo_users:
                async with redis_client.pipeline(transaction=True) as pipe:
                    for u in mongo_users:
                        u_id = str(u["_id"])
                        await pipe.zadd("leaderboard:wins", {u_id: u.get("total_wins", 0)})
                        await pipe.setex(f"user:fast_profile:{u_id}", 3600, json.dumps({
                            "username": u.get("username", "Unknown"),
                            "wallet_balance": u.get("wallet_balance", 0)
                        }))
                    await pipe.execute()
                top_data = await redis_client.zrevrange("leaderboard:wins", 0, 9, withscores=True)

        # ⚡ 3. ULTRA-EFFICIENCY: Batch fetch all profiles in ONE round-trip
        u_id_strs = [u_id.decode("utf-8") if isinstance(u_id, bytes) else str(u_id) for u_id, _ in top_data]
        profile_keys = [f"user:fast_profile:{uid}" for uid in u_id_strs]
        cached_profiles = await redis_client.mget(profile_keys)
        
        top_players = []
        for i, (u_id_str, wins) in enumerate(top_data):
            profile_raw = cached_profiles[i]
            if profile_raw:
                p_data = json.loads(profile_raw)
                name, balance = p_data["username"], p_data["wallet_balance"]
            else:
                # Minimal Fallback
                user_data = await user_repo.get_by_id(u_id_strs[i])
                name = user_data.get("username", "Unknown") if user_data else "Unknown"
                balance = user_data.get("wallet_balance", 0) if user_data else 0

            top_players.append({
                "rank": i + 1,
                "username": name,
                "total_wins": int(wins),
                "wallet_balance": float(balance)
            })

        # 4. Global Liquidity (Awaited)
        db = user_repo.collection.database
        user_res = await db["users"].aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$wallet_balance"}}}
        ]).to_list(1)
        liquidity_val = user_res[0]["total"] if user_res else 0

        final_response = {
            "top_players": top_players,
            "global_stats": {
                "total_pool": liquidity_val,
                "system_liquidity": liquidity_val,
                "currency": "PKR",
                "active_players": len(top_players)
            }
        }

        # 5. Set Cache for 5 Minutes
        await redis_client.set(cache_key, json.dumps(final_response), ex=300) 
        return final_response

    except Exception as e:
        logger.error(f"Leaderboard Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")