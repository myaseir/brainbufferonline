import uuid
from typing import Optional
from app.repositories.match_repo import MatchRepository
from app.repositories.user_repo import UserRepository
from fastapi import HTTPException

class MatchmakingService:
    def __init__(self):
        self.match_repo = MatchRepository()
        self.user_repo = UserRepository()

    async def find_or_create_match(self, user_id: str):
        """
        Logic: Entry Fee = 50 PKR. 
        Total Pot = 100 PKR. 
        Winner Prize = 90 PKR. (10 PKR Profit)
        """
        
        # 💰 1. Check if user has enough balance (50 PKR)
        user = await self.user_repo.get_by_id(user_id)
        if not user or user.get("wallet_balance", 0) < 50:
            raise HTTPException(status_code=400, detail="Insufficient funds (Required: 50 PKR)")

        match_collection = self.match_repo.collection 
        
        # 🕵️ 2. ATOMIC JOIN: Find a waiting match
        joined_match = await match_collection.find_one_and_update(
            {
                "status": "waiting",
                "player1_id": {"$ne": user_id} 
            },
            {
                "$set": {
                    "player2_id": user_id,
                    "status": "active",
                    "is_active": True
                }
            },
            return_document=True
        )

        if joined_match:
            # --- SUCCESS: JOINED EXISTING MATCH ---
            # Deduct 50 PKR from Player 2
            await self.user_repo.update_wallet(user_id, -50.0)
            
            joined_match["_id"] = str(joined_match["_id"])
            return joined_match

        else:
            # --- FAIL: CREATE NEW MATCH ---
            
            # Check for existing waiting session (cleanup)
            existing = await match_collection.find_one({"player1_id": user_id, "status": "waiting"})
            if existing:
                existing["_id"] = str(existing["_id"])
                return existing

            # Deduct 50 PKR from Player 1
            await self.user_repo.update_wallet(user_id, -50.0)
            
            # 📝 New Match Data (With your 50/90 Logic)
            new_match_data = {
                "player1_id": user_id,
                "player2_id": None,
                "entry_fee": 50.0,
                "total_collected": 100.0, # 50 + 50
                "winning_prize": 90.0,    # Winner gets 90
                "platform_fee": 10.0,     # You keep 10
                "is_active": True,
                "status": "waiting"
            }
            return await self.match_repo.create_match(new_match_data)