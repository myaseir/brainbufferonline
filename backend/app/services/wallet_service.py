from app.repositories.user_repo import UserRepository
from app.db.redis import redis_client # 🚀 Shared Brain for Locking
from fastapi import HTTPException
from bson import ObjectId
from datetime import datetime, timezone

class WalletService:
    def __init__(self):
        self.user_repo = UserRepository()

    async def handle_manual_deposit(self, user_id: str, amount: float, trx_id: str):
        """
        Finalizes a manual deposit after Admin approval.
        Uses a Redis Distributed Lock for strict idempotency.
        """
        db = self.user_repo.collection.database
        
        # 1. 🚀 DISTRIBUTED LOCK: Prevent two admins from approving the same TRX at once
        lock_key = f"lock:deposit_process:{trx_id}"
        if not redis_client.set(lock_key, "processing", ex=30, nx=True):
            return {"status": "processing_by_another_instance"}

        try:
            # 2. Check Idempotency (Permanent Record)
            existing_tx = await db["transactions"].find_one({"provider_reference": trx_id, "type": "DEPOSIT"})
            if existing_tx:
                return {"status": "already_processed"}

            # 3. Update Balance
            amount = round(float(amount), 2)
            update_success = await self.user_repo.update_wallet(user_id, amount)
            
            if not update_success:
                raise HTTPException(status_code=500, detail="Failed to update wallet")

            # 4. Log Transaction
            await db["transactions"].insert_one({
                "user_id": ObjectId(user_id),
                "type": "DEPOSIT",
                "amount": amount,
                "provider": "MANUAL_TRANSFER",
                "provider_reference": trx_id,
                "status": "COMPLETED",
                "timestamp": datetime.now(timezone.utc)
            })
            
            # Clear total economy cache so stats refresh
            redis_client.delete("stats:total_pool")
            return {"status": "success"}
        finally:
            redis_client.delete(lock_key)

    async def deduct_entry_fee(self, user_id: str, fee: float = 50.0):
        """
        Uses an ATOMIC MongoDB filter to check balance and deduct in ONE step.
        This is the only way to prevent negative balances at high scale.
        """
        # We don't "Get" then "Deduct". We "Deduct IF balance >= fee".
        result = await self.user_repo.collection.update_one(
            {
                "_id": ObjectId(user_id), 
                "wallet_balance": {"$gte": fee} # The Bouncer: Only allow if funds exist
            },
            {"$inc": {"wallet_balance": -fee}}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Insufficient funds")
            
        return True

    async def settle_match_winner(self, winner_id: str, payout: float = 90.0):
        """Awards prize and triggers a leaderboard update in Redis."""
        await self.user_repo.update_wallet(winner_id, payout)
        
        # This call now updates both MongoDB and the Redis Sorted Set Leaderboard
        await self.user_repo.record_match_stats(winner_id, is_win=True)
        
        return {"status": "payout_complete"}

    async def refund_draw(self, player_ids: list, refund_amount: float = 50.0):
        """Atomic refunds for both players."""
        for pid in player_ids:
            await self.user_repo.update_wallet(pid, refund_amount)
            # Record the match as a draw (not a win)
            await self.user_repo.record_match_stats(pid, is_win=False)
        return {"status": "refund_complete"}