import asyncio
from app.db.mongodb import db
from app.db.redis import redis_client
from bson import ObjectId
from datetime import datetime

class FriendRepository:
    def __init__(self):
        self.collection = db.get_collection("friendships")
        self.users = db.get_collection("users")

    # ... send_request, accept_request, search_users, decline_request remain the same ...

    async def get_friends(self, user_id: str):
        """
        🚀 BATTLE-READY: Fetches profiles from MongoDB AND presence from Redis in bulk.
        """
        # 1. Get all accepted friendship docs (MongoDB)
        cursor = self.collection.find({
            "$or": [{"requester_id": user_id}, {"recipient_id": user_id}],
            "status": "accepted"
        })
        
        friendship_docs = await cursor.to_list(length=200)
        if not friendship_docs:
            return []

        # 2. Extract unique friend IDs
        friend_ids = []
        for doc in friendship_docs:
            fid = doc["recipient_id"] if doc["requester_id"] == user_id else doc["requester_id"]
            friend_ids.append(ObjectId(fid))

        # 3. BATCH QUERY: Fetch all profiles from MongoDB
        profiles = await self.users.find({"_id": {"$in": friend_ids}}).to_list(length=200)
        
        # 🚀 4. REDIS BATCH CHECK: Decide who gets a green dot
        # We build a list of keys like ['presence:id1', 'presence:id2']
        presence_keys = [f"presence:{str(p['_id'])}" for p in profiles]
        
        # Use asyncio.to_thread for the synchronous redis client
        # MGET returns a list of values (e.g., ["online", None, "online"])
        presence_values = await asyncio.to_thread(redis_client.mget, presence_keys)
        
        # Map values back to IDs for easy lookup
        # If value is None, the user is offline (key expired)
        presence_map = {str(profiles[i]["_id"]): (val is not None) for i, val in enumerate(presence_values)}

        # 5. Combine and return
        return [{
            "id": str(u["_id"]),
            "username": u.get("username", "Unknown"),
            "avatar": u.get("avatar_url", "/default-avatar.png"),
            "is_online": presence_map.get(str(u["_id"]), False) # 🟢 The Green Dot logic
        } for u in profiles]

    async def get_pending_requests(self, user_id: str):
        # ... logic as before (already optimized with $in) ...
        cursor = self.collection.find({"recipient_id": user_id, "status": "pending"})
        request_docs = await cursor.to_list(length=100)
        if not request_docs: return []

        requester_ids = [ObjectId(doc["requester_id"]) for doc in request_docs]
        profiles = await self.users.find({"_id": {"$in": requester_ids}}).to_list(length=100)
        profile_map = {str(p["_id"]): p for p in profiles}

        return [{
            "request_id": str(doc["_id"]),
            "username": profile_map[doc["requester_id"]].get("username"),
            "avatar": profile_map[doc["requester_id"]].get("avatar_url", "/default-avatar.png")
        } for doc in request_docs if doc["requester_id"] in profile_map]