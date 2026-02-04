from app.db.mongodb import db
from app.db.redis import redis_client
from bson import ObjectId
from datetime import datetime, timezone
import logging

logger = logging.getLogger("uvicorn.error")

class UserRepository:
    def __init__(self):
        pass

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

    # --- 💰 WALLET & STATS METHODS ---

    async def update_wallet(self, user_id: str, amount: float, session=None):
        query = {"_id": ObjectId(str(user_id))}
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
        u_id_str = str(user_id)
        update_query = {"$inc": {"total_matches": 1}}
        if is_win:
            update_query["$inc"]["total_wins"] = 1
        
        user = await self.collection.find_one_and_update(
            {"_id": ObjectId(u_id_str)},
            update_query,
            session=session,
            return_document=True
        )

        if user:
            total_wins = user.get("total_wins", 0)
            redis_client.zadd("leaderboard:wins", {u_id_str: total_wins})
            redis_client.delete("cache:leaderboard_full")
        
        return user

    # --- 🚀 MATCH FINALIZATION & PAYOUT (FIXED FOR OPTION B) ---

    async def process_match_payout(
        self, 
        match_id: str, 
        winner_id: str, 
        player1_id: str, 
        player2_id: str, 
        p1_score: int, 
        p2_score: int,
        is_draw: bool = False
    ):
        """
        🚀 SECURE TRANSACTION: Handles Payouts and History for both Ranked and Challenge matches.
        """
        try:
            # 1. UPSERT Match Record: Create it if it doesn't exist (Fix for Friendly Matches)
            match_doc = await self.matches_collection.find_one({"match_id": match_id})
            
            if not match_doc:
                logger.info(f"Creating on-the-fly match record for Friendly Battle: {match_id}")
                await self.matches_collection.insert_one({
                    "match_id": match_id,
                    "player1_id": ObjectId(player1_id),
                    "player2_id": ObjectId(player2_id),
                    "mode": "challenge", # Identify as Friendly
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc)
                })
            elif match_doc.get("status") == "completed":
                logger.warning(f"Match {match_id} already finalized.")
                return False

            # 2. Start Atomic Transaction
            async with await db.client.start_session() as session:
                async with session.start_transaction():
                    
                    # A. Lock the match record to COMPLETED
                    await self.matches_collection.update_one(
                        {"match_id": match_id},
                        {"$set": {
                            "status": "completed",
                            "winner_id": ObjectId(winner_id) if winner_id else None,
                            "final_scores": {player1_id: p1_score, player2_id: p2_score},
                            "finished_at": datetime.now(timezone.utc)
                        }},
                        session=session
                    )

                    # B. Payouts (Winners get 90, Draws get 50 back)
                    if is_draw:
                        await self.update_wallet(player1_id, 50.0, session=session)
                        await self.update_wallet(player2_id, 50.0, session=session)
                    else:
                        await self.update_wallet(winner_id, 90.0, session=session)

                    # C. Update Global Stats & Leaderboard
                    await self.record_match_stats(player1_id, is_win=(winner_id == player1_id), session=session)
                    await self.record_match_stats(player2_id, is_win=(winner_id == player2_id), session=session)

                    # D. Add to Personal History (Recent Matches)
                    await self._quick_history_add(player1_id, match_id, player2_id, p1_score, p2_score, winner_id, session)
                    await self._quick_history_add(player2_id, match_id, player1_id, p2_score, p1_score, winner_id, session)

            logger.info(f"✅ Payout & History Successful: Match {match_id}")
            return True

        except Exception as e:
            logger.error(f"❌ CRITICAL TRANSACTION FAILURE: {e}")
            return False

    async def _quick_history_add(self, user_id, match_id, op_id, my_score, op_score, winner_id, session):
        """Internal helper for history updates. Now includes 'mode' for frontend badges."""
        op_user = await self.collection.find_one({"_id": ObjectId(op_id)}, {"username": 1}, session=session)
        op_name = op_user.get("username", "Opponent") if op_user else "Opponent"

        result_str = "DRAW" if not winner_id else ("WON" if str(winner_id) == str(user_id) else "LOST")
        
        # Determine mode based on match_id prefix or metadata
        mode = "challenge" if "match_" in str(match_id) else "ranked"

        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
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