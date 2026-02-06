import uuid
import asyncio
import logging
import random
from fastapi import WebSocket, Query, status
from app.db.redis import redis_mgr, redis_client
from app.repositories.user_repo import UserRepository
from app.repositories.match_repo import MatchRepository
from app.services.game_redis import (
    get_user_from_token, 
    redis_lock_user, 
    redis_release_lock
)

logger = logging.getLogger("uvicorn.error")

async def matchmaking_endpoint(websocket: WebSocket, token: str = Query(...)):
    await websocket.accept()
    user_repo = UserRepository()
    match_repo = MatchRepository()
    
    # 1. Identity & Auth
    user_id = await get_user_from_token(token)
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    u_id_str = str(user_id)

    # 🚨 GATEKEEPER: Prevent Bots from initiating matchmaking
    # Bots should only ENTER matches via the Bot Service, not SEARCH for them.
    if u_id_str.startswith("BOT"):
        logger.warning(f"🛑 Bot {u_id_str} attempted to initiate matchmaking. Connection refused.")
        await websocket.send_json({"type": "ERROR", "message": "Bots cannot initiate matchmaking."})
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. Prevent Double Entry (Lock)
    if not await redis_lock_user(u_id_str):
        await websocket.send_json({"type": "ERROR", "message": "Session already active."})
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    matched_successfully = False 
    match_id = None

    try:
        # 3. Wallet Check & Initial Deduction
        if not await user_repo.update_wallet(u_id_str, -50.0):
            await websocket.send_json({"type": "ERROR", "message": "Insufficient Balance"})
            await websocket.close()
            return

        # 4. THE ATOMIC MOMENT (Lua Script)
        result = await redis_mgr.try_match_or_join(u_id_str)

        if result and result != "WAITING":
            # --- CASE A: WE FOUND A HUMAN OPPONENT ---
            opponent_id = result.decode() if isinstance(result, bytes) else str(result)
            match_id = f"match_{uuid.uuid4().hex[:8]}"
            
            await match_repo.create_match_record(match_id, opponent_id, u_id_str, 50.0)
            await asyncio.to_thread(redis_client.set, f"notify:{opponent_id}", match_id, ex=300)
            
            await websocket.send_json({"type": "MATCH_FOUND", "match_id": match_id})
            matched_successfully = True
            return

        # --- CASE B: WE ARE IN THE POOL (WAITING) ---
        await websocket.send_json({"type": "SEARCHING"})
        
        # 5. 3-SECOND WAIT LOOP FOR BOT FALLBACK
        for i in range(6): 
            await asyncio.sleep(1) 
            
            m_id = await asyncio.to_thread(redis_client.get, f"notify:{u_id_str}")
            if m_id:
                match_id = m_id.decode() if isinstance(m_id, bytes) else str(m_id)
                await websocket.send_json({"type": "MATCH_FOUND", "match_id": match_id})
                await asyncio.to_thread(redis_client.delete, f"notify:{u_id_str}")
                matched_successfully = True
                return
            
            try:
                await websocket.send_json({"type": "WAITING"})
            except:
                break 

        # 🔥 6. BOT FALLBACK TRIGGER (Only for humans who haven't found a match)
        removed_from_pool = await redis_mgr.remove_from_matchmaking(u_id_str)
        
        if removed_from_pool:
            bot_num = random.randint(1, 20)
            bot_id = f"BOT_{bot_num:03d}"
            match_id = f"match_{uuid.uuid4().hex[:8]}"

            await match_repo.create_match_record(match_id, bot_id, u_id_str, 50.0)
            
            match_key = f"match:live:{match_id}"
            await asyncio.to_thread(
                redis_client.hset, 
                match_key, 
                values={
                    "p1_id": u_id_str,
                    "p2_id": bot_id,
                    "status": "CREATED",
                    "bet_amount": "50.0"
                }
            )
            await asyncio.to_thread(redis_client.expire, match_key, 600)

            await websocket.send_json({"type": "MATCH_FOUND", "match_id": match_id})
            matched_successfully = True
            return

    except Exception as e:
        logger.error(f"WebSocket Matchmaking Error: {e}")
        try:
            await websocket.send_json({"type": "ERROR", "message": "Internal match error."})
        except:
            pass
    
    finally:
        if not matched_successfully:
            removed = await redis_mgr.remove_from_matchmaking(u_id_str)
            if removed:
                await user_repo.update_wallet(u_id_str, 50.0)
                logger.info(f"Refunded 50 PKR to {u_id_str}")
        
        await redis_release_lock(u_id_str)
        try:
            await websocket.close()
        except:
            pass