from datetime import datetime, time, timezone
from app.repositories.user_repo import UserRepository
from bson import ObjectId

class RevenueService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.history = self.user_repo.collection.database["match_history"]

    async def get_daily_stats(self):
        # Define start and end of today in UTC
        today_start = datetime.combine(datetime.now(timezone.utc), time.min).replace(tzinfo=timezone.utc)
        
        # Aggregate stats from match_history
        pipeline = [
            {"$match": {"timestamp": {"$gte": today_start}}},
            {
                "$group": {
                    "_id": None,
                    "total_matches": {"$sum": 1},
                    "draws": {"$sum": {"$cond": [{"$eq": ["$winner_id", "DRAW"]}, 1, 0]}},
                    # Each match has 2 players paying 50 = 100 total
                    "total_collected": {"$sum": 100.0}, 
                    # Each non-draw match pays out 90. Draws pay out 100 (50+50)
                    "total_payout": {
                        "$sum": {
                            "$cond": [{"$eq": ["$winner_id", "DRAW"]}, 100.0, 90.0]
                        }
                    }
                }
            }
        ]
        
        results = await self.history.aggregate(pipeline).to_list(length=1)
        
        if not results:
            return {"matches": 0, "revenue": 0.0, "profit": 0.0}
        
        data = results[0]
        return {
            "total_matches": data["total_matches"],
            "draws": data["draws"],
            "total_collected": data["total_collected"],
            "total_payout": data["total_payout"],
            "net_profit": data["total_collected"] - data["total_payout"]
        }