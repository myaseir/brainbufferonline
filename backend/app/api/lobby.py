import uuid
import asyncio  # 🚀 ADDED: Required for the heartbeat task
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from app.services.game_redis import get_user_from_token
from app.services.lobby_manager import lobby_manager
from app.services.wallet_service import WalletService

router = APIRouter()

@router.websocket("/ws/lobby")
async def lobby_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    Global Lobby Socket optimized for Render.
    Handles:
    1. Online Presence (Green dot in friend list)
    2. Sending/Receiving Challenges
    3. Money Transaction for Challenges
    4. Heartbeat to maintain connection
    """
    
    # 1. Authenticate
    user_id = await get_user_from_token(token)
    if not user_id:
        await websocket.close(code=4001)
        return

    # 2. Connect to Lobby Manager
    await lobby_manager.connect(user_id, websocket)

    # 🚀 3. HEARTBEAT TASK: Prevents Render from killing the socket
    async def heartbeat():
        try:
            while True:
                await asyncio.sleep(25)  # Send every 25s (Render timeout is ~55s)
                await websocket.send_json({"type": "ping"})
        except Exception:
            # Task will be cancelled automatically on disconnect
            pass

    # Start heartbeat in background
    heartbeat_task = asyncio.create_task(heartbeat())

    try:
        while True:
            # 4. Receive messages from client
            data = await websocket.receive_json()
            msg_type = data.get('type')

            # Ignore incoming pings from client if they send any
            if msg_type == 'pong' or msg_type == 'ping':
                continue

            # ==========================================
            # 1. SEND CHALLENGE (Signal only)
            # ==========================================
            if msg_type == 'SEND_CHALLENGE':
                target_id = data['target_id']
                challenger_name = data.get('username', 'Unknown')
                
                sent = await lobby_manager.send_personal_message({
                    "type": "INCOMING_CHALLENGE",
                    "challenger_id": user_id,
                    "challenger_name": challenger_name,
                    "bet_amount": 50
                }, target_id)
                
                if not sent:
                    await websocket.send_json({"type": "ERROR", "message": "User is offline or not in lobby"})

            # ==========================================
            # 2. ACCEPT CHALLENGE (Money Handling)
            # ==========================================
            elif msg_type == 'ACCEPT_CHALLENGE':
                challenger_id = data['challenger_id']
                accepter_id = user_id
                
                wallet = WalletService()
                bet_amount = 50.0

                try:
                    # Charge Challenger
                    await wallet.deduct_entry_fee(challenger_id, bet_amount)
                except HTTPException:
                    error_msg = {"type": "ERROR", "message": "Match Failed: Challenger has insufficient funds"}
                    await websocket.send_json(error_msg)
                    await lobby_manager.send_personal_message(error_msg, challenger_id)
                    continue

                try:
                    # Charge Accepter (Me)
                    await wallet.deduct_entry_fee(accepter_id, bet_amount)
                except HTTPException:
                    # Refund Challenger
                    await wallet.user_repo.update_wallet(challenger_id, bet_amount)
                    
                    error_msg = {"type": "ERROR", "message": "Match Failed: You have insufficient funds"}
                    await websocket.send_json(error_msg)
                    await lobby_manager.send_personal_message({
                        "type": "ERROR", 
                        "message": "Match declined: Opponent has insufficient funds (Your fee was refunded)"
                    }, challenger_id)
                    continue

                # Success! Start the Game
                match_id = f"match_{uuid.uuid4().hex[:8]}"
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
        print(f"Lobby Error for {user_id}: {e}")
    finally:
        # 🚀 5. CLEANUP: Cancel heartbeat and disconnect presence
        heartbeat_task.cancel()
        await lobby_manager.disconnect(user_id)