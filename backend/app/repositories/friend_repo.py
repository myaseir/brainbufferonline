from app.db.mongodb import db
from bson import ObjectId
from datetime import datetime
from app.db.redis import redis_client  # ✅ Import Redis for live status
from app.services.game_utils import to_str

class FriendRepository:
    def __init__(self):
        self.collection = db.get_collection("friendships")
        self.users = db.get_collection("users")

    async def send_request(self, requester_id: str, recipient_username: str):
        # 1. Find Recipient
        recipient = await self.users.find_one({"username": recipient_username})
        if not recipient:
            return {"error": "User not found"}
        
        recipient_id = str(recipient["_id"])
        if recipient_id == requester_id:
            return {"error": "You cannot add yourself"}

        # 2. Check existing relationship (Pending or Accepted)
        existing = await self.collection.find_one({
            "$or": [
                {"requester_id": requester_id, "recipient_id": recipient_id},
                {"requester_id": recipient_id, "recipient_id": requester_id}
            ]
        })
        
        if existing:
            if existing["status"] == "accepted":
                return {"error": "Already friends"}
            if existing["status"] == "pending":
                return {"error": "Request already pending"}

        # 3. Create Request
        await self.collection.insert_one({
            "requester_id": requester_id,
            "recipient_id": recipient_id,
            "status": "pending",
            "created_at": datetime.utcnow()
        })
        return {"message": "Friend request sent"}

    async def accept_request(self, request_id: str, user_id: str):
        # Only the recipient can accept a pending request
        result = await self.collection.update_one(
            {"_id": ObjectId(request_id), "recipient_id": user_id, "status": "pending"},
            {"$set": {"status": "accepted"}}
        )
        return result.modified_count > 0

    async def get_friends(self, user_id: str):
        """
        🚀 OPTIMIZED: Fetches profiles AND live status from Redis.
        """
        # 1. Get all accepted friendship documents
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

        # 3. Batch Fetch Profiles
        profiles = await self.users.find({"_id": {"$in": friend_ids}}).to_list(length=200)
        
        # 4. ⚡ FETCH LIVE STATUS FROM REDIS
        results = []
        for u in profiles:
            u_id = str(u["_id"])
            
            # Check Redis for status (e.g., "user_status:12345" -> "online")
            # Note: Ensure your LobbyManager sets this key in Redis!
            status = redis_client.get(f"user_status:{u_id}")
            
            results.append({
                "id": u_id,
                "username": u.get("username", "Unknown"),
                "avatar": u.get("avatar_url", "/default-avatar.png"),
                "status": to_str(status) if status else "offline" # ✅ Default to offline
            })
            
        return results

    async def get_pending_requests(self, user_id: str):
        """
        🚀 OPTIMIZED: Uses $in to fetch requester data in bulk.
        """
        # 1. Find all incoming pending requests
        cursor = self.collection.find({"recipient_id": user_id, "status": "pending"})
        request_docs = await cursor.to_list(length=100)
        if not request_docs:
            return []

        # 2. Extract requester IDs
        requester_ids = [ObjectId(doc["requester_id"]) for doc in request_docs]

        # 3. Batch Fetch Profiles
        profiles = await self.users.find({"_id": {"$in": requester_ids}}).to_list(length=100)
        profile_map = {str(p["_id"]): p for p in profiles}

        # 4. Merge profile data with request IDs
        requests = []
        for doc in request_docs:
            rid = doc["requester_id"]
            if rid in profile_map:
                requests.append({
                    "request_id": str(doc["_id"]),
                    "username": profile_map[rid].get("username"),
                    "avatar": profile_map[rid].get("avatar_url", "/default-avatar.png")
                })
        return requests
    
    async def search_users(self, query: str, current_user_id: str):
        if not query:
            return []
            
        # Search with a limit to keep the database response small
        cursor = self.users.find({
            "username": {"$regex": f"^{query}", "$options": "i"}, # Prefix match is faster than full regex
            "_id": {"$ne": ObjectId(current_user_id)}
        }).limit(10)
        
        results = []
        async for user in cursor:
            results.append({
                "id": str(user["_id"]),
                "username": user["username"],
                "avatar": user.get("avatar_url", "/default-avatar.png")
            })
        return results

    async def decline_request(self, request_id: str, user_id: str):
        result = await self.collection.delete_one({
            "_id": ObjectId(request_id),
            "recipient_id": user_id
        })
        return result.deleted_count > 0