from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.mongodb import connect_to_mongo, close_mongo_connection
# ✅ UPDATED IMPORTS: Added 'friends' and 'lobby'
from app.api import auth, wallet, game_ws, leaderboard, admin, friends, lobby 
from app.core.config import settings
import logging
import os
from app.api import support
# --- 📝 LOGGING SETUP ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn.error")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- 🚀 STARTUP LOGIC ---
    logger.info(f"Initializing {settings.PROJECT_NAME} v{settings.VERSION}...")

    # 1. Email Config Check
    if not settings.BREVO_API_KEY:
        logger.warning("⚠️ BREVO_API_KEY missing. Emails will not be sent.")
    
    # 2. Redis Config Check
    # (Updated to check standard REDIS_URL if you are using the new setup)
    if not settings.REDIS_URL and not settings.UPSTASH_REDIS_REST_URL:
        logger.error("❌ REDIS_URL missing. Matchmaking will fail.")

    # 3. Database Connections
    try:
        await connect_to_mongo()
        logger.info("✅ MongoDB Connection: Online")
    except Exception as e:
        logger.error(f"❌ Database Startup Error: {e}")

    yield

    # --- 🛑 SHUTDOWN LOGIC ---
    await close_mongo_connection()
    logger.info(f"🛑 {settings.PROJECT_NAME} Connection: Offline.")

# ✅ FastAPI Instance with Settings
app = FastAPI(
    title=settings.PROJECT_NAME, 
    version=settings.VERSION, 
    lifespan=lifespan
)

# --- 🔒 CORS SETUP (Production Ready) ---
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "https://brainbufferonline.vercel.app", 
    "https://admin-brainbuffer.vercel.app",
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
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(wallet.router, prefix="/api/wallet", tags=["Wallet"])
app.include_router(game_ws.router, prefix="/api/game", tags=["Game"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["Leaderboard"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

# ✅ NEW ROUTERS ADDED HERE
app.include_router(friends.router, prefix="/api/friends", tags=["Friends"])
app.include_router(lobby.router, tags=["Lobby"]) # Handles /ws/lobby
app.include_router(support.router, prefix="/api/support", tags=["Support"])
@app.get("/")
def read_root():
    return {
        "status": "Online", 
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION, 
        "environment": "Production" if os.getenv("RENDER") else "Local Development"
    }