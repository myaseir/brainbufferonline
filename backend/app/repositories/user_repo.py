from app.db.mongodb import db
from app.db.redis import redis_client
from bson import ObjectId
from datetime import datetime, timezone
import logging

logger = logging.getLogger("uvicorn.error")

class UserRepository:
    def __init__(self):
        pass

    # --- 🛡️ SAFETY HELPER ---
    def _to_id(self, id_val):
        """
        Converts to ObjectId only if it's a valid 24-char hex string.
        Returns the original string if it's a Bot ID (e.g., 'BOT_001').
        """
        id_str = str(id_val)
        if ObjectId.is_valid(id_str):
            return ObjectId(id_str)
        return id_str

    @property
    def collection(self):
        if db.db is None:
            raise ConnectionError("MongoDB Database not initialized.")
        return db.db.users

    @property
    def matches_collection(self):
        return db.db.matches 

    # --- 🛠️ CORE AUTH METHODS ---

    async def get_by_id(self, user_id: str):
        try:
            # ✅ FIX: Use _to_id to handle both Humans and Bots
            return await self.collection.find_one({"_id": self._to_id(user_id)})
        except Exception as e:
            logger.error(f"Error in get_by_id: {e}")
            return None
        
    async def get_by_email(self, email: str):
        """
        Used by AuthService to find a user by their email during login.
        """
        try:
            user = await self.collection.find_one({"email": email.lower().strip()})
            if user:
                # Ensure the _id is converted to a string for the JWT payload
                user["_id"] = str(user["_id"])
            return user
        except Exception as e:
            logger.error(f"Error fetching user by email: {e}")
            return None
    
    async def create_user(self, user_data: dict):
        """
        Inserts a new user document into MongoDB and returns the new ID.
        """
        try:
            result = await self.collection.insert_one(user_data)
            return result.inserted_id
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise e
    
    async def get_by_username(self, username: str):
        """
        Used by AuthService to find a user by their unique username during login/signup.
        """
        try:
            user = await self.collection.find_one({"username": username.strip()})
            if user:
                user["_id"] = str(user["_id"])
            return user
        except Exception as e:
            logger.error(f"Error fetching user by username: {e}")
            return None

    # --- 💰 WALLET & STATS METHODS ---

    async def update_wallet(self, user_id: str, amount: float, session=None):
        # ✅ FIX: Handle Bot/Human ID safely
        query = {"_id": self._to_id(user_id)}
        if amount < 0:
            query["wallet_balance"] = {"$gte": abs(amount)}

        result = await self.collection.update_one(
            query,
            {"$inc": {"wallet_balance": amount}},
            session=session
        )
        redis_client.delete("stats:total_pool")
        return result.modified_count > 0

    async def record_match_stats(self, user_id: str, is_win: bool, session=None):
        u_id_val = self._to_id(user_id)
        update_query = {"$inc": {"total_matches": 1}}
        if is_win:
            update_query["$inc"]["total_wins"] = 1
        
        user = await self.collection.find_one_and_update(
            {"_id": u_id_val},
            update_query,
            session=session,
            return_document=True
        )

        if user:
            total_wins = user.get("total_wins", 0)
            # ✅ FIX FOR UPSTASH: Use a dictionary for the mapping
            try:
                redis_client.zadd("leaderboard:wins", {str(user_id): total_wins})
            except Exception as e:
                logger.error(f"Leaderboard Update Failed: {e}")
                
            redis_client.delete("cache:leaderboard_full")
        
        return user

    # --- 🚀 MATCH FINALIZATION & PAYOUT ---

    async def process_match_payout(self, match_id: str, winner_id: str, player1_id: str, player2_id: str, p1_score: int, p2_score: int, is_draw: bool = False):
        try:
            match_doc = await self.matches_collection.find_one({"match_id": match_id})
            
            if not match_doc:
                logger.info(f"Creating record for match: {match_id}")
                await self.matches_collection.insert_one({
                    "match_id": match_id,
                    "player1_id": self._to_id(player1_id), # ✅ Safe ID
                    "player2_id": self._to_id(player2_id), # ✅ Safe ID
                    "mode": "challenge",
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc)
                })
            elif match_doc.get("status") == "completed":
                return False

            async with await db.client.start_session() as session:
                async with session.start_transaction():
                    await self.matches_collection.update_one(
                        {"match_id": match_id},
                        {"$set": {
                            "status": "completed",
                            "winner_id": self._to_id(winner_id) if winner_id else None, # ✅ Safe ID
                            "final_scores": {player1_id: p1_score, player2_id: p2_score},
                            "finished_at": datetime.now(timezone.utc)
                        }},
                        session=session
                    )

                    if is_draw:
                        await self.update_wallet(player1_id, 50.0, session=session)
                        await self.update_wallet(player2_id, 50.0, session=session)
                    else:
                        await self.update_wallet(winner_id, 90.0, session=session)

                    await self.record_match_stats(player1_id, is_win=(winner_id == player1_id), session=session)
                    await self.record_match_stats(player2_id, is_win=(winner_id == player2_id), session=session)

                    await self._quick_history_add(player1_id, match_id, player2_id, p1_score, p2_score, winner_id, session)
                    await self._quick_history_add(player2_id, match_id, player1_id, p2_score, p1_score, winner_id, session)

            return True
        except Exception as e:
            logger.error(f"❌ Payout Failure: {e}")
            return False

    async def _quick_history_add(self, user_id, match_id, op_id, my_score, op_score, winner_id, session):
        # ✅ Safe ID check for opponent
        op_user = await self.collection.find_one({"_id": self._to_id(op_id)}, {"username": 1}, session=session)
        op_name = op_user.get("username", "Opponent") if op_user else "Opponent"

        result_str = "DRAW" if not winner_id else ("WON" if str(winner_id) == str(user_id) else "LOST")
        mode = "challenge" if "match_" in str(match_id) else "ranked"

        await self.collection.update_one(
            {"_id": self._to_id(user_id)}, # ✅ Safe ID
            {"$push": {
                "recent_matches": {
                    "$each": [{
                        "match_id": match_id,
                        "opponent_name": op_name,
                        "result": result_str,
                        "score": f"{my_score}-{op_score}",
                        "mode": mode,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }],
                    "$position": 0,
                    "$slice": 20
                }
            }},
            session=session
        )