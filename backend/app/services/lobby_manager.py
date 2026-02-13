from fastapi import WebSocket
from typing import Dict
import logging
import json
from app.db.redis import redis_client
from datetime import datetime  # ✅ Fixed import
import datetime as dt # Optional: if you need the whole module
import asyncio

logger = logging.getLogger("uvicorn.error")

class LobbyManager:
    def __init__(self):
        # Maps user_id -> WebSocket connection
        self.active_connections: Dict[str, WebSocket] = {}
        # ✅ Optimization: Track local presence to avoid redundant Redis calls
        self.local_presence: Dict[str, str] = {}

    async def connect(self, user_id: str, websocket: WebSocket, username: str, email: str):
        await websocket.accept()
        user_info = json.dumps({
            "user_id": user_id,
            "username": username,
            "email": email,
            "connected_at": datetime.now().isoformat()
        })
        
        # 👇 NEW: Get the loop for non-blocking Redis calls
        loop = asyncio.get_event_loop()
        
        if self.local_presence.get(user_id) != "online":
            try:
                await loop.run_in_executor(None, redis_client.sadd, "online_users_detailed", user_info)
                redis_client.set(f"user_status:{user_id}", "online", ex=3600)
                await self.broadcast_user_status(user_id, "online")
                # self.local_presence[user_id] = "online"
                self.local_presence[user_id] = user_info
            except Exception as e:
                logger.error(f"Redis Error in connect: {e}")

        self.active_connections[user_id] = websocket
        logger.info(f"✅ User {user_id} connected to Lobby")

    async def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        if user_id not in self.active_connections:
            try:
                loop = asyncio.get_event_loop()
                
                # 👇 NEW: Get the stored JSON string
                user_info = self.local_presence.get(user_id)
                
                # 👇 NEW: Remove from Admin List
                if user_info:
                    await loop.run_in_executor(None, redis_client.srem, "online_users_detailed", user_info)

                # Existing cleanup logic
                await loop.run_in_executor(None, redis_client.delete, f"user_status:{user_id}")
                await self.broadcast_user_status(user_id, "offline")
                
                if user_id in self.local_presence:
                    del self.local_presence[user_id]
            except Exception as e:
                logger.error(f"Redis Error in disconnect: {e}")
            
            logger.info(f"❌ User {user_id} disconnected from Lobby")

    async def broadcast_user_status(self, user_id: str, status: str):
        payload = {
            "type": "USER_STATUS_CHANGE",
            "user_id": user_id,
            "status": status
        }
        
        disconnected_users = []
        for uid, socket in self.active_connections.items():
            if uid == user_id:
                continue
            try:
                await socket.send_json(payload)
            except Exception:
                disconnected_users.append(uid)
        
        for uid in disconnected_users:
            await self.disconnect(uid)

    async def send_personal_message(self, message: dict, user_id: str):
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
    
    # ✅ FIXED: Now properly indented inside the class
    async def broadcast_global_announcement(self, message: str):
        """
        Sends a system-wide alert to every user currently in the lobby.
        """
        payload = {
            "type": "GLOBAL_ANNOUNCEMENT",
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
        # Send to all connected sockets
        for user_id, socket in self.active_connections.items():
            try:
                await socket.send_json(payload)
            except Exception:
                # Heartbeat or future logic will clean up dead sockets
                continue

# Global instance
lobby_manager = LobbyManager()