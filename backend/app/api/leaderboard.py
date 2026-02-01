from fastapi import APIRouter, HTTPException
from app.repositories.user_repo import UserRepository
from app.db.redis import redis_client
from typing import List, Dict, Any
from pydantic import BaseModel
import logging
import json # 🚀 Needed for caching

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

class LeaderboardResponse(BaseModel):
    top_players: List[Dict[str, Any]]
    global_stats: Dict[str, Any]

# Helper to handle Upstash strings vs standard bytes
def to_str(val):
    if val is None: return ""
    return val.decode("utf-8") if isinstance(val, bytes) else str(val)

@router.get("/stats", response_model=LeaderboardResponse)
async def get_leaderboard_stats():
    user_repo = UserRepository()
    
    # --- 1. 🚀 GLOBAL CACHE CHECK ---
    # This is the "Magic" fix. It stores the whole finished result for 60 seconds.
    cache_key = "cache:leaderboard_full"
    cached_result = redis_client.get(cache_key)
    if cached_result:
        return json.loads(cached_result)

    try:
        # 2. FETCH TOP DATA
        top_data = redis_client.zrevrange("leaderboard:wins", 0, 9, withscores=True)
        
        if not top_data:
            logger.info("Syncing Top 10 from MongoDB...")
            cursor = user_repo.collection.find({}, {"username": 1, "total_wins": 1}).sort("total_wins", -1).limit(10)
            mongo_users = await cursor.to_list(length=10)
            for u in mongo_users:
                u_id = str(u["_id"])
                redis_client.zadd("leaderboard:wins", {u_id: u.get("total_wins", 0)})
                redis_client.hset(f"user:profile:{u_id}", "username", u.get("username", "Unknown"))
            top_data = redis_client.zrevrange("leaderboard:wins", 0, 9, withscores=True)

        # 3. PROCESS PLAYERS
        top_players = []
        for index, (user_id, wins) in enumerate(top_data):
            u_id_str = to_str(user_id)
            
            # Fetch full user data to get balance (needed for Admin view)
            # Optimization: You can cache the whole profile as a JSON in Redis later
            user_data = await user_repo.get_by_id(u_id_str)
            
            if user_data:
                name = user_data.get("username", "Unknown")
                balance = user_data.get("wallet_balance", 0)
                
                # Update name cache if it was missing
                redis_client.hset(f"user:profile:{u_id_str}", "username", name)
            else:
                name = "Unknown"
                balance = 0

            top_players.append({
                "rank": index + 1,
                "username": name,
                "total_wins": int(wins),
                "wallet_balance": float(balance)
            })

        # 4. ECONOMY STATS
        total_pool = redis_client.get("stats:total_pool")
        if total_pool is None:
            pipeline = [{"$group": {"_id": None, "total": {"$sum": "$wallet_balance"}}}]
            res = await user_repo.collection.aggregate(pipeline).to_list(1)
            total_pool = res[0]["total"] if res else 0
            redis_client.set("stats:total_pool", total_pool, ex=300)
        else:
            total_pool = float(total_pool)

        # 5. ASSEMBLE FINAL DATA
        final_response = {
            "top_players": top_players,
            "global_stats": {
                "total_pool": round(total_pool, 2),
                "currency": "PKR",
                "active_players": len(top_players)
            }
        }

        # --- 6. 💾 SAVE TO GLOBAL CACHE ---
        # Store the entire response as a JSON string for 60 seconds
        redis_client.set(cache_key, json.dumps(final_response), ex=60)

        return final_response

    except Exception as e:
        logger.error(f"Leaderboard Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")