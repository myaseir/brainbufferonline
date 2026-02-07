from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.core.deps import get_current_admin
from app.repositories.user_repo import UserRepository
from app.services.wallet_service import WalletService
from app.db.redis import redis_client
from bson import ObjectId
from datetime import datetime, timezone
import json
from app.services.lobby_manager import lobby_manager
from app.repositories.match_repo import MatchRepository
router = APIRouter()
user_repo = UserRepository()
wallet_service = WalletService()
match_repo = MatchRepository()

# --- 📊 ANALYTICS ---
@router.get("/revenue/today")
async def get_revenue(admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    
    # 1. Gross Collections (Deposits)
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

    # 3. Net Profit Calculation
    # Profit = 5% withdrawal fee + (Total Matches * 10 PKR entry difference)
    withdrawal_fees = int(payout_val * 0.05)
    total_matches = await db["users"].aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$total_matches"}}}
    ]).to_list(1)
    
    # Note: total_matches in users is sum of both players. Actual matches = total / 2
    # Fee per match is 100 (pool) - 90 (winner) = 10 PKR
    match_count = (total_matches[0]["total"] if total_matches else 0) / 2
    game_fees = int(match_count * 10)
    
    net_profit = withdrawal_fees + game_fees

    # 4. System Liquidity (User Balances)
    user_res = await db["users"].aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$wallet_balance"}}}
    ]).to_list(1)
    liquidity_val = user_res[0]["total"] if user_res else 0
    
    return {
        "metrics": {
            "net_profit": net_profit,
            "system_liquidity": liquidity_val, 
            "gross_collections": gross_val,
            "total_payouts": payout_val 
        }
    }

