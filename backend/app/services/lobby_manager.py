from fastapi import WebSocket
from typing import Dict
import logging
import json
from app.db.redis import redis_client

logger = logging.getLogger("uvicorn.error")

class LobbyManager:
    def __init__(self):
        # Maps user_id -> WebSocket connection
        self.active_connections: Dict[str, WebSocket] = {}
        # ✅ Optimization: Track local presence to avoid redundant Redis calls
        self.local_presence: Dict[str, str] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        
        # ✅ REDIS OPTIMIZATION:
        # Only set Redis key and broadcast if the user is NOT already marked online locally.
        # This prevents flooding Upstash with 'SET' requests on every page refresh.
        if self.local_presence.get(user_id) != "online":
            try:
                # Use "user_status" to match friend_repo logic
                redis_client.set(f"user_status:{user_id}", "online", ex=3600)
                await self.broadcast_user_status(user_id, "online")
                self.local_presence[user_id] = "online"
            except Exception as e:
                logger.error(f"Redis Error in connect: {e}")

        self.active_connections[user_id] = websocket
        logger.info(f"✅ User {user_id} connected to Lobby")

    async def disconnect(self, user_id: str):
        # Remove the specific connection
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        # ✅ REDIS OPTIMIZATION:
        # Only delete from Redis if there are NO remaining connections for this user.
        # (Useful if the user has multiple tabs open)
        if user_id not in self.active_connections:
            try:
                redis_client.delete(f"user_status:{user_id}")
                await self.broadcast_user_status(user_id, "offline")
                if user_id in self.local_presence:
                    del self.local_presence[user_id]
            except Exception as e:
                logger.error(f"Redis Error in disconnect: {e}")
            
            logger.info(f"❌ User {user_id} disconnected from Lobby")

    async def broadcast_user_status(self, user_id: str, status: str):
        """
        Notify all connected users about a status change.
        """
        payload = {
            "type": "USER_STATUS_CHANGE",
            "user_id": user_id,
            "status": status
        }
        
        disconnected_users = []
        for uid, socket in self.active_connections.items():
            # Don't send the update to the user who just changed status
            if uid == user_id:
                continue
                
            try:
                await socket.send_json(payload)
            except Exception:
                # Catch dead sockets during broadcast
                disconnected_users.append(uid)
        
        for uid in disconnected_users:
            await self.disconnect(uid)

    async def send_personal_message(self, message: dict, user_id: str):
        """
        Direct messaging for challenges/invites.
        """
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                await websocket.send_json(message)
                return True
            except Exception as e:
                logger.error(f"⚠️ Failed to send lobby message to {user_id}: {e}")
                await self.disconnect(user_id)
                return False
        return False

# Global instance
lobby_manager = LobbyManager()