import asyncio
import websockets
import json
from jose import jwt
from datetime import datetime, timedelta

# --- CONFIGURATION ---
# Using 127.0.0.1 is more stable than 'localhost' on Windows
BASE_URL = "127.0.0.1:8000"
WS_URL = f"ws://{BASE_URL}"

# Ensure this EXACTLY matches your .env SECRET_KEY
SECRET_KEY = "697b11d212267043f3c25731697b392a0a7f2c914a954987"
ALGORITHM = "HS256"

def create_test_token(user_id: str):
    """Generates a valid JWT token with all required claims."""
    now = datetime.utcnow()
    expire = now + timedelta(hours=2)
    to_encode = {
        "iat": now,
        "nbf": now,
        "exp": expire,
        "sub": str(user_id)
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def simulate_player(player_name: str, mongodb_id: str, is_winner: bool = False):
    print(f"[{player_name}] Initializing with ID: {mongodb_id}")
    token = create_test_token(mongodb_id)

    try:
        # --- 1. Matchmaking Queue ---
        # UPDATED: Added /api/game prefix to match your main.py router
        match_uri = f"{WS_URL}/api/game/ws/matchmaking?token={token}"
        
        async with websockets.connect(match_uri, open_timeout=20) as ws:
            print(f"[{player_name}] Searching for match...")
            while True:
                resp = json.loads(await ws.recv())
                print(f"[{player_name}] Server: {resp}")
                
                if resp.get("status") == "MATCH_FOUND":
                    match_id = resp["match_id"]
                    print(f"[{player_name}] Match Found! ID: {match_id}")
                    break
                elif resp.get("status") == "TIMEOUT":
                    print(f"[{player_name}] ❌ Matchmaking timed out.")
                    return

        # --- 2. Join the Game Room ---
        # UPDATED: Added /api/game prefix
        game_uri = f"{WS_URL}/api/game/ws/match/{match_id}?token={token}"
        
        async with websockets.connect(game_uri, open_timeout=20) as game_ws:
            print(f"[{player_name}] Joined Game Room. Waiting for START_GAME...")
            
            while True:
                msg = json.loads(await game_ws.recv())
                # Checking for your specific backend message structure
                if msg.get("type") == "match_status" and msg.get("status") == "START_GAME":
                    print(f"[{player_name}] ⚔️ GAME STARTED!")
                    break
            
            # 3. Simulate Gameplay
            await asyncio.sleep(1)
            await game_ws.send(json.dumps({"type": "MOVE", "data": "Player action"}))

            # 4. Handle Winner Logic
            if is_winner:
                await asyncio.sleep(2)
                print(f"[{player_name}] Sending Victory Signal...")
                await game_ws.send(json.dumps({
                    "type": "GAME_OVER",
                    "winner_id": mongodb_id 
                }))
            
            # 5. Final Result
            final_res = json.loads(await game_ws.recv())
            print(f"[{player_name}] Final Result: {final_res}")

    except websockets.exceptions.ConnectionClosedError as e:
        print(f"[{player_name}] ❌ Connection Closed: {e.code} - {e.reason}")
    except Exception as e:
        print(f"[{player_name}] ❌ Error: {e}")

async def main():
    print("🚀 Starting Production-Grade Match Test...")
    
    # Run Player A
    task1 = asyncio.create_task(simulate_player("Player A", "697b11d212267043f3c25731", is_winner=True))
    
    # Wait 2 seconds to ensure Redis handles Player A before Player B tries to match
    await asyncio.sleep(2)
    
    # Run Player B
    task2 = asyncio.create_task(simulate_player("Player B", "697b392a0a7f2c914a954987", is_winner=False))
    
    await asyncio.gather(task1, task2)

if __name__ == "__main__":
    asyncio.run(main())