import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def reset_balances():
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.DATABASE_NAME]
    
    # 💡 FIX: Updated regex to match "bot_player_" instead of "Bot_"
    query = {"username": {"$regex": "^bot_player_", "$options": "i"}}
    
    # Reset balance to 1000 and wins to 0
    result = await db.users.update_many(
        query,
        {"$set": {"wallet_balance": 1000.0, "total_wins": 0}}
    )
    
    if result.modified_count > 0:
        print(f"💰 Successfully refilled {result.modified_count} bot wallets!")
    else:
        print("❌ No bots found. Double check your Atlas collection named 'users'.")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(reset_balances())