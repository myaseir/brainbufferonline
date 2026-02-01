import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.security import create_access_token
from datetime import datetime, timezone

# Use your Atlas URL
MONGO_URL = "mongodb+srv://brainbuffer_admin:Lim3fjQM7zraNjUy@cluster0.ffx3umx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DATABASE_NAME = "brain_buffer"

async def create_test_bots():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    tokens = []

    print("🤖 Creating 20 Test Bots in Atlas...")

    for i in range(1, 21):
        username = f"bot_player_{i}"
        bot_user = {
            "username": username,
            "email": f"{username}@test.com",
            "wallet_balance": 500.0,  # Give them money to play
            "total_wins": 0,
            "role": "user",
            "created_at": datetime.now(timezone.utc)
        }
        
        # Insert and get ID
        result = await db.users.update_one(
            {"username": username}, 
            {"$set": bot_user}, 
            upsert=True
        )
        
        # We need the string ID to create a JWT
        user_in_db = await db.users.find_one({"username": username})
        token = create_access_token(data={"sub": str(user_in_db["_id"])})
        tokens.append(token)

    # Save tokens to a file so test.py can read them
    with open("bot_tokens.txt", "w") as f:
        for t in tokens:
            f.write(f"{t}\n")
    
    print("✅ Done! 20 Bots created and tokens saved to 'bot_tokens.txt'")
    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_bots())