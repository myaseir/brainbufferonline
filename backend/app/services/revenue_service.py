from datetime import datetime, time, timezone
from app.repositories.user_repo import UserRepository
from app.db.redis import redis_client # 🚀 Shared Cloud Brain
import json

class RevenueService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.history = self.user_repo.collection.database["match_history"]

    async def get_daily_stats(self):
        """
        High-Performance Analytics: 
        Pulls real-time counters from Redis first.
        """
        today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        redis_key = f"stats:revenue:{today_key}"
        
        # 1. Try to get data from Redis Hash
        data = redis_client.hgetall(redis_key)
        
        if data:
            # Redis returns strings, so we convert back to numbers
            return {
                "total_matches": int(data.get("matches", 0)),
                "draws": int(data.get("draws", 0)),
                "total_collected": float(data.get("collected", 0.0)),
                "total_payout": float(data.get("payout", 0.0)),
                "net_profit": float(data.get("profit", 0.0)),
                "source": "cache"
            }

        # 2. Fallback: If Redis is empty (e.g., start of day), use MongoDB
        today_start = datetime.combine(datetime.now(timezone.utc), time.min).replace(tzinfo=timezone.utc)
        
        pipeline = [
            {"$match": {"timestamp": {"$gte": today_start}}},
            {
                "$group": {
                    "_id": None,
                    "total_matches": {"$sum": 1},
                    "draws": {"$sum": {"$cond": [{"$eq": ["$winner_id", "DRAW"]}, 1, 0]}},
                    "total_collected": {"$sum": 100.0}, 
                    "total_payout": {
                        "$sum": {"$cond": [{"$eq": ["$winner_id", "DRAW"]}, 100.0, 90.0]}
                    }
                }
            }
        ]
        
        results = await self.history.aggregate(pipeline).to_list(length=1)
        
        if not results:
            return {"matches": 0, "revenue": 0.0, "profit": 0.0, "source": "db_empty"}
        
        res = results[0]
        net_profit = res["total_collected"] - res["total_payout"]

        # 🚀 3. Sync back to Redis so next request is instant
        redis_client.hset(redis_key, values={
            "matches": res["total_matches"],
            "draws": res["draws"],
            "collected": res["total_collected"],
            "payout": res["total_payout"],
            "profit": net_profit
        })
        redis_client.expire(redis_key, 86400) # Expire after 24 hours

        return {
            "total_matches": res["total_matches"],
            "draws": res["draws"],
            "total_collected": res["total_collected"],
            "total_payout": res["total_payout"],
            "net_profit": net_profit,
            "source": "db_sync"
        }