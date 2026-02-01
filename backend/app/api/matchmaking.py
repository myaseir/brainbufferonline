import uuid
import asyncio
import logging
from fastapi import WebSocket, Query, status
from app.db.redis import redis_client
from app.repositories.user_repo import UserRepository
from app.services.game_redis import get_user_from_token, redis_lock_user, redis_release_lock

logger = logging.getLogger("uvicorn.error")

async def matchmaking_endpoint(websocket: WebSocket, token: str = Query(...)):
    await websocket.accept()
    user_repo = UserRepository()
    user_id = await get_user_from_token(token)
    
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 1. Lock user to prevent multiple matchmaking sessions
    if not await redis_lock_user(user_id):
        await websocket.send_json({"type": "ERROR", "message": "Session already active."})
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    matched_successfully = False  # Track this for refund logic

    try:
        # 2. Check if a match was already created for us while we were reconnecting
        m_id = redis_client.get(f"notify:{user_id}")
        if m_id:
            m_id = m_id.decode() if isinstance(m_id, bytes) else str(m_id)
            await websocket.send_json({"type": "MATCH_FOUND", "match_id": m_id})
            redis_client.delete(f"notify:{user_id}")
            matched_successfully = True
            return

        # 3. Try to find an existing opponent
        opponent_id = redis_client.spop("matchmaking_pool")
        
        if opponent_id:
            opponent_id = opponent_id.decode() if isinstance(opponent_id, bytes) else str(opponent_id)
            
            if opponent_id == str(user_id):
                # Put self back and keep searching
                redis_client.sadd("matchmaking_pool", user_id)
            else:
                # Deduct fee for the match
                if not await user_repo.update_wallet(user_id, -50.0):
                    redis_client.sadd("matchmaking_pool", opponent_id) # Return opponent to pool
                    await websocket.send_json({"type": "ERROR", "message": "Insufficient Balance"})
                    await websocket.close()
                    return

                # Create Match
                match_id = f"match_{uuid.uuid4().hex[:8]}"
                # Notify the waiting opponent
                redis_client.set(f"notify:{opponent_id}", match_id, ex=120)
                # Notify current user
                await websocket.send_json({"type": "MATCH_FOUND", "match_id": match_id})
                matched_successfully = True
                return
        
        # 4. No opponent found -> Join the pool
        if not await user_repo.update_wallet(user_id, -50.0):
            await websocket.send_json({"type": "ERROR", "message": "Insufficient Balance"})
            await websocket.close()
            return

        redis_client.sadd("matchmaking_pool", user_id)
        await websocket.send_json({"type": "SEARCHING"})
        
        # 5. Wait Loop (Wait for someone else to pick us)
        for _ in range(60):
            await asyncio.sleep(1)
            # Check if someone matched with us
            m_id = redis_client.get(f"notify:{user_id}")
            if m_id:
                m_id = m_id.decode() if isinstance(m_id, bytes) else str(m_id)
                await websocket.send_json({"type": "MATCH_FOUND", "match_id": m_id})
                redis_client.delete(f"notify:{user_id}")
                matched_successfully = True
                return
            
            # Send heartbeat to keep client informed
            try:
                await websocket.send_json({"type": "WAITING"})
            except:
                break # Client disconnected

        if not matched_successfully:
            await websocket.send_json({"type": "TIMEOUT"})

    except Exception as e:
        logger.error(f"WebSocket Matchmaking Error: {e}")
        await websocket.send_json({"type": "ERROR", "message": "Internal Server Error"})
    
    finally:
        # --- THE CRITICAL REFUND LOGIC ---
        # If we reach here and NO match was found, we MUST refund
        in_pool = redis_client.srem("matchmaking_pool", user_id)
        if not matched_successfully and in_pool:
            await user_repo.update_wallet(user_id, 50.0)
            logger.info(f"Refunded 50 PKR to {user_id} on disconnect/timeout.")
        
        await redis_release_lock(user_id)
        try:
            await websocket.close()
        except:
            pass