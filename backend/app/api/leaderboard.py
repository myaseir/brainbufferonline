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
    cache_key = "cache:leaderboard_full"
    
    # 1. Check Global Cache (Use await if your client is async!)
    cached_result = redis_client.get(cache_key)
    if cached_result:
        return json.loads(cached_result)

    try:
        # 2. Get Top Data
        top_data = redis_client.zrevrange("leaderboard:wins", 0, 9, withscores=True)
        
        if not top_data:
            logger.info("⚡ Redis Empty: Syncing from MongoDB...")
            cursor = user_repo.collection.find({}, {"username": 1, "total_wins": 1, "wallet_balance": 1}).sort("total_wins", -1).limit(20)
            mongo_users = await cursor.to_list(length=20)
            
            if mongo_users:
                sync_pipe = redis_client.pipeline()
                for u in mongo_users:
                    u_id = str(u["_id"])
                    sync_pipe.zadd("leaderboard:wins", {u_id: u.get("total_wins", 0)})
                    sync_pipe.setex(f"user:fast_profile:{u_id}", 3600, json.dumps({
                        "username": u.get("username", "Unknown"),
                        "wallet_balance": u.get("wallet_balance", 0)
                    }))
                sync_pipe.execute()
                top_data = redis_client.zrevrange("leaderboard:wins", 0, 9, withscores=True)

        # 3. Process Players
        top_players = []
        for index, (user_id, wins) in enumerate(top_data):
            u_id_str = to_str(user_id)
            cached_p = redis_client.get(f"user:fast_profile:{u_id_str}")
            if cached_p:
                p_data = json.loads(cached_p)
                name, balance = p_data["username"], p_data["wallet_balance"]
            else:
                user_data = await user_repo.get_by_id(u_id_str)
                name = user_data.get("username", "Unknown") if user_data else "Unknown"
                balance = user_data.get("wallet_balance", 0) if user_data else 0

            top_players.append({
                "rank": index + 1,
                "username": name,
                "total_wins": int(wins),
                "wallet_balance": float(balance)
            })

        # 🚀 4. CALCULATE SYSTEM LIQUIDITY (Outside the loop!)
        db = user_repo.collection.database
        user_res = await db["users"].aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$wallet_balance"}}}
        ]).to_list(1)
        liquidity_val = user_res[0]["total"] if user_res else 0

        # 5. ASSEMBLE FINAL RESPONSE
        final_response = {
            "top_players": top_players,
            "system_liquidity": liquidity_val, 
            "global_stats": {
                "total_pool": liquidity_val,
                "system_liquidity": liquidity_val,
                "currency": "PKR",
                "active_players": len(top_players)
            }
        }

        # Cache the WHOLE response for 5 minutes (300 seconds)
        redis_client.set(cache_key, json.dumps(final_response), ex=300) 
        return final_response

    except Exception as e:
        logger.error(f"Leaderboard Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Error")