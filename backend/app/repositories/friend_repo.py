from app.db.mongodb import db
from bson import ObjectId
from datetime import datetime

class FriendRepository:
    def __init__(self):
        # We use the helper we added to MongoDB class
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

        # 2. Check existing relationship
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
        # Only the recipient can accept
        result = await self.collection.update_one(
            {"_id": ObjectId(request_id), "recipient_id": user_id, "status": "pending"},
            {"$set": {"status": "accepted"}}
        )
        return result.modified_count > 0

    async def get_friends(self, user_id: str):
        # Find all accepted friendships where user is either requester OR recipient
        cursor = self.collection.find({
            "$or": [{"requester_id": user_id}, {"recipient_id": user_id}],
            "status": "accepted"
        })
        
        friends = []
        async for doc in cursor:
            # Determine which ID is the friend's ID
            friend_id = doc["recipient_id"] if doc["requester_id"] == user_id else doc["requester_id"]
            
            # Fetch Friend Details (Name, Avatar)
            friend_data = await self.users.find_one({"_id": ObjectId(friend_id)})
            if friend_data:
                friends.append({
                    "id": str(friend_data["_id"]),
                    "username": friend_data.get("username", "Unknown"),
                    "avatar": friend_data.get("avatar_url", "/default-avatar.png")
                })
        return friends

    async def get_pending_requests(self, user_id: str):
        # Incoming requests only
        cursor = self.collection.find({"recipient_id": user_id, "status": "pending"})
        requests = []
        async for doc in cursor:
            requester = await self.users.find_one({"_id": ObjectId(doc["requester_id"])})
            if requester:
                requests.append({
                    "request_id": str(doc["_id"]),
                    "username": requester.get("username"),
                    "avatar": requester.get("avatar_url")
                })
        return requests
    
    async def search_users(self, query: str, current_user_id: str):
        if not query:
            return []
            
        # 1. Search for users (Case-insensitive, Partial Match)
        # The "$ne" part ensures you don't find yourself in the list
        cursor = self.users.find({
            "username": {"$regex": query, "$options": "i"},
            "_id": {"$ne": ObjectId(current_user_id)}
        }).limit(5)  # Limit to 5 results to keep it fast
        
        results = []
        async for user in cursor:
            results.append({
                "id": str(user["_id"]),
                "username": user["username"],
                "avatar": user.get("avatar_url", "/default-avatar.png")
            })
        return results

    # 🔥 NEW: Method to handle declining requests
    async def decline_request(self, request_id: str, user_id: str):
        """
        Deletes a friend request if the user is the receiver.
        """
        result = await self.collection.delete_one({
            "_id": ObjectId(request_id),
            "recipient_id": user_id
        })
        return result.deleted_count > 0