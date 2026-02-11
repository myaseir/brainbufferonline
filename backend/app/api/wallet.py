from fastapi import APIRouter, HTTPException, Depends, status
from app.services.wallet_service import WalletService
from app.repositories.user_repo import UserRepository
from app.core.deps import get_current_user 
from app.models.deposit import DepositCreate, WithdrawalRequest 
from app.db.redis import redis_client  # 🚀 Shared Brain for Locking
from bson import ObjectId
from datetime import datetime, timezone
from typing import List
from datetime import datetime
router = APIRouter()
wallet_service = WalletService()
user_repo = UserRepository()

# --- 🚀 USER ROUTES ONLY ---

@router.post("/deposit/submit")
async def submit_manual_deposit(data: DepositCreate, current_user: dict = Depends(get_current_user)):
    db = user_repo.collection.database
    clean_trx = data.trx_id.strip().upper()
    
    # 1. DISTRIBUTED LOCK: Prevent duplicate submissions in the same second
    lock_key = f"lock:deposit:{clean_trx}"
    if not redis_client.set(lock_key, "locked", ex=10, nx=True):
        raise HTTPException(status_code=400, detail="Transaction is being processed. Please wait.")

    # 2. DB Check (Idempotency)
    if await db["deposits"].find_one({"trx_id": clean_trx}):
        raise HTTPException(status_code=400, detail="TRX ID already submitted.")

    await db["deposits"].insert_one({
        "user_id": ObjectId(current_user["id"]),
        "username": current_user["username"],
        "full_name": data.full_name,
        "sender_number": data.sender_number,
        "amount": data.amount,
        "trx_id": clean_trx,
        "status": "PENDING",
        "created_at": datetime.now(timezone.utc)
    })
    return {"status": "success", "message": "Deposit submitted for verification"}

@router.post("/withdraw")
async def request_withdrawal(data: WithdrawalRequest, current_user: dict = Depends(get_current_user)):
    db = user_repo.collection.database
    user_id = current_user["id"]
    user_oid = ObjectId(user_id)
    
    # 3. GLOBAL WITHDRAWAL LOCK: Prevent "Double-Tap" attacks
    # This ensures a user cannot send 5 withdrawal requests at the exact same millisecond
    withdraw_lock = f"lock:withdraw:{user_id}"
    if not redis_client.set(withdraw_lock, "locked", ex=5, nx=True):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")

    try:
        # 🛡️ ATOMIC BALANCE CHECK & DEDUCT
        # This is the most critical line. It prevents the user from withdrawing money they don't have.
        # It deducts the balance immediately. If the admin rejects it later, we refund it.
        res = await user_repo.collection.update_one(
            {"_id": user_oid, "wallet_balance": {"$gte": data.amount}},
            {"$inc": {"wallet_balance": -data.amount}}
        )
        
        if res.modified_count == 0:
            raise HTTPException(status_code=400, detail="Insufficient balance")

        await db["withdrawals"].insert_one({
            "user_id": user_oid,
            "username": current_user.get("username", "Unknown"), # Useful for Admin Dashboard
            "amount": data.amount, 
            "method": data.method,
            "account_number": data.account_number, 
            "account_name": data.account_name,
            "status": "PENDING", 
            "created_at": datetime.now(timezone.utc)
        })
        return {"status": "success"}
    
    finally:
        # Release lock or let it expire
        redis_client.delete(withdraw_lock)
        
@router.post("/referral/claim")
async def claim_bonus(payload: dict, current_user = Depends(get_current_user)):
    """
    Exposes the referral tracking logic to the frontend
    """
    code = payload.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Referral code is required")
        
    wallet_service = WalletService()
    
    # 🚀 TIP: current_user from get_current_user is a dict. 
    # Ensure it doesn't contain raw ObjectIds before passing if your service doesn't handle them.
    result = await wallet_service.claim_referral_bonus(current_user, code)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Claim failed"))
        
    # ✅ Return a clean dictionary. 
    # Avoid returning 'current_user' directly in the response if it has ObjectIds.
    return {
        "status": "success",
        "message": result.get("message", "Bonus claimed successfully!"),
        # The balance for this user DOES NOT change, so just return the current value.
        "new_balance": current_user.get("wallet_balance", 0)
    }
    
@router.get("/history")
async def get_transaction_history(current_user: dict = Depends(get_current_user)):
    """
    Fetches and combines both deposits and withdrawals into a single timeline.
    """
    db = user_repo.collection.database
    user_id = ObjectId(current_user["id"])

    # 1. Fetch latest 50 of each type
    deposits = await db["deposits"].find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    withdrawals = await db["withdrawals"].find({"user_id": user_id}).sort("created_at", -1).to_list(50)

    history = []
    
    # 2. Standardize Deposit objects
    for d in deposits:
        history.append({
            "type": "DEPOSIT",
            "amount": d["amount"],
            "status": d["status"],
            "trx_id": d.get("trx_id"),
            "created_at": d["created_at"]
        })

    # 3. Standardize Withdrawal objects
    for w in withdrawals:
        history.append({
            "type": "WITHDRAWAL",
            "amount": w["amount"],
            "status": w["status"],
            "account_number": w.get("account_number"),
            "created_at": w["created_at"]
        })

    # 4. Sort the combined list by date (newest first)
    history.sort(key=lambda x: (x.get("status") == "PENDING", x.get("created_at", datetime.min)), reverse=True)
    
    return history