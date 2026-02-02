import uuid
import asyncio
import logging
from fastapi import WebSocket, Query, status
from app.db.redis import redis_client
from app.repositories.user_repo import UserRepository
from app.services.game_redis import (
    get_user_from_token, 
    redis_lock_user, 
    redis_release_lock
)

logger = logging.getLogger("uvicorn.error")

async def matchmaking_endpoint(websocket: WebSocket, token: str = Query(...)):
    await websocket.accept()
    user_repo = UserRepository()
    
    # 1. Identity & Auth
    user_id = await get_user_from_token(token)
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    u_id_str = str(user_id)

    # 2. Prevent Double Entry
    if not await redis_lock_user(u_id_str):
        await websocket.send_json({"type": "ERROR", "message": "Session already active."})
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    matched_successfully = False 

    try:
        # 3. Pre-check: Did someone already match us?
        m_id = await asyncio.to_thread(redis_client.get, f"notify:{u_id_str}")
        if m_id:
            m_id = m_id.decode() if isinstance(m_id, bytes) else str(m_id)
            await websocket.send_json({"type": "MATCH_FOUND", "match_id": m_id})
            await asyncio.to_thread(redis_client.delete, f"notify:{u_id_str}")
            matched_successfully = True
            return

        # 4. Initial Search: Try to find someone already in the pool
        opponent_id = await asyncio.to_thread(redis_client.spop, "matchmaking_pool")
        
        if opponent_id:
            opponent_id = opponent_id.decode() if isinstance(opponent_id, bytes) else str(opponent_id)
            
            if opponent_id == u_id_str:
                # If we accidentally popped ourselves, put back and proceed to wait
                await asyncio.to_thread(redis_client.sadd, "matchmaking_pool", u_id_str)
            else:
                # Found someone! Deduct fee and create match
                if not await user_repo.update_wallet(u_id_str, -50.0):
                    # Return opponent to pool if we can't pay
                    await asyncio.to_thread(redis_client.sadd, "matchmaking_pool", opponent_id) 
                    await websocket.send_json({"type": "ERROR", "message": "Insufficient Balance"})
                    await websocket.close()
                    return

                match_id = f"match_{uuid.uuid4().hex[:8]}"
                await asyncio.to_thread(redis_client.set, f"notify:{opponent_id}", match_id, ex=120)
                
                await websocket.send_json({"type": "MATCH_FOUND", "match_id": match_id})
                matched_successfully = True
                return
        
        # 5. Join Pool: Pay the fee and wait to be picked
        if not await user_repo.update_wallet(u_id_str, -50.0):
            await websocket.send_json({"type": "ERROR", "message": "Insufficient Balance"})
            await websocket.close()
            return

        await asyncio.to_thread(redis_client.sadd, "matchmaking_pool", u_id_str)
        await websocket.send_json({"type": "SEARCHING"})
        
        # 6. 🚀 ACTIVE WAIT LOOP (Quota Saver + Deadlock Buster)
        # We wait 3 seconds between checks to stay safe on Upstash Free Tier.
        for i in range(20): 
            await asyncio.sleep(3) 
            
            # A. Check if someone matched with us (Passive check)
            m_id = await asyncio.to_thread(redis_client.get, f"notify:{u_id_str}")
            if m_id:
                m_id = m_id.decode() if isinstance(m_id, bytes) else str(m_id)
                await websocket.send_json({"type": "MATCH_FOUND", "match_id": m_id})
                await asyncio.to_thread(redis_client.delete, f"notify:{u_id_str}")
                matched_successfully = True
                return
            
            # B. Active Check: Occasionally try to grab someone else from the pool
            # This prevents the issue where two players are both just "waiting" for each other.
            if i % 2 == 1: # Every 6 seconds, try to be the "Aggressor"
                potential_opponent = await asyncio.to_thread(redis_client.spop, "matchmaking_pool")
                if potential_opponent:
                    potential_opponent = potential_opponent.decode() if isinstance(potential_opponent, bytes) else str(potential_opponent)
                    
                    if potential_opponent != u_id_str:
                        # Success! We found someone while we were waiting.
                        match_id = f"match_{uuid.uuid4().hex[:8]}"
                        await asyncio.to_thread(redis_client.set, f"notify:{potential_opponent}", match_id, ex=120)
                        # We must remove ourselves from the pool before leaving
                        await asyncio.to_thread(redis_client.srem, "matchmaking_pool", u_id_str)
                        
                        await websocket.send_json({"type": "MATCH_FOUND", "match_id": match_id})
                        matched_successfully = True
                        return
                    else:
                        # Put ourselves back in
                        await asyncio.to_thread(redis_client.sadd, "matchmaking_pool", u_id_str)

            # UI Update/Heartbeat
            try:
                await websocket.send_json({"type": "WAITING"})
            except:
                break 

        if not matched_successfully:
            await websocket.send_json({"type": "TIMEOUT"})

    except Exception as e:
        logger.error(f"WebSocket Matchmaking Error: {e}")
        try:
            await websocket.send_json({"type": "ERROR", "message": "Internal match error."})
        except:
            pass
    
    finally:
        # 7. Cleanup & Refund
        # Ensure we are out of the pool
        in_pool = await asyncio.to_thread(redis_client.srem, "matchmaking_pool", u_id_str)
        if not matched_successfully and in_pool:
            await user_repo.update_wallet(u_id_str, 50.0)
            logger.info(f"Refunded 50 PKR to {u_id_str}")
        
        await redis_release_lock(u_id_str)
        try:
            await websocket.close()
        except:
            pass