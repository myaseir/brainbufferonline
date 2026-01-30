from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.core.deps import get_current_admin
from app.repositories.user_repo import UserRepository
from app.services.wallet_service import WalletService
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()
user_repo = UserRepository()
wallet_service = WalletService()

# --- 📊 ANALYTICS ROUTES ---

@router.get("/revenue/today")
async def get_revenue(admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    
    # 1. Gross Deposits
    dep_res = await db["deposits"].aggregate([
        {"$match": {"status": "COMPLETED"}}, 
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    gross_val = dep_res[0]["total"] if dep_res else 0

    # 2. Total Payouts (Withdrawals)
    with_res = await db["withdrawals"].aggregate([
        {"$match": {"status": "COMPLETED"}}, 
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    payout_val = with_res[0]["total"] if with_res else 0

    # 3. 📉 CALCULATE PROFIT (The Missing Piece)
    
    # A. Withdrawal Fees (5% of all withdrawals)
    withdrawal_fees = int(payout_val * 0.05)

    # B. Game Fees (10 PKR per completed match)
    # We count how many games are in the history
    total_matches = await db["match_history"].count_documents({})
    game_fees = total_matches * 10 
    
    # C. Total Net Profit
    net_profit = withdrawal_fees + game_fees

    # 4. System Liquidity (User Money)
    user_res = await db["users"].aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$wallet_balance"}}}
    ]).to_list(1)
    liquidity_val = user_res[0]["total"] if user_res else 0
    
    return {
        "metrics": {
            "net_profit": net_profit,          # ✅ Now includes Game Fees
            "system_liquidity": liquidity_val, 
            "gross_collections": gross_val,
            "total_payouts": payout_val 
        }
    }

@router.get("/health")
async def get_health(admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    
    # 1. Check Database
    try:
        await db.command("ping")
        db_status = True
        count = await db["users"].count_documents({})
    except Exception as e:
        db_status = False
        count = 0
        
    # 2. Check Real-Time Users
    try:
        from app.core.store import connected_matchmaking_users, active_matches
        
        waiting_count = len(connected_matchmaking_users)
        playing_count = len(active_matches) * 2
        total_online = waiting_count + playing_count
        matches_count = len(active_matches)
        
    except ImportError:
        total_online = 0
        matches_count = 0
    
    return {
        "database": {"connected": db_status, "total_registered_users": count},
        "system_info": {"version": "1.2.2", "environment": "Production"},
        "real_time_metrics": {
            "active_matches": matches_count,
            "total_players_online": total_online
        }
    }

@router.get("/stats/peak-times")
async def get_peak_times(admin: dict = Depends(get_current_admin)):
    return [
        {"hour": "10 AM", "matches": 12},
        {"hour": "2 PM", "matches": 45},
        {"hour": "6 PM", "matches": 80},
        {"hour": "10 PM", "matches": 110},
    ]

# --- 💰 FINANCIAL MANAGEMENT ROUTES ---
# (Keep the rest of the file exactly as is)
@router.get("/deposits/pending")
async def get_pending_deposits(admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    deposits = await db["deposits"].find({"status": "PENDING"}).to_list(100)
    for d in deposits:
        d["_id"] = str(d["_id"])
        d["user_id"] = str(d["user_id"])
    return {"pending_deposits": deposits}

@router.post("/deposit/{trx_id}/{action}")
async def process_deposit(trx_id: str, action: str, admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    deposit = await db["deposits"].find_one({"trx_id": trx_id, "status": "PENDING"})
    
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
        
    if action == "approve":
        await wallet_service.handle_manual_deposit(str(deposit["user_id"]), deposit["amount"], trx_id)
        await db["deposits"].update_one(
            {"trx_id": trx_id}, 
            {"$set": {"status": "COMPLETED", "approved_at": datetime.now(timezone.utc)}}
        )
    elif action == "reject":
        await db["deposits"].update_one(
            {"trx_id": trx_id}, 
            {"$set": {"status": "REJECTED", "rejected_at": datetime.now(timezone.utc)}}
        )
    return {"status": "success"}

@router.get("/withdrawals/pending")
async def get_pending_withdrawals(admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    withdrawals = await db["withdrawals"].find({"status": "PENDING"}).to_list(100)
    results = []
    for w in withdrawals:
        user = await db["users"].find_one({"_id": w["user_id"]})
        results.append({
            "_id": str(w["_id"]),
            "username": user["username"] if user else "Unknown",
            "amount": w["amount"],
            "method": w["method"],
            "account_number": w.get("account_number", "N/A"), 
            "account_name": w.get("account_name", "N/A"),
            "status": w["status"],
            "date": w["created_at"]
        })
    return results

@router.post("/withdrawal/{w_id}/{action}")
async def process_withdrawal(w_id: str, action: str, admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    try:
        w_oid = ObjectId(w_id)
    except:
         raise HTTPException(status_code=400, detail="Invalid ID format")
    
    w_req = await db["withdrawals"].find_one({"_id": w_oid, "status": "PENDING"})
    if not w_req:
         raise HTTPException(status_code=404, detail="Withdrawal request not found")

    if action == "approve":
        await db["withdrawals"].update_one(
            {"_id": w_oid}, 
            {"$set": {"status": "COMPLETED", "processed_at": datetime.now(timezone.utc)}}
        )
    elif action == "reject":
        await db["users"].update_one(
            {"_id": w_req["user_id"]}, 
            {"$inc": {"wallet_balance": w_req["amount"]}}
        )
        await db["withdrawals"].update_one(
            {"_id": w_oid}, 
            {"$set": {"status": "REJECTED", "rejected_at": datetime.now(timezone.utc)}}
        )
    return {"status": "success"}