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
        
    async def get_by_referral_code(self, code: str):
        """
        Finds a user by their unique referral code and ensures ID serialization.
        """
        try:
            user = await self.collection.find_one({"referral_code": code.upper().strip()})
            if user:
                # Convert ObjectIds to strings so FastAPI can serialize them to JSON
                user["_id"] = str(user["_id"])
                if user.get("referred_by"):
                    user["referred_by"] = str(user["referred_by"])
            return user
        except Exception as e:
            logger.error(f"Error fetching user by referral code: {e}")
            return None
    
    async def apply_referral_bonus(self, downloader_id: str, giver_id: str, amount: float):
        """
        Atomically rewards both the new user and the referrer using a MongoDB transaction.
        """
        try:
            # start_session is a synchronous call in Motor, though the session itself is used in async contexts
            async with await db.client.start_session() as session:
                async with session.start_transaction():
                    # 1. Update the Giver (Referrer)
                    await self.update_wallet(giver_id, amount, session=session)
                    
                    # 2. Update the Downloader (New User) and mark them as referred
                    await self.collection.update_one(
                        {"_id": self._to_id(downloader_id)},
                        {
                            "$inc": {"wallet_balance": amount},
                            "$set": {"referred_by": self._to_id(giver_id)}
                        },
                        session=session
                    )
            
            # Clear stats cache as the total system pool has changed
            redis_client.delete("stats:total_pool")
            return True
            
        except Exception as e:
            logger.error(f"❌ Referral Transaction Failed: {e}")
            return False
    async def get_referral_leaderboard(self, skip: int = 0, limit: int = 10):
        """
        Groups users by who referred them, counts them, and joins with user details.
        Handles string/ObjectId conversion to prevent 500 errors.
        """
        pipeline = [
            # 1. Match only users who have been referred
            {"$match": {"referred_by": {"$ne": None}}}, 
            
            # 2. Group by the Referrer ID and count referrals
            {"$group": {
                "_id": "$referred_by", 
                "referral_count": {"$sum": 1}
            }},

            # 3. Convert ID string to ObjectId for the join stage
            {"$addFields": {
                "referrer_oid": {
                    "$cond": [
                        {"$eq": [{"$type": "$_id"}, "string"]},
                        {"$toObjectId": "$_id"},
                        "$_id"
                    ]
                }
            }},
            
            # 4. Sort by count, Skip, and Limit (Pagination)
            {"$sort": {"referral_count": -1}}, 
            {"$skip": skip},
            {"$limit": limit},
            
            # 5. Join with the 'users' collection
            {"$lookup": {
                "from": "users",
                "localField": "referrer_oid",
                "foreignField": "_id",
                "as": "user_info"
            }},
            
            # 6. Flatten user_info (preserves document even if lookup fails)
            {"$unwind": {
                "path": "$user_info",
                "preserveNullAndEmptyArrays": False 
            }},
            
            # 7. Final Projection for Admin UI
            {"$project": {
                "_id": {"$toString": "$user_info._id"},
                "username": "$user_info.username",
                "email": "$user_info.email",
                "referral_count": 1,
                "total_earned": {"$multiply": ["$referral_count", 100.0]}
            }}
        ]
        
        try:
            # Execute aggregation
            cursor = self.collection.aggregate(pipeline)
            results = await cursor.to_list(length=limit)
            return results
        except Exception as e:
            # Logs will now show up in your uvicorn terminal
            logger.error(f"CRITICAL ERROR in referral leaderboard: {str(e)}")
            return []
        
    async def get_all_users(self, page: int = 1, limit: int = 10, search: str = ""):
        """
        Supports UserTable.tsx with pagination and search.
        Returns (users_list, total_pages)
        """
        skip = (page - 1) * limit
        query = {}
        
        if search:
            query = {
                "$or": [
                    {"username": {"$regex": search, "$options": "i"}},
                    {"email": {"$regex": search, "$options": "i"}}
                ]
            }

        try:
            total_count = await self.collection.count_documents(query)
            total_pages = (total_count + limit - 1) // limit

            cursor = self.collection.find(query).skip(skip).limit(limit)
            users = await cursor.to_list(length=limit)

            # ✅ THE FIX: Manually convert ObjectId to string for every user
            for u in users:
                u["_id"] = str(u["_id"])
                # Also handle 'referred_by' if it exists and is an ObjectId
                if u.get("referred_by"):
                    u["referred_by"] = str(u["referred_by"])
            
            return users, total_pages
        except Exception as e:
            logger.error(f"Error fetching users: {e}")
            return [], 1

    async def get_referral_leaderboard(self, skip: int = 0, limit: int = 10):
        """
        Updates the existing leaderboard method to ensure robust ID handling 
        and matching the field names expected by ReferralLeaderboard.jsx
        """
        pipeline = [
            {"$match": {"referred_by": {"$ne": None}}}, 
            {"$group": {
                "_id": "$referred_by", 
                "referral_count": {"$sum": 1}
            }},
            {"$addFields": {
                "referrer_oid": {
                    "$cond": [
                        {"$eq": [{"$type": "$_id"}, "string"]},
                        {"$toObjectId": "$_id"},
                        "$_id"
                    ]
                }
            }},
            {"$sort": {"referral_count": -1}}, 
            {"$skip": skip},
            {"$limit": limit},
            {"$lookup": {
                "from": "users",
                "localField": "referrer_oid",
                "foreignField": "_id",
                "as": "user_info"
            }},
            {"$unwind": "$user_info"},
            {"$project": {
                "_id": {"$toString": "$user_info._id"},
                "username": "$user_info.username",
                "email": "$user_info.email",
                "referral_count": 1,
                # Assuming 100 PKR per referral bonus
                "total_earned": {"$multiply": ["$referral_count", 100]}
            }}
        ]
        
        try:
            cursor = self.collection.aggregate(pipeline)
            return await cursor.to_list(length=limit)
        except Exception as e:
            logger.error(f"Referral Leaderboard Error: {e}")
            return []
    
