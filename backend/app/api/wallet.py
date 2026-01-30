from fastapi import APIRouter, HTTPException, Depends
from app.services.wallet_service import WalletService
from app.repositories.user_repo import UserRepository
from app.core.deps import get_current_user
# 1. Import your Admin dependency (assuming you have one, or use get_current_user and check role)
from app.core.deps import get_current_admin 
# 2. Import the schema you created in models/deposit.py to avoid duplication
from app.models.deposit import DepositCreate, WithdrawalRequest 
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()
wallet_service = WalletService()
user_repo = UserRepository()

# --- 🚀 USER ROUTES ---

@router.post("/deposit/submit")
# 3. Use DepositCreate from your models file
async def submit_manual_deposit(data: DepositCreate, current_user: dict = Depends(get_current_user)):
    db = user_repo.collection.database
    clean_trx = data.trx_id.strip().upper()
    
    # Check for duplicates
    if await db["deposits"].find_one({"trx_id": clean_trx}):
        raise HTTPException(status_code=400, detail="TRX ID already submitted.")

    # 4. Create the Deposit Record
    # ideally, move this logic to wallet_service.create_deposit_request()
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
    # ... (Your existing code here is fine and atomic!) ...
    db = user_repo.collection.database
    user_oid = ObjectId(current_user["id"])
    
    # Atomic Balance Check & Deduct (Excellent Logic)
    res = await user_repo.collection.update_one(
        {"_id": user_oid, "wallet_balance": {"$gte": data.amount}},
        {"$inc": {"wallet_balance": -data.amount}}
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    await db["withdrawals"].insert_one({
        "user_id": user_oid,
        "amount": data.amount, 
        "method": data.method,
        "account_number": data.account_number, 
        "account_name": data.account_name, # Don't forget this field!
        "status": "PENDING", 
        "created_at": datetime.now(timezone.utc)
    })
    return {"status": "success"}

# --- 👑 ADMIN ROUTES ---

@router.post("/admin/deposit/{trx_id}/approve")
# 5. SECURITY FIX: Added dependency to ensure only Admins can call this
async def approve_deposit(trx_id: str, admin_user: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    
    # Find the pending request
    req = await db["deposits"].find_one({"trx_id": trx_id, "status": "PENDING"})
    if not req: 
        raise HTTPException(status_code=404, detail="Transaction not found or already processed")

    # Use the Service to handle the logic (Credit balance + Notify)
    await wallet_service.handle_manual_deposit(str(req["user_id"]), req["amount"], trx_id)
    
    # Update status
    await db["deposits"].update_one({"trx_id": trx_id}, {"$set": {"status": "COMPLETED", "approved_at": datetime.now(timezone.utc)}})
    
    return {"status": "success"}