@router.get("/health")
async def get_health(admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    
    # Database Check
    try:
        await db.command("ping")
        db_status = "Online"
        reg_users = await db["users"].estimated_document_count()
    except Exception:
        db_status = "Offline"
        reg_users = 0
        
    # Real-time Metrics
    try:
        # Note: 'keys' is expensive in huge prod, but fine for <10k users on Upstash
        online_keys = redis_client.keys("online:*")
        total_online = len(online_keys)
        
        active_match_keys = redis_client.keys("match:live:*")
        matches_count = len(active_match_keys)
    except Exception:
        total_online = 0
        matches_count = 0
    
    return {
        "status": "Healthy",
        "database": {"status": db_status, "total_registered": reg_users},
        "real_time": {
            "active_matches": matches_count,
            "total_players_online": total_online
        }
    }

# --- 👥 USER MANAGEMENT (MISSING IN YOUR CODE) ---
@router.get("/users")
async def get_users(
    page: int = 1, 
    search: str = "", 
    admin: dict = Depends(get_current_admin)
):
    db = user_repo.collection.database
    limit = 20
    skip = (page - 1) * limit
    
    query = {}
    if search:
        query = {
            "$or": [
                {"email": {"$regex": search, "$options": "i"}},
                {"username": {"$regex": search, "$options": "i"}}
            ]
        }

    # 1. Get the total count of users matching the query
    total_users = await db["users"].count_documents(query)

    # 2. Calculate total pages (e.g., 45 users / 20 limit = 3 pages)
    total_pages = (total_users + limit - 1) // limit

    # 3. Fetch the specific slice of users
    users_cursor = db["users"].find(query).skip(skip).limit(limit).sort("created_at", -1)
    users = await users_cursor.to_list(limit)
    
    # Serialize ObjectId
    for u in users:
        u["_id"] = str(u["_id"])
        
    # 4. Return users AND the pagination metadata
    return {
        "users": users,
        "total_pages": total_pages,
        "total_users": total_users,
        "current_page": page
    }
# --- 💰 DEPOSITS ---
@router.get("/deposits/pending")
async def get_pending_deposits(admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    deposits = await db["deposits"].find({"status": "PENDING"}).sort("created_at", -1).to_list(100)
    for d in deposits:
        d["_id"] = str(d["_id"])
        d["user_id"] = str(d["user_id"])
    return {"pending_deposits": deposits}

@router.post("/deposit/{trx_id}/{action}")
async def process_deposit(trx_id: str, action: str, admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    deposit = await db["deposits"].find_one({"trx_id": trx_id, "status": "PENDING"})
    
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found or already processed")
        
    if action == "approve":
        # Credit the user wallet via Service
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

@router.post("/system/reset-finances")
async def reset_financial_stats(admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    
    try:
        # 1. Reset Inflow: Deletes all deposit records
        await db["deposits"].delete_many({})
        
        # 2. Reset Outflow: Deletes all withdrawal records
        await db["withdrawals"].delete_many({})
        
        # 3. Reset Profit: Deletes all match records (where commission is stored)
        await db["matches"].delete_many({})
        
        # 4. Optional: Reset User Wallets (set everyone back to zero balance)
        # If you don't do this, "System Liquidity" will still show the sum of current wallets
        await db["users"].update_many({}, {"$set": {"wallet_balance": 0}})

        return {"status": "success", "message": "Financial metrics reset to zero."}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# --- 🏦 WITHDRAWALS (MISSING IN YOUR CODE) ---
@router.get("/withdrawals/pending")
async def get_pending_withdrawals(admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    withdrawals = await db["withdrawals"].find({"status": "PENDING"}).sort("created_at", -1).to_list(100)
    
    # Enrich with Username if possible, or just send IDs
    for w in withdrawals:
        w["_id"] = str(w["_id"])
        w["user_id"] = str(w["user_id"])
        
        # Optional: Fetch username for UI convenience
        user = await db["users"].find_one({"_id": ObjectId(w["user_id"])})
        if user:
            w["username"] = user.get("username", "Unknown")
            
    return {"pending_withdrawals": withdrawals}

@router.post("/withdraw/{withdraw_id}/{action}")
async def process_withdrawal(withdraw_id: str, action: str, admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    
    try:
        w_oid = ObjectId(withdraw_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")

    withdrawal = await db["withdrawals"].find_one({"_id": w_oid, "status": "PENDING"})
    
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    if action == "approve":
        # Mark as completed (Money was already deducted when request was made)
        await db["withdrawals"].update_one(
            {"_id": w_oid},
            {"$set": {"status": "COMPLETED", "processed_at": datetime.now(timezone.utc)}}
        )
    elif action == "reject":
        # Refund the money to the user
        await user_repo.update_wallet(str(withdrawal["user_id"]), withdrawal["amount"])
        
        await db["withdrawals"].update_one(
            {"_id": w_oid},
            {"$set": {"status": "REJECTED", "rejected_at": datetime.now(timezone.utc)}}
        )
        
    return {"status": "success"}
@router.get("/stats/peak-times")
async def get_peak_activity(admin: dict = Depends(get_current_admin)):
    db = user_repo.collection.database
    
    # Aggregation: Extract hour from timestamp and count matches
    pipeline = [
        # 1. Project the hour from the ISO timestamp string
        # Note: MongoDB stores strings in your schema, so we slice the string "YYYY-MM-DDTHH:..."
        # Or if you stored standard ISODates: {"$hour": "$timestamp"}
        {
            "$project": {
                "hour": {"$substr": ["$timestamp", 11, 2]} # Extracts "14" from "2024-01-01T14:30:00"
            }
        },
        # 2. Group by Hour
        {
            "$group": {
                "_id": "$hour",
                "matches": {"$sum": 1}
            }
        },
        # 3. Sort by Hour
        {"$sort": {"_id": 1}}
    ]

    try:
        # We query the 'match_history' collection if you have one, 
        # OR we query users and unwind their 'recent_matches' if you don't have a separate collection.
        # Ideally, you should have a 'matches' collection for analytics.
        
        # Option A: If you have a 'matches' collection (Recommended):
        # results = await db["matches"].aggregate(pipeline).to_list(24)

        # Option B: Aggregate from Users (Slower but works with your current repo)
        results = await db["users"].aggregate([
            {"$unwind": "$recent_matches"},
            {"$project": {"hour": {"$substr": ["$recent_matches.timestamp", 11, 2]}}},
            {"$group": {"_id": "$hour", "matches": {"$sum": 1}}},
            {"$sort": {"_id": 1}}
        ]).to_list(24)

        # Format for Recharts
        formatted_data = [{"hour": r["_id"], "matches": r["matches"]} for r in results]
        return formatted_data

    except Exception as e:
        print(f"Stats Error: {e}")
        return []
    
@router.post("/broadcast")
async def send_global_announcement(data: dict, admin: dict = Depends(get_current_admin)):
    message = data.get("message")
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
        
    await lobby_manager.broadcast_global_announcement(message)
    return {"status": "success", "sent_to": len(lobby_manager.active_connections)}

# 2. 🔍 MATCH AUDIT
@router.get("/match/{match_id}/audit")
async def get_match_audit(match_id: str, admin: dict = Depends(get_current_admin)):
    audit_data = await match_repo.get_match_audit_data(match_id)
    if not audit_data:
        raise HTTPException(status_code=404, detail="Match not found")
        
    # Prepare the specific fields the AuditModal expects
    return {
        "match_id": audit_data["match_id"],
        "p1_score": audit_data.get("scores", {}).get(str(audit_data.get("player1_id")), 0),
        "p2_score": audit_data.get("scores", {}).get(str(audit_data.get("player2_id")), 0),
        "status": audit_data["status"],
        "stake": audit_data["stake"],
        "winner_id": str(audit_data["winner_id"]) if audit_data.get("winner_id") else None
    }

@router.get("/referral-leaderboard")
async def admin_referral_leaderboard(
    skip: int = Query(0, ge=0), 
    limit: int = Query(10, le=50),
    admin: dict = Depends(get_current_admin) # Add this line for security
):
    repo = UserRepository()
    data = await repo.get_referral_leaderboard(skip=skip, limit=limit)
    return {"status": "success", "data": data}