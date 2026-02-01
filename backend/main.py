from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.mongodb import connect_to_mongo, close_mongo_connection
from app.api import auth, wallet, game_ws, leaderboard, admin 
from app.core.config import settings
import logging
import os

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
    
    # 2. Redis Config Check (Optional Sanity Check)
    if not settings.UPSTASH_REDIS_REST_URL:
        logger.error("❌ UPSTASH_REDIS_REST_URL missing. Matchmaking will fail.")

    # 3. Database Connections
    try:
        await connect_to_mongo()
        logger.info("✅ MongoDB Connection: Online")
    except Exception as e:
        logger.error(f"❌ Database Startup Error: {e}")

    yield

    # --- 🛑 SHUTDOWN LOGIC ---
    # In a stateless setup, we don't need to loop through matches here.
    # Redis keeps the match state alive. 
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

@app.get("/")
def read_root():
    return {
        "status": "Online", 
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION, 
        "environment": "Production" if os.getenv("RENDER") else "Local Development"
    }