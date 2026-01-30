import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "brain_buffer"

async def create_admin():
    print("🚀 Create Super Admin (Email Login)")
    print("-----------------------------------")
    
    # 1. Connect to DB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    users_collection = db["users"]
    
    # 2. Get Input (Hardcoded for speed, change if you want)
    email = "admin@gmail.com"     # 👈 Using a valid email format
    password = "warofking0341"     # 👈 Your password
    username = "admin"        # Just a display name
    
    # 3. Check if user already exists
    if await users_collection.find_one({"email": email}):
        print(f"❌ Error: User with email '{email}' already exists!")
        return

    # 4. Hash Password & Create User
    hashed_password = pwd_context.hash(password)
    
    new_admin = {
        "email": email,              # 👈 The field used for login
        "username": username,        # Display name
        "full_name": "System Administrator",
        "hashed_password": hashed_password,
        "role": "admin",             # 👈 Grants Dashboard access
        "wallet_balance": 1000000,
        "created_at": "2026-01-30"
    }
    
    await users_collection.insert_one(new_admin)
    
    print(f"\n✅ Success! Admin created.")
    print(f"📧 Email:    {email}")
    print(f"🔑 Password: {password}")
    print(f"👉 Log in at: http://localhost:3001/login")

if __name__ == "__main__":
    asyncio.run(create_admin())