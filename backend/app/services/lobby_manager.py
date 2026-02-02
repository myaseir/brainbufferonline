import asyncio
from fastapi import WebSocket
from typing import Dict, List
import logging
from app.db.redis import redis_client

logger = logging.getLogger("uvicorn.error")

class LobbyManager:
    def __init__(self):
        # Maps user_id -> WebSocket connection
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        
        # 🚀 UPDATED: Extend expiry to 5 minutes (300s) for mobile stability.
        # Heartbeat will refresh it. This prevents quick expiry on disconnects.
        try:
            await asyncio.to_thread(
                redis_client.set, f"presence:{user_id}", "online", ex=300
            )
            logger.info(f"✅ User {user_id} connected to Lobby - Presence set")
        except Exception as e:
            logger.error(f"Redis set error on connect for {user_id}: {e}")
            # Close WebSocket if presence can't be set
            await websocket.close(code=1011)  # Internal error
            return
        
        # 🚀 NEW: Broadcast to all connected clients that this user is online
        await self.broadcast({"type": "USER_ONLINE", "user_id": user_id})

    async def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        # 🚀 UPDATED: Instead of deleting, set to "away" with longer expiry (10 min).
        # Allows reconnections to restore "online" without losing status immediately.
        try:
            await asyncio.to_thread(
                redis_client.set, f"presence:{user_id}", "away", ex=600
            )
        except Exception as e:
            logger.error(f"Redis set error on disconnect for {user_id}: {e}")

        logger.info(f"❌ User {user_id} disconnected from Lobby - Set to away")
        
        # 🚀 NEW: Broadcast that user is now away
        await self.broadcast({"type": "USER_AWAY", "user_id": user_id})

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            
            # Check if socket is still alive before sending
            if websocket.client_state.name != "CONNECTED":
                await self.disconnect(user_id)
                return False

            try:
                await websocket.send_json(message)
                return True
            except Exception as e:
                logger.error(f"⚠️ Failed to send lobby message to {user_id}: {e}")
                await self.disconnect(user_id)
                return False
        return False

    # 🚀 NEW: Method to refresh presence (call from heartbeat in api/lobby.py)
    async def refresh_presence(self, user_id: str):
        try:
            await asyncio.to_thread(
                redis_client.expire, f"presence:{user_id}", 300
            )
            logger.debug(f"🔄 Refreshed presence for {user_id}")
        except Exception as e:
            logger.error(f"Redis expire error for {user_id}: {e}")

    # 🚀 NEW: Broadcast a message to all active connections
    async def broadcast(self, message: dict):
        disconnected_users = []
        for user_id, websocket in self.active_connections.items():
            if websocket.client_state.name == "CONNECTED":
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Broadcast failed to {user_id}: {e}")
                    disconnected_users.append(user_id)
            else:
                disconnected_users.append(user_id)
        
        # Clean up disconnected users
        for user_id in disconnected_users:
            await self.disconnect(user_id)

    # 🚀 NEW: HTTP fallback method to get online users (for polling)
    async def get_online_users(self) -> List[str]:
        try:
            # Scan Redis for presence keys (assumes Redis has SCAN support)
            keys = await asyncio.to_thread(
                lambda: [key.decode() for key in redis_client.scan_iter("presence:*")]
            )
            # Extract user_ids and filter for "online" status
            online_users = []
            for key in keys:
                user_id = key.split(":", 1)[1]  # e.g., "presence:123" -> "123"
                status = await asyncio.to_thread(redis_client.get, key)
                if status and status.decode() == "online":
                    online_users.append(user_id)
            return online_users
        except Exception as e:
            logger.error(f"Error fetching online users: {e}")
            return []

lobby_manager = LobbyManager()