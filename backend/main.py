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
    # Startup
    logger.info("🚀 Glacia Connection: Initializing...")
    await connect_to_mongo()
    yield
    # Shutdown logic
    if active_matches:
        for match_id, match_data in list(active_matches.items()):
            players = match_data.get("players", {})
            for ws in list(players.values()):
                try:
                    await ws.send_json({"type": "SERVER_SHUTDOWN", "message": "Refund issued."})
                    await ws.close()
                except: pass
    await close_mongo_connection()

app = FastAPI(title="Glacia Backend", version="1.2.2", lifespan=lifespan)

# Define all allowed origins
origins = [
    "http://localhost:3000",      # Standard Next.js
    "http://127.0.0.1:3000",
    
    # 👇 ADD THESE LINES FOR PORT 3001
    "http://localhost:3001",      # Backup Next.js port
    "http://127.0.0.1:3001",
    
    "https://your-production-app.vercel.app", 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 🛣️ ROUTER REGISTRATION ---
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

# This prefix ensures all wallet/admin routes start with /api/wallet
app.include_router(wallet.router, prefix="/api/wallet", tags=["Wallet-System"])

app.include_router(game_ws.router, prefix="/api/game", tags=["Game"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["Leaderboard"])
app.include_router(admin.router, prefix="/api/admin", tags=["System-Admin"])

@app.get("/")
def read_root():
    return {"status": "Online", "version": "1.2.2"}