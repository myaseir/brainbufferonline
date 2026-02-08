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
        
        # 1. 🚀 DISTRIBUTED LOCK
        lock_key = f"lock:deposit_process:{trx_id}"
        if not redis_client.set(lock_key, "processing", ex=30, nx=True):
            return {"status": "processing_by_another_instance"}

        try:
            # 2. Check Idempotency
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
            
            redis_client.delete("stats:total_pool")
            return {"status": "success"}
        finally:
            redis_client.delete(lock_key)

    async def deduct_entry_fee(self, user_id: str, fee: float = 50.0):
        """
        Atomic deduction. Only allows if funds exist.
        """
        result = await self.user_repo.collection.update_one(
            {
                "_id": ObjectId(user_id), 
                "wallet_balance": {"$gte": fee} 
            },
            {"$inc": {"wallet_balance": -fee}}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Insufficient funds")
            
        return True

    # ✅ RENAMED to match game_lifecycle.py
    async def payout_winnings(self, user_id: str, amount: float):
        """
        Awards prize money to the winner.
        """
        # 1. Update Wallet
        await self.user_repo.update_wallet(user_id, amount)
        
        # 2. Update Stats (Wins, Leaderboard Score)
        await self.user_repo.record_match_stats(user_id, is_win=True)
        
        return True

    # ✅ RENAMED/SIMPLIFIED to match game_lifecycle.py
    async def refund_user(self, user_id: str, amount: float):
        """
        Refunds a single user (used for Draws or Aborted matches).
        """
        await self.user_repo.update_wallet(user_id, amount)
        return True
    
    async def claim_referral_bonus(self, current_user: dict, code: str):
        # 1. Self-referral check (Case-insensitive)
        if str(current_user.get("referral_code")).upper() == code.strip().upper():
            return {"success": False, "error": "Self-referral is not allowed."}

        # 2. Already referred check
        if current_user.get("referred_by"):
            return {"success": False, "error": "You have already claimed a referral bonus."}

        # 3. Find the Giver
        giver = await self.user_repo.get_by_referral_code(code)
        if not giver:
            return {"success": False, "error": "Invalid referral code."}

        # 4. Extract IDs safely
        # Use .get("_id") to avoid KeyErrors, and ensure they are strings
        downloader_id = str(current_user.get("_id") or current_user.get("id"))
        giver_id = str(giver.get("_id"))

        # 5. Process the atomic transaction
        success = await self.user_repo.apply_referral_bonus(
            downloader_id=downloader_id,
            giver_id=giver_id,
            amount=100.0
        )

        if success:
            return {"success": True, "message": "100 PKR added to both accounts!"}
        
        return {"success": False, "error": "Transaction failed. Please try again."}
    
    async def get_admin_referral_stats(self, skip: int = 0, limit: int = 10):
        """
        Fetches the referral leaderboard data for the Admin UI.
        """
        leaderboard_data = await self.user_repo.get_referral_leaderboard(
            skip=skip, 
            limit=limit
        )
        
        return {
            "status": "success",
            "data": leaderboard_data
        }