from fastapi import APIRouter, Header, HTTPException
from app.db.mongodb import db as mongo_instance
from app.repositories.user_repo import UserRepository
from app.api.game_ws import active_matches 
from datetime import datetime, timezone
import os

router = APIRouter()
user_repo = UserRepository()

# Ensure this matches your .env or a secure default
ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "glacia_admin_2026_safe")

@router.get("/health")
async def get_system_health(x_admin_key: str = Header(None)):
    # 1. Security Check
    if x_admin_key != ADMIN_SECRET_KEY:
        raise HTTPException(
            status_code=403, 
            detail="Forbidden: Invalid Admin Key."
        )

    # 2. Database Connectivity Check via Repository
    try:
        users_collection = user_repo.collection
        total_users = await users_collection.count_documents({})
    except Exception:
        raise HTTPException(status_code=503, detail="Database connection unavailable")
    
    # 3. Real-time Metrics from WebSocket State
    current_active_matches = len(active_matches)
    players_in_game = sum(len(users) for users in active_matches.values())

    return {
        "status": "Healthy",
        "timestamp": datetime.now(timezone.utc),
        "database": {
            "total_registered_users": total_users,
            "connected": True
        },
        "real_time_metrics": {
            "active_matches": current_active_matches,
            "total_players_online": players_in_game,
        },
        "system_info": {
            "version": "1.0.0",
            "platform": "Glacia Connection",
            "environment": os.getenv("ENV", "development")
        }
    }