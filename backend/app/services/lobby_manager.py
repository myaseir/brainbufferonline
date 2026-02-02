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
        try:
            await asyncio.to_thread(
                redis_client.set, f"presence:{user_id}", "online", ex=300
            )
            logger.info(f"✅ User {user_id} connected to Lobby - Presence set to online")
        except Exception as e:
            logger.error(f"Redis set error on connect for {user_id}: {e}")
            await websocket.close(code=1011)  # Internal error
            return
        
        # 🚀 UPDATED: Broadcast to all connected clients that this user is online
        await self.broadcast({"type": "USER_ONLINE", "user_id": user_id})

    async def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        # 🚀 UPDATED: Set to "away" with longer expiry (10 min), but ensure it's not "online"
        try:
            await asyncio.to_thread(
                redis_client.set, f"presence:{user_id}", "away", ex=600
            )
            logger.info(f"❌ User {user_id} disconnected from Lobby - Set to away")
        except Exception as e:
            logger.error(f"Redis set error on disconnect for {user_id}: {e}")
        
        # 🚀 UPDATED: Broadcast that user is now away
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
                logger.info(f"📤 Sent message to {user_id}: {message['type']}")
                return True
            except Exception as e:
                logger.error(f"⚠️ Failed to send lobby message to {user_id}: {e}")
                await self.disconnect(user_id)
                return False
        return False

    # 🚀 UPDATED: Method to refresh presence (call from heartbeat in api/lobby.py)
    async def refresh_presence(self, user_id: str):
        try:
            # Only refresh if still "online" (not "away")
            current_status = await asyncio.to_thread(redis_client.get, f"presence:{user_id}")
            if current_status:
                # Handle both bytes and str types (decode if bytes, else use as str)
                if isinstance(current_status, bytes):
                    status_str = current_status.decode('utf-8')
                else:
                    status_str = str(current_status)
                
                if status_str == "online":
                    await asyncio.to_thread(
                        redis_client.expire, f"presence:{user_id}", 300
                    )
                    logger.debug(f"🔄 Refreshed presence for {user_id}")
                else:
                    logger.debug(f"Skipped refresh for {user_id} - status: {status_str}")
            else:
                logger.debug(f"No presence key for {user_id}")
        except Exception as e:
            logger.error(f"Redis expire error for {user_id}: {e}")

    # 🚀 UPDATED: Broadcast a message to all active connections
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

    # 🚀 UPDATED: HTTP fallback method to get online users (for polling)
    # Now checks TTL to ensure it's truly active
    async def get_online_users(self) -> List[str]:
        try:
            # Use keys() instead of scan_iter() for broader compatibility (e.g., Upstash)
            keys = await asyncio.to_thread(
                lambda: redis_client.keys("presence:*")
            )
            online_users = []
            for key in keys:
                # Ensure key is a string
                if isinstance(key, bytes):
                    key_str = key.decode('utf-8')
                else:
                    key_str = str(key)
                
                user_id = key_str.split(":", 1)[1]  # e.g., "presence:123" -> "123"
                status = await asyncio.to_thread(redis_client.get, key_str)
                
                # Handle status type
                if status:
                    if isinstance(status, bytes):
                        status_str = status.decode('utf-8')
                    else:
                        status_str = str(status)
                    
                    ttl = await asyncio.to_thread(redis_client.ttl, key_str)  # Check remaining time
                    if status_str == "online" and ttl > 0:
                        online_users.append(user_id)
            
            logger.debug(f"Online users: {online_users}")
            return online_users
        except Exception as e:
            logger.error(f"Error fetching online users: {e}")
            return []

    # 🚀 NEW: Force logout (HTTP call to clear presence, e.g., on app close)
    async def force_logout(self, user_id: str):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            await websocket.close()
            del self.active_connections[user_id]
        
        try:
            await asyncio.to_thread(redis_client.delete, f"presence:{user_id}")
            logger.info(f"🚪 Forced logout for {user_id} - Presence deleted")
        except Exception as e:
            logger.error(f"Redis delete error on force logout for {user_id}: {e}")
        
        await self.broadcast({"type": "USER_OFFLINE", "user_id": user_id})

lobby_manager = LobbyManager()