import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# MongoDB Configuration
MONGO_URL = os.getenv("MONGODB_URL", "mongodb+srv://brainbuffer_admin:Lim3fjQM7zraNjUy@cluster0.ffx3umx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
DB_NAME = "brain_buffer"

async def seed_pakistani_bots():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    users_collection = db.users

    # List of 20 realistic Pakistani names
    bot_names = [
        "Zeeshan_Elite", "Ayesha_Pro", "Hamza_King", "Sana_Khan", 
        "Bilal_Master", "Fatima_Queen", "Usman_Hero", "Hira_Star",
        "Omer_Wizard", "Zainab_Pro", "Ali_Legend", "Mahnoor_Ace",
        "Faisal_Boss", "Nida_Smart", "Saad_Warrior", "Khadija_Win",
        "Tariq_Pro", "Anum_Champion", "Rizwan_Expert", "Marium_Fast"
    ]

    print(f"🚀 Seeding {len(bot_names)} Pakistani bots into MongoDB...")

    for i, name in enumerate(bot_names, 1):
        bot_id = f"BOT_{i:03d}"  # Creates BOT_001, BOT_002, etc.
        
        bot_doc = {
            "_id": bot_id, # String ID to match your Matchmaker logic
            "username": name,
            "email": f"{bot_id.lower()}@glacialabs.com",
            "wallet_balance": 1000.0,
            "total_matches": 0,
            "total_wins": 0,
            "recent_matches": [],
            "is_bot": True,
            "created_at": "2026-02-01T00:00:00Z"
        }

        # upsert=True prevents duplicates if you run the script twice
        await users_collection.update_one(
            {"_id": bot_id},
            {"$set": bot_doc},
            upsert=True
        )
        print(f"✅ Seeded: {bot_id} as {name}")

    print("\n✨ All bots are now live in Atlas!")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_pakistani_bots())