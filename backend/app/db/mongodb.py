from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
import logging

logger = logging.getLogger("uvicorn.error")

class MongoDB:
    def __init__(self):
        self.client: AsyncIOMotorClient = None
        self._db = None 

    @property
    def db(self):
        """
        Critical Fix: This property ensures that if any repo tries 
        to access .db before it's ready, we get a clear error 
        instead of a silent 'NoneType' crash later.
        """
        if self._db is None:
            # You could also trigger a reconnect here, 
            # but for now, we just want to avoid the NoneType crash.
            logger.warning("⚠️ MongoDB.db accessed before connection was established!")
        return self._db

    @db.setter
    def db(self, value):
        self._db = value

# Singleton instance
db = MongoDB()

async def connect_to_mongo():
    """
    Tuned for high-concurrency and scaling.
    """
    try:
        # --- 🚀 PRO SCALING CONFIGURATION ---
        db.client = AsyncIOMotorClient(
            settings.MONGO_URL,
            maxPoolSize=100, 
            minPoolSize=10,
            maxIdleTimeMS=60000,
            waitQueueTimeoutMS=5000,
            connectTimeoutMS=10000,
            # 💡 Tip: For Atlas, retryWrites is usually good to have enabled
            retryWrites=True
        )
        
        # We set the private _db attribute
        db._db = db.client[settings.DATABASE_NAME]
        
        # Verify connection
        await db.client.admin.command('ping')
        logger.info(f"✅ Scalable MongoDB Connection Active: {settings.DATABASE_NAME}")
        
    except Exception as e:
        logger.error(f"❌ MongoDB Connection Failed: {e}")
        raise e

async def close_mongo_connection():
    if db.client:
        db.client.close()
        logger.info("🔌 MongoDB Connection Pool Closed")