import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from app.services.game_redis import get_user_from_token
from app.services.lobby_manager import lobby_manager
from app.services.wallet_service import WalletService

router = APIRouter()

@router.websocket("/ws/lobby")
async def lobby_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    Global Lobby Socket.
    Handles:
    1. Online Presence (Green dot in friend list)
    2. Sending/Receiving Challenges
    3. Money Transaction for Challenges
    """
    
    # 1. Authenticate
    user_id = await get_user_from_token(token)
    if not user_id:
        await websocket.close(code=4001)
        return

    # 2. Connect to Lobby Manager
    await lobby_manager.connect(user_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get('type')

            # ==========================================
            # 1. SEND CHALLENGE (Signal only)
            # ==========================================
            if msg_type == 'SEND_CHALLENGE':
                target_id = data['target_id']
                challenger_name = data.get('username', 'Unknown')
                
                # Forward the request to the specific friend
                sent = await lobby_manager.send_personal_message({
                    "type": "INCOMING_CHALLENGE",
                    "challenger_id": user_id,
                    "challenger_name": challenger_name,
                    "bet_amount": 50  # Hardcoded for now, or dynamic later
                }, target_id)
                
                if not sent:
                    await websocket.send_json({"type": "ERROR", "message": "User is offline or not in lobby"})

            # ==========================================
            # 2. ACCEPT CHALLENGE (Money Handling)
            # ==========================================
            elif msg_type == 'ACCEPT_CHALLENGE':
                challenger_id = data['challenger_id']
                accepter_id = user_id  # This is Me
                
                wallet = WalletService()
                bet_amount = 50.0

                # --- STEP A: Charge the Challenger (The other guy) ---
                try:
                    await wallet.deduct_entry_fee(challenger_id, bet_amount)
                except HTTPException:
                    # If Challenger is broke, tell everyone and abort
                    error_msg = {"type": "ERROR", "message": "Match Failed: Challenger has insufficient funds"}
                    await websocket.send_json(error_msg) # Tell Me
                    await lobby_manager.send_personal_message(error_msg, challenger_id) # Tell Him
                    continue

                # --- STEP B: Charge the Accepter (Me) ---
                try:
                    await wallet.deduct_entry_fee(accepter_id, bet_amount)
                except HTTPException:
                    # 🚨 CRITICAL: I am broke, but we already took money from Challenger!
                    # WE MUST REFUND THE CHALLENGER IMMEDIATELY
                    await wallet.user_repo.update_wallet(challenger_id, bet_amount)
                    
                    error_msg = {"type": "ERROR", "message": "Match Failed: You have insufficient funds"}
                    await websocket.send_json(error_msg)
                    
                    # Tell Challenger why it failed (and that they got refunded)
                    await lobby_manager.send_personal_message({
                        "type": "ERROR", 
                        "message": "Match declined: Opponent has insufficient funds (Your fee was refunded)"
                    }, challenger_id)
                    continue

                # --- STEP C: Success! Start the Game ---
                match_id = f"match_{uuid.uuid4().hex[:8]}"
                start_msg = {
                    "type": "MATCH_START", 
                    "match_id": match_id,
                    "mode": "challenge"
                }
                
                # Redirect Me
                await websocket.send_json(start_msg)
                # Redirect Him
                await lobby_manager.send_personal_message(start_msg, challenger_id)

    except WebSocketDisconnect:
        await lobby_manager.disconnect(user_id)
    except Exception as e:
        # Catch-all to ensure we don't crash the server loop silently
        print(f"Lobby Error for {user_id}: {e}")
        await lobby_manager.disconnect(user_id)