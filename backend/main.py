from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.mongodb import connect_to_mongo, close_mongo_connection
from app.api import auth, wallet, game_ws, leaderboard, admin 
from app.api.game_ws import active_matches
import logging
import os

# --- 📝 LOGGING SETUP ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn.error")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup Logic ---
    logger.info("🚀 Glacia Connection: Initializing MongoDB...")
    try:
        await connect_to_mongo()
        # If you use Redis for matchmaking, initialize it here
        # await connect_to_redis() 
        logger.info("✅ Database systems online.")
    except Exception as e:
        logger.error(f"❌ Startup Error: {e}")

    yield

    # --- Shutdown Logic ---
    logger.info("⚠️ Server shutting down. Cleaning up active matches...")
    if active_matches:
        for match_id, match_data in list(active_matches.items()):
            players = match_data.get("players", {})
            for ws in list(players.values()):
                try:
                    await ws.send_json({
                        "type": "SERVER_SHUTDOWN", 
                        "message": "Match terminated due to server maintenance. Stakes refunded."
                    })
                    await ws.close()
                except: 
                    pass
    
    await close_mongo_connection()
    logger.info("🛑 Glacia Connection: Offline.")

app = FastAPI(title="Glacia Backend", version="1.2.2", lifespan=lifespan)

# --- 🔒 CORS SETUP (Production Ready) ---
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "https://brainbufferonline.vercel.app", 
    "https://admin-brainbuffer.vercel.app",
    # Render's own health check sometimes needs the actual domain
    "https://brainbufferonline.onrender.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 🛣️ ROUTER REGISTRATION ---
# Standard Auth
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

# Wallet prefix matches your Frontend calls
app.include_router(wallet.router, prefix="/api/wallet", tags=["Wallet-System"])

# WebSocket routes for Game/Matchmaking
app.include_router(game_ws.router, prefix="/api/game", tags=["Game"])

# Public Stats
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["Leaderboard"])

# Secure Admin
app.include_router(admin.router, prefix="/api/admin", tags=["System-Admin"])

@app.get("/")
def read_root():
    return {
        "status": "Online", 
        "version": "1.2.2", 
        "environment": os.getenv("RENDER", "local_development")
    }