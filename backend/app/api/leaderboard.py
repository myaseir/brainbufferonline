from fastapi import APIRouter, HTTPException
from app.db.mongodb import db
from app.repositories.user_repo import UserRepository
from typing import List, Dict, Any
from pydantic import BaseModel

router = APIRouter()
user_repo = UserRepository()

class LeaderboardResponse(BaseModel):
    top_players: List[Dict[str, Any]]
    global_stats: Dict[str, Any]

@router.get("/stats", response_model=LeaderboardResponse)
async def get_leaderboard_stats():
    """
    Fetches the top 10 players and calculates the total economy pool.
    """
    # Use the repository's property to get the active collection
    try:
        users_collection = user_repo.collection
    except ConnectionError:
        return {
            "top_players": [], 
            "global_stats": {"total_pool": 0, "currency": "PKR"}
        }

    # 1. Fetch Top 10 Players
    # We project only the necessary fields for the leaderboard
    cursor = users_collection.find(
        {}, 
        {"username": 1, "total_wins": 1, "wallet_balance": 1, "_id": 0}
    ).sort("total_wins", -1).limit(10)
    
    top_players = await cursor.to_list(length=10)

    # 2. Calculate Global Total Pool using MongoDB Aggregation
    pipeline = [
        {"$group": {"_id": None, "total_pool": {"$sum": "$wallet_balance"}}}
    ]
    
    stats_result = await users_collection.aggregate(pipeline).to_list(length=1)
    total_pool = stats_result[0]["total_pool"] if stats_result else 0

    return {
        "top_players": top_players,
        "global_stats": {
            "total_pool": round(total_pool, 2),
            "currency": "PKR"
        }
    }