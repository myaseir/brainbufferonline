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
        Main logic: Look for an waiting player. If found, join them. 
        If not, create a new match and wait.
        """
        
        # 1. Check if user has enough balance (10 PKR)
        user = await self.user_repo.get_by_id(user_id)
        if not user or user.get("wallet_balance", 0) < 10:
            raise HTTPException(status_code=400, detail="Insufficient funds for 1v1 match")

        # 2. Try to find an existing match that is waiting for Player 2
        waiting_match = await self.match_repo.get_waiting_match()

        if waiting_match:
            # Prevent user from playing against themselves
            if waiting_match["player1_id"] == user_id:
                return waiting_match

            # 3. Join as Player 2
            # Deduct money first (Escrow)
            await self.user_repo.update_wallet(user_id, -10.0)
            
            # Update match with Player 2 ID
            updated_match = await self.match_repo.add_player_to_match(
                match_id=waiting_match["_id"], 
                player2_id=user_id
            )
            return updated_match

        else:
            # 4. No match found -> Create a new one and wait
            # Deduct money first (Escrow)
            await self.user_repo.update_wallet(user_id, -10.0)
            
            new_match_data = {
                "player1_id": user_id,
                "player2_id": None,
                "entry_fee": 10.0,
                "pot_amount": 20.0,
                "is_active": True,
                "status": "waiting" # Waiting for Player 2
            }
            return await self.match_repo.create_match(new_match_data)