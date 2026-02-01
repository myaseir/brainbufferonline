from app.db.mongodb import db
from app.db.redis import redis_client
from bson import ObjectId
from datetime import datetime, timezone

class UserRepository:
    def __init__(self):  # Fixed: Double underscores and proper indentation
        pass

    @property
    def collection(self):
        if db.db is None:
            raise ConnectionError("MongoDB Database not initialized.")
        return db.db.users

    async def get_by_id(self, user_id: str):
        try:
            return await self.collection.find_one({"_id": ObjectId(str(user_id))})
        except Exception:
            return None

    async def get_by_email(self, email: str):
        return await self.collection.find_one({"email": email})

    async def get_by_username(self, username: str):
        return await self.collection.find_one({"username": username})

    async def create_user(self, user_data: dict):
        if "recent_matches" not in user_data:
            user_data["recent_matches"] = []
        result = await self.collection.insert_one(user_data)
        return str(result.inserted_id)

    async def update_wallet(self, user_id: str, amount: float):
        """
        Updates wallet balance. 
        SAFEGUARD: If amount is negative (deduction), it ONLY executes 
        if the user has enough balance.
        """
        query = {"_id": ObjectId(str(user_id))}
        
        # 🛡️ ATOMIC CHECK: Prevent negative balance
        if amount < 0:
            query["wallet_balance"] = {"$gte": abs(amount)}

        result = await self.collection.update_one(
            query,
            {"$inc": {"wallet_balance": amount}}
        )
        
        redis_client.delete("stats:total_pool")
        
        # Returns True if transaction succeeded, False if insufficient funds
        return result.modified_count > 0

    async def record_match_stats(self, user_id: str, is_win: bool):
        u_id_str = str(user_id)
        update_query = {"$inc": {"total_matches": 1}}
        if is_win:
            update_query["$inc"]["total_wins"] = 1
        
        user = await self.collection.find_one_and_update(
            {"_id": ObjectId(u_id_str)},
            update_query,
            return_document=True
        )

        if user:
            total_wins = user.get("total_wins", 0)
            redis_client.zadd("leaderboard:wins", {u_id_str: total_wins})
            redis_client.hset(f"user:profile:{u_id_str}", "username", user["username"])
            redis_client.expire(f"user:profile:{u_id_str}", 3600)
        
        return user

    async def add_match_to_history(self, user_id: str, match_summary: dict):
        if isinstance(match_summary.get("timestamp"), datetime):
            match_summary["timestamp"] = match_summary["timestamp"].isoformat()
        
        if "timestamp" not in match_summary:
            match_summary["timestamp"] = datetime.now(timezone.utc).isoformat()

        return await self.collection.update_one(
            {"_id": ObjectId(str(user_id))},
            {
                "$push": {
                    "recent_matches": {
                        "$each": [match_summary],
                        "$position": 0,
                        "$slice": 20 
                    }
                }
            },
            upsert=True 
        )
    
    async def save_match_result(
        self, 
        match_id: str, 
        user_id: str, 
        opponent_id: str, 
        result: str, 
        my_score: int, 
        op_score: int
    ):
        """
        Finalizes the match in MongoDB.
        'result' is relative to user_id (WON, LOST, DRAW, OPPONENT_FLED)
        """
        try:
            # 🚀 DEBUG: Log that the method is called
            print(f"DEBUG: save_match_result called for match {match_id}, user {user_id}, result {result}")

            # 1. Determine local results for both players
            is_draw = result == "DRAW"
            
            # Winner logic
            winner_id = None
            loser_id = None
            
            if result in ["WON", "OPPONENT_FLED"]:
                winner_id = user_id
                loser_id = opponent_id
            elif result == "LOST":
                winner_id = opponent_id
                loser_id = user_id

            # 2. Update Wallets & Stats
            if is_draw:
                # Both get 50.0 back
                await self.update_wallet(user_id, 50.0)
                await self.update_wallet(opponent_id, 50.0)
                print(f"DEBUG: Draw - Refunded {user_id} and {opponent_id}")
                # Increment match count for both
                await self.record_match_stats(user_id, is_win=False)
                await self.record_match_stats(opponent_id, is_win=False)
            else:
                # Winner gets 90.0
                await self.update_wallet(winner_id, 90.0)
                print(f"DEBUG: Win - Paid {winner_id} +90")
                # Record stats (is_win=True for winner, False for loser)
                await self.record_match_stats(winner_id, is_win=True)
                await self.record_match_stats(loser_id, is_win=False)

            # 3. Add to Match History (Recent Matches)
            # Get usernames for the history record
            u1 = await self.get_by_id(user_id)
            u2 = await self.get_by_id(opponent_id)
            
            name1 = u1.get("username", "Unknown") if u1 else "Unknown"
            name2 = u2.get("username", "Unknown") if u2 else "Unknown"

            timestamp = datetime.now(timezone.utc).isoformat()

            # Record for User 1
            await self.add_match_to_history(user_id, {
                "match_id": match_id,
                "opponent_name": name2,
                "result": "WON" if winner_id == user_id else ("DRAW" if is_draw else "LOST"),
                "score": f"{my_score} - {op_score}",
                "timestamp": timestamp
            })

            # Record for User 2 (Opponent)
            await self.add_match_to_history(opponent_id, {
                "match_id": match_id,
                "opponent_name": name1,
                "result": "WON" if winner_id == opponent_id else ("DRAW" if is_draw else "LOST"),
                "score": f"{op_score} - {my_score}",
                "timestamp": timestamp
            })

            print(f"DEBUG: Match result saved successfully for {match_id}")
            return True
        except Exception as e:
            # Log the error so we don't lose track of money
            print(f"CRITICAL ERROR in save_match_result: {e}")
            return False