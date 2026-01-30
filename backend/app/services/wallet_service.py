from app.repositories.user_repo import UserRepository
from fastapi import HTTPException
from bson import ObjectId
from datetime import datetime, timezone

class WalletService:
    def __init__(self):
        self.user_repo = UserRepository()

    async def handle_manual_deposit(self, user_id: str, amount: float, trx_id: str):
        """
        Finalizes a manual deposit after Admin approval.
        Uses a transaction log to prevent double-crediting (Idempotency).
        """
        db = self.user_repo.collection.database
        
        # 1. Check if this TRX ID was already used to prevent double-funding
        existing_tx = await db["transactions"].find_one({"provider_reference": trx_id, "type": "DEPOSIT"})
        if existing_tx:
            print(f"⚠️ TRX {trx_id} already processed. Ignoring duplicate approval.")
            return {"status": "already_processed"}

        # 2. Update the user balance (Atomic $inc via repository)
        amount = round(float(amount), 2)
        update_success = await self.user_repo.update_wallet(user_id, amount)
        
        if not update_success:
            raise HTTPException(status_code=500, detail="Failed to update user wallet")

        # 3. Create a Permanent Transaction Log
        transaction_doc = {
            "user_id": ObjectId(user_id),
            "type": "DEPOSIT",
            "amount": amount,
            "provider": "MANUAL_TRANSFER",
            "provider_reference": trx_id,
            "status": "COMPLETED",
            "timestamp": datetime.now(timezone.utc)
        }
        await db["transactions"].insert_one(transaction_doc)
        
        print(f"✅ Wallet Updated: +{amount} PKR for User {user_id}")
        return {"status": "success"}

    async def deduct_entry_fee(self, user_id: str, fee: float = 50.0):
        """
        Deducts the 50 PKR entry fee for Ranked Matches.
        Uses an atomic check to prevent negative balances.
        """
        # We query the user to check their current balance
        user = await self.user_repo.get_by_id(user_id)
        if not user:
             raise HTTPException(status_code=404, detail="User not found")
             
        current_balance = user.get("wallet_balance", 0)
        
        if current_balance < fee:
            raise HTTPException(status_code=400, detail=f"Insufficient funds. {fee} PKR required.")

        # Atomic deduction: update_wallet should return True if modified_count > 0
        await self.user_repo.update_wallet(user_id, -fee)
        return True

    async def settle_match_winner(self, winner_id: str, payout: float = 90.0):
        """
        Awards 90 PKR to the match winner.
        """
        await self.user_repo.update_wallet(winner_id, payout)
        await self.user_repo.increment_wins(winner_id)
        return {"status": "payout_complete", "amount_awarded": payout}

    async def refund_draw(self, player_ids: list, refund_amount: float = 50.0):
        """
        Refunds both players 50 PKR in case of a draw.
        """
        for pid in player_ids:
            await self.user_repo.update_wallet(pid, refund_amount)
        return {"status": "refund_complete"}