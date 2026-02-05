from app.db.redis import redis_client

try:
    redis_client.flushall()
    print("✅ Redis Cache Cleared Successfully!")
except Exception as e:
    print(f"❌ Error: {e}")