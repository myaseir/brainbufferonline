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
from app.core.store import connected_matchmaking_users, active_matches, user_locks

router = APIRouter()
logger = logging.getLogger("uvicorn.error")
user_repo = UserRepository()

match_queue: asyncio.Queue = asyncio.Queue()
pairings: Dict[str, str] = {} 

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
        if not payload: return None
        return payload.get("sub")
    except Exception as e:
        print(f"❌ Token Validation Error: {str(e)}")
        return None

async def acquire_user_lock(user_id: str) -> bool:
    if user_id in user_locks: return False
    user_locks.add(user_id)
    return True

async def release_user_lock(user_id: str):
    user_locks.discard(user_id)

async def find_or_enqueue_match(user_id: str):
    while not match_queue.empty():
        waiting_user = await match_queue.get()
        if waiting_user == user_id: continue
        if waiting_user not in connected_matchmaking_users: continue 
        
        match_id = f"match_{uuid.uuid4().hex[:8]}"
        pairings[user_id] = match_id
        pairings[waiting_user] = match_id
        return match_id

    await match_queue.put(user_id)
    return None

# --- 📡 MATCHMAKING ENDPOINT ---
@router.websocket("/ws/matchmaking")
async def matchmaking_endpoint(websocket: WebSocket, token: str = Query(...)):
    await websocket.accept()
    user_id = await get_user_from_token(token)

    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    if user_id in user_locks: await release_user_lock(user_id)
    if not await acquire_user_lock(user_id):
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

    except Exception as e:
        print(f"⚠️ Matchmaking Exception: {e}")
    finally:
        connected_matchmaking_users.discard(user_id)
        await release_user_lock(user_id)

# --- ⚡ GAME LOGIC ENDPOINT ---
@router.websocket("/ws/match/{match_id}")
async def game_websocket_endpoint(websocket: WebSocket, match_id: str, token: str = Query(...)):
    await websocket.accept()
    user_id = await get_user_from_token(token)
    
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        if match_id not in active_matches:
            active_matches[match_id] = {
                "players": {},
                "usernames": {},
                "charged_players": set(),
                "rounds": generate_fair_game(20),
                "scores": {},
                "ready": set(),
                "finished": set(),
                "is_active": True
            }
        
        match = active_matches[match_id]
        
        if user_id not in match["charged_players"]:
            user = await user_repo.get_by_id(user_id)
            if not user or user.get("wallet_balance", 0) < 50:
                await websocket.send_json({"type": "ERROR", "message": "Insufficient Balance"})
                await websocket.close()
                return

            await user_repo.update_wallet(user_id, -50.0)
            match["charged_players"].add(user_id)
            match["usernames"][user_id] = user.get("username", "Unknown")

        match["players"][user_id] = websocket
        match["scores"][user_id] = 0

        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            if msg.get("type") == "CLIENT_READY":
                match["ready"].add(user_id)
                if len(match["ready"]) == 2:
                    for uid, ws in match["players"].items():
                        other_ids = [p for p in match["players"] if p != uid]
                        opp_name = match["usernames"].get(other_ids[0], "Opponent") if other_ids else "Opponent"
                        await ws.send_json({
                            "type": "MATCH_START", 
                            "gameData": {"rounds": match["rounds"]}, 
                            "opponent": opp_name
                        })
                          
            elif msg.get("type") == "SCORE_UPDATE":
                match["scores"][user_id] = msg.get("score", 0)
                for pid, ws in match["players"].items():
                    if pid != user_id:
                        await ws.send_json({"type": "OPPONENT_UPDATE", "score": msg.get("score")})

            elif msg.get("type") == "GAME_OVER":
                match["scores"][user_id] = msg.get("finalScore", match["scores"][user_id])
                match["finished"].add(user_id)
                if len(match["finished"]) == 2:
                    await determine_winner(match_id)
                    break 

    except WebSocketDisconnect:
        if match_id in active_matches:
            match = active_matches[match_id]
            if match["is_active"]:
                game_was_running = len(match["ready"]) == 2
                remaining = [p for p in match["players"] if p != user_id]
                leaver_name = match["usernames"].get(user_id, "Opponent")

                if remaining:
                    survivor = remaining[0]
                    survivor_name = match["usernames"].get(survivor, "Survivor")
                    now = datetime.now(timezone.utc)

                    if game_was_running:
                        # 🏆 Win by forfeit
                        await user_repo.update_wallet(survivor, 90.0)
                        await user_repo.record_match_stats(survivor, is_win=True)
                        
                        # Save History for Survivor
                        await user_repo.add_match_to_history(survivor, {
                            "opponent": leaver_name, "result": "WIN", "payout": 90, "date": now
                        })
                        # Save History for Leaver
                        await user_repo.add_match_to_history(user_id, {
                            "opponent": survivor_name, "result": "LOSS", "payout": 0, "date": now
                        })

                        try:
                            await match["players"][survivor].send_json({
                                "type": "OPPONENT_FORFEIT", 
                                "winner": survivor,
                                "leaver_name": leaver_name
                            })
                            await match["players"][survivor].close()
                        except: pass
                    else:
                        # Match aborted before start - Refund
                        await user_repo.update_wallet(survivor, 50.0)
                        try:
                            await match["players"][survivor].send_json({"type": "MATCH_ABORTED", "message": f"{leaver_name} left."})
                            await match["players"][survivor].close()
                        except: pass
                
                active_matches.pop(match_id, None)
    finally:
        if user_id: await release_user_lock(user_id)

