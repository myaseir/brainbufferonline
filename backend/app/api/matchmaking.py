import uuid
import asyncio
import logging
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

    # 2. Prevent Double Entry (Lock)
    if not await redis_lock_user(u_id_str):
        await websocket.send_json({"type": "ERROR", "message": "Session already active."})
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    matched_successfully = False 
    match_id = None

    try:
        # 3. Wallet Check & Initial Deduction
        # We deduct upfront to "stake" the entry. Refund happens in 'finally' block if no match.
        if not await user_repo.update_wallet(u_id_str, -50.0):
            await websocket.send_json({"type": "ERROR", "message": "Insufficient Balance"})
            await websocket.close()
            return

        # 4. THE ATOMIC MOMENT (Lua Script)
        # This replaces the old spop/sadd mess.
        result = await redis_mgr.try_match_or_join(u_id_str)

        if result and result != "WAITING":
            # --- CASE A: WE FOUND AN OPPONENT ---
            opponent_id = result.decode() if isinstance(result, bytes) else str(result)
            match_id = f"match_{uuid.uuid4().hex[:8]}"
            
            # Create the permanent record in MongoDB
            await match_repo.create_match_record(match_id, opponent_id, u_id_str, 50.0)
            
            # Notify the opponent (who is currently in their wait loop)
            await asyncio.to_thread(redis_client.set, f"notify:{opponent_id}", match_id, ex=300)
            
            await websocket.send_json({"type": "MATCH_FOUND", "match_id": match_id})
            matched_successfully = True
            return

        # --- CASE B: WE ARE IN THE POOL (WAITING) ---
        await websocket.send_json({"type": "SEARCHING"})
        
        # 5. PASSIVE WAIT LOOP
        # We wait for 30 cycles (90 seconds). 
        # We check if an "Aggressor" has picked us and set our 'notify' key.
        for i in range(30): 
            await asyncio.sleep(3) 
            
            # Check for notification from an opponent
            m_id = await asyncio.to_thread(redis_client.get, f"notify:{u_id_str}")
            if m_id:
                match_id = m_id.decode() if isinstance(m_id, bytes) else str(m_id)
                await websocket.send_json({"type": "MATCH_FOUND", "match_id": match_id})
                await asyncio.to_thread(redis_client.delete, f"notify:{u_id_str}")
                matched_successfully = True
                return
            
            # Heartbeat to keep UI alive
            try:
                await websocket.send_json({"type": "WAITING"})
            except:
                break 

        # If loop finishes without match
        await websocket.send_json({"type": "TIMEOUT"})

    except Exception as e:
        logger.error(f"WebSocket Matchmaking Error: {e}")
        try:
            await websocket.send_json({"type": "ERROR", "message": "Internal match error."})
        except:
            pass
    
    finally:
        # 6. Cleanup & Refund Logic
        # Try to remove from pool. If removed == 1, they were still waiting and need a refund.
        removed = await redis_mgr.remove_from_matchmaking(u_id_str)
        
        if not matched_successfully and removed:
            await user_repo.update_wallet(u_id_str, 50.0)
            logger.info(f"Refunded 50 PKR to {u_id_str}")
        
        await redis_release_lock(u_id_str)
        try:
            await websocket.close()
        except:
            pass