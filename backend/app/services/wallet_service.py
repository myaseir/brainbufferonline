from app.repositories.user_repo import UserRepository
from fastapi import HTTPException

class WalletService:
    def __init__(self):
        self.user_repo = UserRepository()

    async def handle_safepay_deposit(self, user_id: str, amount: float, tracker: str):
        """
        Processes a successful Safepay deposit.
        """
        # 1. Logic to verify if this 'tracker' was already processed (Idempotency)
        # 2. Update the balance
        await self.user_repo.update_wallet(user_id, amount)
        return {"status": "success", "new_balance": "updated"}

    async def deduct_entry_fee(self, user_id: str, fee: float = 10.0):
        """
        Deducts the 10 PKR fee before a match starts.
        """
        user = await self.user_repo.get_by_id(user_id)
        
        if not user or user.get("wallet_balance", 0) < fee:
            raise HTTPException(status_code=400, detail="Insufficient balance for 1v1 match")

        # Atomic deduction: -10 PKR
        await self.user_repo.update_wallet(user_id, -fee)
        return True

    async def settle_match_winner(self, winner_id: str, pot_amount: float = 20.0):
        """
        Awards the 20 PKR pot to the winner.
        """
        await self.user_repo.update_wallet(winner_id, pot_amount)
        # Also increment win count
        await self.user_repo.increment_wins(winner_id)
        return {"status": "payout_complete"}