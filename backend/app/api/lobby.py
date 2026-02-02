import uuid
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from app.services.game_redis import get_user_from_token
from app.services.lobby_manager import lobby_manager
from app.services.wallet_service import WalletService
import logging

logger = logging.getLogger("uvicorn.error")
router = APIRouter()

# 🚀 NEW: HTTP endpoint for presence polling (mobile fallback)
@router.get("/presence/online")
async def get_online_users():
    """
    Returns a list of online user IDs. Clients can poll this every 30 seconds
    for presence updates, especially on mobile where WebSockets may fail.
    """
    try:
        online_users = await lobby_manager.get_online_users()
        return {"online_users": online_users}
    except Exception as e:
        logger.error(f"Error fetching online users: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch online users")

# 🚀 NEW: Health check endpoint to keep Render app awake
@router.get("/health")
async def health_check():
    """
    Simple health check. Clients should ping this every 5-10 minutes
    to prevent Render free tier from sleeping the app.
    """
    return {"status": "ok"}

@router.websocket("/ws/lobby")
async def lobby_endpoint(websocket: WebSocket, token: str = Query(...)):
    user_id = await get_user_from_token(token)
    if not user_id:
        await websocket.close(code=4001)
        return

    await lobby_manager.connect(user_id, websocket)

    # 🚀 UPDATED HEARTBEAT: Keeps Render Proxy alive AND refreshes presence
    async def heartbeat():
        try:
            while True:
                await asyncio.sleep(10)
                # Check if the connection is still open before sending
                if websocket.client_state.name == "CONNECTED":
                    await websocket.send_json({"type": "ping"})
                    # 🚀 NEW: Refresh presence to prevent expiry
                    await lobby_manager.refresh_presence(user_id)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Heartbeat error for {user_id}: {e}")

    heartbeat_task = asyncio.create_task(heartbeat())

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get('type')

            if msg_type in ['ping', 'pong']:
                continue

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
                    await websocket.send_json({"type": "ERROR", "message": "User is offline"})

            elif msg_type == 'ACCEPT_CHALLENGE':
                challenger_id = data['challenger_id']
                wallet = WalletService()
                bet_amount = 50.0

                try:
                    # Logic for charging both players
                    await wallet.deduct_entry_fee(challenger_id, bet_amount)
                    await wallet.deduct_entry_fee(user_id, bet_amount)
                except HTTPException as e:
                    # Refund logic (simplified for brevity)
                    await websocket.send_json({"type": "ERROR", "message": str(e.detail)})
                    continue

                match_id = f"match_{uuid.uuid4().hex[:8]}"
                start_msg = {"type": "MATCH_START", "match_id": match_id, "mode": "challenge"}
                
                # 🚀 UPDATED: Await sends to ensure they're flushed before breaking
                await websocket.send_json(start_msg)
                await lobby_manager.send_personal_message(start_msg, challenger_id)
                
                # 🚀 REMOVED: No need for sleep(1) hack—awaiting sends ensures flushing
                break  # Exit loop to trigger finally cleanup

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for {user_id}")
    except Exception as e:
        logger.error(f"Lobby Error for {user_id}: {e}")
    finally:
        heartbeat_task.cancel()
        # Ensure we wait for the task to actually stop
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass
        await lobby_manager.disconnect(user_id)