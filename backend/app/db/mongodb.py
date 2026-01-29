from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class MongoDB:
    def __init__(self):
        self.client: AsyncIOMotorClient = None
        self.db = None 

# ✅ This is the ONLY thing you should import in other files
db = MongoDB()

async def connect_to_mongo():
    db_name = "brain_buffer" 
    
    # We update the properties of the single 'db' instance
    db.client = AsyncIOMotorClient(settings.MONGO_URL)
    db.db = db.client[db_name]
    
    print(f"✅ Connected to MongoDB Database: {db_name}")

async def close_mongo_connection():
    if db.client:
        db.client.close()
        print("🔌 MongoDB Connection Closed")