async def determine_winner(match_id):
    if match_id not in active_matches: return
    match = active_matches[match_id]
    match["is_active"] = False 
    
    players = list(match["players"].keys())
    if len(players) != 2: 
        active_matches.pop(match_id, None)
        return

    p1, p2 = players[0], players[1]
    s1, s2 = match["scores"].get(p1, 0), match["scores"].get(p2, 0)
    u1_name, u2_name = match["usernames"].get(p1, "Opponent"), match["usernames"].get(p2, "Opponent")
    
    now = datetime.now(timezone.utc)
    res_status = "DRAW"

    if s1 > s2:
        # P1 Wins
        await user_repo.update_wallet(p1, 90.0)
        await user_repo.record_match_stats(p1, is_win=True)
        await user_repo.add_match_to_history(p1, {"opponent": u2_name, "result": "WIN", "payout": 90, "date": now})
        
        await user_repo.record_match_stats(p2, is_win=False)
        await user_repo.add_match_to_history(p2, {"opponent": u1_name, "result": "LOSS", "payout": 0, "date": now})
        res_status = str(p1)
    elif s2 > s1:
        # P2 Wins
        await user_repo.update_wallet(p2, 90.0)
        await user_repo.record_match_stats(p2, is_win=True)
        await user_repo.add_match_to_history(p2, {"opponent": u1_name, "result": "WIN", "payout": 90, "date": now})
        
        await user_repo.record_match_stats(p1, is_win=False)
        await user_repo.add_match_to_history(p1, {"opponent": u2_name, "result": "LOSS", "payout": 0, "date": now})
        res_status = str(p2)
    else:
        # Draw - Refund both and record history
        for pid in [p1, p2]:
            opp = u2_name if pid == p1 else u1_name
            await user_repo.update_wallet(pid, 50.0)
            await user_repo.record_match_stats(pid, is_win=False) # Only total_matches++
            await user_repo.add_match_to_history(pid, {"opponent": opp, "result": "DRAW", "payout": 50, "date": now})

    # Broadcast Results
    for ws in match["players"].values():
        try:
            await ws.send_json({"type": "RESULT", "winner": res_status, "scores": match["scores"]})
            await ws.close()
        except: pass
    
    active_matches.pop(match_id, None)