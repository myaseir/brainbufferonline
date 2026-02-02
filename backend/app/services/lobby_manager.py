from fastapi import WebSocket
from typing import Dict
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
        
        # 🔥 FIX: REMOVED 'await' (Redis is synchronous)
        redis_client.set(f"presence:{user_id}", "online", ex=60*60)
        
        logger.info(f"✅ User {user_id} connected to Lobby")

    async def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        # 🔥 FIX: REMOVED 'await'
        redis_client.delete(f"presence:{user_id}")
        logger.info(f"❌ User {user_id} disconnected from Lobby")

    async def send_personal_message(self, message: dict, user_id: str):
        """
        Send a message directly to a specific user's socket.
        Returns True if successful, False if user is offline.
        """
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                await websocket.send_json(message)
                return True
            except Exception as e:
                logger.error(f"⚠️ Failed to send lobby message to {user_id}: {e}")
                # If sending fails (broken pipe), force disconnect
                await self.disconnect(user_id)
                return False
        return False

lobby_manager = LobbyManager()