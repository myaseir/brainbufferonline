import asyncio
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
        
        # 🚀 FIX: Use asyncio.to_thread so Redis calls don't freeze the server
        # 🚀 MOBILE OPTIMIZATION: Set expiry to 60s instead of 1hr. 
        # The heartbeat will keep it alive, but this ensures a clean state if phone dies.
        await asyncio.to_thread(
            redis_client.set, f"presence:{user_id}", "online", ex=60
        )
        
        logger.info(f"✅ User {user_id} connected to Lobby")

    async def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        # 🚀 FIX: Wrap in to_thread to keep the event loop fast on Render
        try:
            await asyncio.to_thread(redis_client.delete, f"presence:{user_id}")
        except Exception as e:
            logger.error(f"Redis delete error: {e}")

        logger.info(f"❌ User {user_id} disconnected from Lobby")

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

lobby_manager = LobbyManager()