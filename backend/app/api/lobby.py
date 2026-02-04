import uuid
import asyncio
import json
import logging
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from app.services.game_redis import get_user_from_token
from app.services.lobby_manager import lobby_manager
from app.services.wallet_service import WalletService
from app.db.redis import redis_client

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

@router.websocket("/ws/lobby")
async def lobby_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    Global Lobby Socket optimized for production and Redis Free Tier.
    """
    
    # 1. Authenticate
    user_id = await get_user_from_token(token)
    if not user_id:
        await websocket.close(code=4001)
        return

    # 2. Connect to Lobby Manager
    await lobby_manager.connect(user_id, websocket)

    # 🚀 3. HEARTBEAT TASK
    async def heartbeat():
        try:
            while True:
                await asyncio.sleep(25)
                await websocket.send_json({"type": "ping"})
        except asyncio.CancelledError:
            pass
        except Exception:
            pass

    heartbeat_task = asyncio.create_task(heartbeat())

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get('type')

            if msg_type in ['pong', 'ping']:
                continue

            # ==========================================
            # 1. SEND CHALLENGE
            # ==========================================
            if msg_type == 'SEND_CHALLENGE':
                target_id = data.get('target_id')
                challenger_name = data.get('username', 'Unknown')
                
                sent = await lobby_manager.send_personal_message({
                    "type": "INCOMING_CHALLENGE",
                    "challenger_id": user_id,
                    "challenger_name": challenger_name,
                    "bet_amount": 50
                }, target_id)
                
                if not sent:
                    await websocket.send_json({"type": "ERROR", "message": "User is offline"})

            # ==========================================
            # 2. ACCEPT CHALLENGE
            # ==========================================
            elif msg_type == 'ACCEPT_CHALLENGE':
                challenger_id = data.get('challenger_id')
                accepter_id = user_id
                wallet = WalletService()
                bet_amount = 50.0

                try:
                    await wallet.deduct_entry_fee(challenger_id, bet_amount)
                except HTTPException:
                    error_msg = {"type": "ERROR", "message": "Challenger has insufficient funds"}
                    await websocket.send_json(error_msg)
                    await lobby_manager.send_personal_message(error_msg, challenger_id)
                    continue

                try:
                    await wallet.deduct_entry_fee(accepter_id, bet_amount)
                except HTTPException:
                    await wallet.refund_user(challenger_id, bet_amount)
                    error_msg = {"type": "ERROR", "message": "Insufficient funds for entry fee"}
                    await websocket.send_json(error_msg)
                    await lobby_manager.send_personal_message({
                        "type": "ERROR", 
                        "message": "Opponent has insufficient funds. Fee refunded."
                    }, challenger_id)
                    continue

                # C. Success: Register Match in Redis
                match_id = f"match_{uuid.uuid4().hex[:8]}"
                match_key = f"match:live:{match_id}"

                # ✅ FIXED: Flattening the dictionary for Upstash compatibility
                # We pass the key-value pairs directly into hset
                pipe = redis_client.pipeline()
                pipe.hset(match_key, "p1_id", challenger_id)
                pipe.hset(match_key, "p2_id", accepter_id)
                pipe.hset(match_key, "bet_pkr", str(bet_amount))
                pipe.hset(match_key, "status", "CREATED")
                pipe.hset(match_key, "mode", "challenge")
                pipe.hset(match_key, "created_at", str(datetime.now()))
                
                pipe.expire(match_key, 600) 
                await asyncio.to_thread(pipe.exec)

                start_msg = {
                    "type": "MATCH_START", 
                    "match_id": match_id,
                    "mode": "challenge"
                }
                
                await websocket.send_json(start_msg)
                await lobby_manager.send_personal_message(start_msg, challenger_id)

    except WebSocketDisconnect:
        pass 
    
    except Exception as e:
        logger.error(f"⚠️ Critical Lobby Error for User {user_id}: {e}")
    
    finally:
        if not heartbeat_task.done():
            heartbeat_task.cancel()
        await lobby_manager.disconnect(user_id)