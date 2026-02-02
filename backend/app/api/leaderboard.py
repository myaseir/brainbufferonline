from fastapi import APIRouter, HTTPException
from app.repositories.user_repo import UserRepository
from app.db.redis import redis_client
from typing import List, Dict, Any
from pydantic import BaseModel
import logging
import json

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

class LeaderboardResponse(BaseModel):
    top_players: List[Dict[str, Any]]
    global_stats: Dict[str, Any]

def to_str(val):
    if val is None: return ""
    return val.decode("utf-8") if isinstance(val, bytes) else str(val)

@router.get("/stats", response_model=LeaderboardResponse)
async def get_leaderboard_stats():
    user_repo = UserRepository()
    
    # --- 1. GLOBAL CACHE CHECK ---
    # Increased to 300s (5 mins) to protect your Upstash Free Tier limits.
    cache_key = "cache:leaderboard_full"
    cached_result = redis_client.get(cache_key)
    if cached_result:
        return json.loads(cached_result)

    try:
        # 2. FETCH TOP DATA (1 Command)
        top_data = redis_client.zrevrange("leaderboard:wins", 0, 9, withscores=True)
        
        # --- SYNC LOGIC (Only runs if Redis is empty) ---
        if not top_data:
            logger.info("Syncing Top 10 from MongoDB...")
            cursor = user_repo.collection.find({}, {"username": 1, "total_wins": 1}).sort("total_wins", -1).limit(10)
            mongo_users = await cursor.to_list(length=10)
            
            # Use a pipeline to sync everything in ONE request
            sync_pipe = redis_client.pipeline()
            for u in mongo_users:
                u_id = str(u["_id"])
                sync_pipe.zadd("leaderboard:wins", {u_id: u.get("total_wins", 0)})
                sync_pipe.hset(f"user:profile:{u_id}", "username", u.get("username", "Unknown"))
            sync_pipe.execute()
            
            top_data = redis_client.zrevrange("leaderboard:wins", 0, 9, withscores=True)

        # 3. PROCESS PLAYERS
        top_players = []
        
        # We fetch from MongoDB inside the loop. 
        # Note: We removed the 'hset' inside this loop to stop unnecessary Write commands.
        for index, (user_id, wins) in enumerate(top_data):
            u_id_str = to_str(user_id)
            user_data = await user_repo.get_by_id(u_id_str)
            
            if user_data:
                name = user_data.get("username", "Unknown")
                balance = user_data.get("wallet_balance", 0)
            else:
                name = "Unknown"
                balance = 0

            top_players.append({
                "rank": index + 1,
                "username": name,
                "total_wins": int(wins),
                "wallet_balance": float(balance)
            })

        # 4. ECONOMY STATS (1 Read Command)
        total_pool = redis_client.get("stats:total_pool")
        if total_pool is None:
            pipeline_mongo = [{"$group": {"_id": None, "total": {"$sum": "$wallet_balance"}}}]
            res = await user_repo.collection.aggregate(pipeline_mongo).to_list(1)
            total_pool = res[0]["total"] if res else 0
            # Set for 10 minutes to save commands
            redis_client.set("stats:total_pool", total_pool, ex=600)
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

        # --- 6. SAVE TO GLOBAL CACHE (1 Write Command) ---
        # Storing for 5 minutes. This means for the next 5 mins, 
        # hits to this endpoint cost 1 READ instead of 15+ commands.
        redis_client.set(cache_key, json.dumps(final_response), ex=900)

        return final_response

    except Exception as e:
        logger.error(f"Leaderboard Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")