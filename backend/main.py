from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.mongodb import connect_to_mongo, close_mongo_connection
from app.api import auth, wallet, game_ws, leaderboard, admin 
# Import the shared dictionary to check connections
from app.api.game_ws import active_matches

# --- 🚀 LIFESPAN MANAGER ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. STARTUP
    print("🚀 Glacia Connection Starting...")
    await connect_to_mongo()
    yield
    
    # 2. SHUTDOWN & CLEANUP
    print("🛑 Glacia Connection Shutting Down...")
    
    # FIX: Updated loop to handle the new 'active_matches' structure
    if active_matches:
        for match_id, match_data in active_matches.items():
            # Safely get the 'players' dict from the match data
            players = match_data.get("players", {})
            
            for ws in players.values():
                try:
                    await ws.send_json({
                        "type": "SERVER_SHUTDOWN", 
                        "message": "Server restarting for updates. Please refresh."
                    })
                    await ws.close()
                except Exception:
                    pass
                    
    await close_mongo_connection()

app = FastAPI(
    title="Glacia Connection - Brain Buffer Backend",
    lifespan=lifespan
)

# --- 🌍 CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 🛣️ ROUTERS ---
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(wallet.router, prefix="/api/wallet", tags=["Wallet"])
app.include_router(game_ws.router, prefix="/api/game", tags=["Game"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["Leaderboard"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

@app.get("/")
def read_root():
    return {
        "status": "Glacia Connection Live",
        "version": "1.0.0",
        "environment": "Development",
        "owner": "Glacia Connection",
        "developer": "Muhammad Yasir"
    }