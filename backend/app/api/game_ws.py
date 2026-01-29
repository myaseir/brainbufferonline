import asyncio
import json
import uuid
import logging
import random
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from bson import ObjectId

from app.core.config import settings
from app.core.security import decode_access_token
from app.repositories.user_repo import UserRepository

router = APIRouter()
logger = logging.getLogger("uvicorn.error")
user_repo = UserRepository()

# --- 🧠 IN-MEMORY STATE ---
connected_matchmaking_users: Set[str] = set()
user_locks: Set[str] = set()
match_queue: asyncio.Queue = asyncio.Queue()
pairings: Dict[str, str] = {} 
active_matches: Dict[str, dict] = {}

# --- 🎮 FAIR GAME GENERATOR ---
def generate_fair_game(total_rounds=20):
    game_rounds = []
    for r in range(1, total_rounds + 1):
        count = min(3 + (r - 1) // 2, 8)
        numbers = random.sample(range(1, 21), count)
        positions = []
        for _ in range(count):
            attempts = 0
            while attempts < 100:
                left = round(random.uniform(10, 80), 2)
                top = round(random.uniform(15, 75), 2)
                collision = False
                for pos in positions:
                    dx = pos['left'] - left
                    dy = (pos['top'] - top) * 1.5
                    if (dx**2 + dy**2)**0.5 < 22:
                        collision = True
                        break
                if not collision:
                    positions.append({"left": left, "top": top})
                    break
                attempts += 1
            if len(positions) < _ + 1:
                positions.append({"left": 50, "top": 50})
        game_rounds.append({"round": r, "numbers": numbers, "positions": positions})
    return game_rounds

# --- 🛠️ HELPERS ---
async def get_user_from_token(token: str) -> Optional[str]:
    try:
        payload = decode_access_token(token)
        return payload.get("sub") if payload else None
    except:
        return None

async def acquire_user_lock(user_id: str) -> bool:
    if user_id in user_locks: return False
    user_locks.add(user_id)
    return True

async def release_user_lock(user_id: str):
    if user_id in user_locks: 
        user_locks.discard(user_id)

async def find_or_enqueue_match(user_id: str):
    while not match_queue.empty():
        waiting_user = await match_queue.get()
        if waiting_user == user_id: continue
        if waiting_user not in connected_matchmaking_users:
            print(f"♻️ Skipping stale user {waiting_user} from queue.")
            continue
            
        match_id = f"match_{uuid.uuid4().hex[:8]}"
        pairings[user_id] = match_id
        pairings[waiting_user] = match_id
        print(f"✨ MATCH FOUND: {match_id} | {user_id} vs {waiting_user}")
        return match_id

    await match_queue.put(user_id)
    print(f"🕒 User {user_id} added to queue. (Queue Size: {match_queue.qsize()})")
    return None

# --- 📡 MATCHMAKING ENDPOINT ---
@router.websocket("/ws/matchmaking")
async def matchmaking_endpoint(websocket: WebSocket, token: str = Query(...)):
    await websocket.accept()
    user_id = await get_user_from_token(token)

    if user_id in user_locks: await release_user_lock(user_id)

    if not user_id or not await acquire_user_lock(user_id):
        print("❌ Matchmaking connection rejected: Locked")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    connected_matchmaking_users.add(user_id)
    
    try:
        match_id = await find_or_enqueue_match(user_id)
        if match_id:
            await websocket.send_json({"status": "MATCH_FOUND", "match_id": match_id})
        else:
            await websocket.send_json({"status": "SEARCHING"})
            found = False
            for i in range(120): 
                if user_id not in connected_matchmaking_users: break
                if user_id in pairings:
                    match_id = pairings.pop(user_id)
                    await websocket.send_json({"status": "MATCH_FOUND", "match_id": match_id})
                    found = True
                    break
                if i % 20 == 0: await websocket.send_json({"status": "WAITING"})
                await asyncio.sleep(0.5)
            
            if not found and user_id in connected_matchmaking_users:
                await websocket.send_json({"status": "TIMEOUT"})
                await websocket.close()

    except WebSocketDisconnect:
        print(f"👋 Matchmaking: User {user_id} disconnected")
    except Exception as e:
        print(f"❌ Matchmaking Error: {e}")
    finally:
        if user_id in connected_matchmaking_users: connected_matchmaking_users.remove(user_id)
        await release_user_lock(user_id)

# --- ⚡ GAME LOGIC ENDPOINT ---
@router.websocket("/ws/match/{match_id}")
async def game_websocket_endpoint(websocket: WebSocket, match_id: str, token: str = Query(...)):
    await websocket.accept()
    
    user_id = None
    try:
        user_id = await get_user_from_token(token)
        if not user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # Safe DB Check
        try:
            db_id = user_id
            try:
                if isinstance(user_id, str) and ObjectId.is_valid(user_id): db_id = ObjectId(user_id)
            except: pass 

            user = await user_repo.get_by_id(db_id) 
            if not user or user.get("wallet_balance", 0) < 10:
                print(f"❌ User {user_id} Rejected: Low Balance")
                await websocket.send_json({"type": "ERROR", "message": "Insufficient Balance"})
                await websocket.close()
                return

            await user_repo.update_wallet(user_id, -10.0)
            print(f"💰 Entry fee deducted for {user_id}")

        except Exception as db_err:
            print(f"❌ DB Error: {db_err}")
            await websocket.close()
            return

        if match_id not in active_matches:
            active_matches[match_id] = {
                "players": {},
                "rounds": generate_fair_game(20),
                "scores": {},
                "ready": set(),
                "finished": set(),
                "is_active": True  # <--- Flag to prevent double processing
            }
        
        match = active_matches[match_id]
        match["players"][user_id] = websocket
        match["scores"][user_id] = 0

        print(f"✅ Connected: {user_id} in {match_id}")

        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            # 1. READY
            if msg.get("type") == "CLIENT_READY":
                match["ready"].add(user_id)
                
                if len(match["ready"]) == 2:
                     print(f"🏁 ALL READY. BROADCASTING START for {match_id}")
                     
                     # --- A. FETCH REAL USERNAMES ---
                     usernames = {}
                     for uid in match["players"].keys():
                         db_id = uid
                         try:
                             if isinstance(uid, str) and ObjectId.is_valid(uid): db_id = ObjectId(uid)
                         except: pass
                         
                         user_obj = await user_repo.get_by_id(db_id)
                         usernames[uid] = user_obj["username"] if user_obj else "Opponent"

                     # --- B. SEND START WITH OPPONENT NAME ---
                     for uid, ws in match["players"].items():
                         # Find the OTHER player's ID
                         other_ids = [p for p in match["players"] if p != uid]
                         opponent_name = "Opponent"
                         if other_ids:
                             opponent_name = usernames.get(other_ids[0], "Opponent")
                         
                         start_payload = {
                             "type": "MATCH_START",
                             "gameData": {"rounds": match["rounds"]},
                             "opponent": opponent_name # <--- Send Name
                         }
                         await ws.send_json(start_payload)
                         
            # 2. SCORE
            elif msg.get("type") == "SCORE_UPDATE":
                match["scores"][user_id] = msg.get("score", 0)
                for pid, ws in match["players"].items():
                    if pid != user_id:
                        await ws.send_json({"type": "OPPONENT_UPDATE", "score": msg.get("score")})

            # 3. GAME OVER
            elif msg.get("type") == "GAME_OVER":
                match["scores"][user_id] = msg.get("finalScore", match["scores"][user_id])
                match["finished"].add(user_id)
                
                if len(match["finished"]) == 2:
                    await determine_winner(match_id)
                    match["is_active"] = False # Mark as DONE
                    break # Break loop to allow disconnect without error

    except WebSocketDisconnect:
        # Check if match exists AND is still active
        if match_id in active_matches:
            match = active_matches[match_id]
            
            # SKIP if game is already over (Normal disconnect after result)
            if not match["is_active"]: 
                pass
            else:
                print(f"🔌 Abnormal Disconnect: {user_id}")
                
                # Check if game had actually started
                game_was_running = len(match["ready"]) == 2
                
                remaining = [p for p in match["players"] if p != user_id]
                if remaining:
                    survivor = remaining[0]
                    if game_was_running:
                        # Real Forfeit
                        print(f"🏆 Forfeit Win for {survivor}")
                        await user_repo.update_wallet(survivor, 20.0)
                        await user_repo.increment_wins(survivor)
                        try:
                            await match["players"][survivor].send_json({"type": "OPPONENT_FORFEIT", "winner": survivor})
                        except: pass
                    else:
                        # Premature
                        print(f"⚠️ Match Aborted. Refunding {survivor}.")
                        await user_repo.update_wallet(survivor, 10.0) 
                        try:
                            await match["players"][survivor].send_json({"type": "MATCH_ABORTED", "message": "Opponent disconnected."})
                        except: pass
                
                # Clean up immediately on abnormal disconnect
                active_matches.pop(match_id, None)

    except Exception as e:
        print(f"❌ Crash: {e}")
    finally:
        if user_id: await release_user_lock(user_id)

async def determine_winner(match_id):
    if match_id not in active_matches: return
    match = active_matches[match_id]
    
    # Mark as inactive so disconnects don't trigger forfeit
    match["is_active"] = False 
    
    players = list(match["players"].keys())
    if len(players) != 2: return

    p1, p2 = players[0], players[1]
    s1, s2 = match["scores"].get(p1, 0), match["scores"].get(p2, 0)
    
    res_winner = "DRAW"
    winner_id, loser_id = None, None

    if s1 > s2:
        winner_id, loser_id = p1, p2
        res_winner = str(p1)
        await user_repo.update_wallet(p1, 20.0)
        await user_repo.increment_wins(p1)
    elif s2 > s1:
        winner_id, loser_id = p2, p1
        res_winner = str(p2)
        await user_repo.update_wallet(p2, 20.0)
        await user_repo.increment_wins(p2)
    else:
        await user_repo.update_wallet(p1, 10.0)
        await user_repo.update_wallet(p2, 10.0)

    print(f"📢 Result: {res_winner}")
    
    # Broadcast & Close
    for ws in match["players"].values():
        try:
            await ws.send_json({"type": "RESULT", "winner": res_winner, "scores": match["scores"]})
            await ws.close() # Force disconnect
        except: pass

    # Log
    try:
        db = user_repo.collection.database
        await db["match_history"].insert_one({
            "match_id": match_id,
            "winner_id": ObjectId(winner_id) if winner_id else "DRAW",
            "loser_id": ObjectId(loser_id) if loser_id else "DRAW",
            "scores": match["scores"],
            "timestamp": datetime.now(timezone.utc),
            "mode": "online_ranked"
        })
    except Exception as e: print(f"DB Error: {e}")

    if match_id in active_matches: del active_matches[match_id]