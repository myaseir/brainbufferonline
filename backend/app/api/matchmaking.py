import uuid
import asyncio
from fastapi import WebSocket, Query, status
from app.db.redis import redis_client
from app.repositories.user_repo import UserRepository
from app.services.game_redis import get_user_from_token, redis_lock_user, redis_release_lock

async def matchmaking_endpoint(websocket: WebSocket, token: str = Query(...)):
    await websocket.accept()
    user_repo = UserRepository()
    user_id = await get_user_from_token(token)
    
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    if not await redis_lock_user(user_id):
        await websocket.send_json({"type": "ERROR", "message": "Session already active."})
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        m_id = redis_client.get(f"notify:{user_id}")
        if m_id:
            m_id = m_id.decode() if isinstance(m_id, bytes) else str(m_id)
            await websocket.send_json({"type": "MATCH_FOUND", "match_id": m_id})
            return

        opponent_id = redis_client.spop("matchmaking_pool")
        if opponent_id:
            opponent_id = opponent_id.decode() if isinstance(opponent_id, bytes) else str(opponent_id)
            
            if opponent_id == str(user_id):
                redis_client.sadd("matchmaking_pool", user_id)
                await websocket.send_json({"type": "SEARCHING"})
            else:
                if not await user_repo.update_wallet(user_id, -50.0):
                    redis_client.sadd("matchmaking_pool", opponent_id)
                    await websocket.send_json({"type": "ERROR", "message": "Insufficient Balance"})
                    await websocket.close()
                    return

                match_id = f"match_{uuid.uuid4().hex[:8]}"
                redis_client.set(f"notify:{opponent_id}", match_id, ex=120)
                await websocket.send_json({"type": "MATCH_FOUND", "match_id": match_id})
                return
        else:
            if not await user_repo.update_wallet(user_id, -50.0):
                await websocket.send_json({"type": "ERROR", "message": "Insufficient Balance"})
                await websocket.close()
                return

            redis_client.sadd("matchmaking_pool", user_id)
            await websocket.send_json({"type": "SEARCHING"})
            
            for _ in range(60):
                await asyncio.sleep(1)
                m_id = redis_client.get(f"notify:{user_id}")
                if m_id:
                    m_id = m_id.decode() if isinstance(m_id, bytes) else str(m_id)
                    await websocket.send_json({"type": "MATCH_FOUND", "match_id": m_id})
                    redis_client.delete(f"notify:{user_id}")
                    return
                await websocket.send_json({"type": "WAITING"})

            await websocket.send_json({"type": "TIMEOUT"})
            await user_repo.update_wallet(user_id, 50.0)

    finally:
        redis_client.srem("matchmaking_pool", user_id)
        await redis_release_lock(user_id)