import redis
import os

# 🛠️ Configuration: Replace with your actual Upstash or Local Redis credentials
REDIS_URL = "redis://:your_password@your_endpoint.upstash.io:32367"

def cleanup_dev_env():
    try:
        r = redis.from_url(REDIS_URL)
        print("🔄 Connecting to Shared Brain...")

        # 1. Clear the matchmaking queue
        r.delete("matchmaking_pool")
        print("✅ Cleared: matchmaking_pool")

        # 2. Clear all user locks
        locks = r.keys("lock:user:*")
        if locks:
            r.delete(*locks)
            print(f"✅ Cleared: {len(locks)} user session locks")
        
        # 3. Clear all stuck notifications
        notifs = r.keys("notify:*")
        if notifs:
            r.delete(*notifs)
            print(f"✅ Cleared: {len(notifs)} stuck notifications")

        print("\n🚀 Environment is clean! Restart your live test.")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    cleanup_dev_env()