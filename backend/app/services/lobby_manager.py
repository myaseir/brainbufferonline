from fastapi import WebSocket
from typing import Dict
import logging
import json
from app.db.redis import redis_client
from datetime import datetime
import asyncio
from app.services.game_utils import to_str

logger = logging.getLogger("uvicorn.error")

class LobbyManager:
    def __init__(self):
        # Maps user_id -> WebSocket connection
        self.active_connections: Dict[str, WebSocket] = {}
        # Track local presence
        self.local_presence: Dict[str, str] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
        try:
            # --- SOLUTION A: REFERENCE COUNTING ---
            # Increment the number of active sockets for this user (Lobby + Game)
            conn_count = redis_client.incr(f"conn_count:{user_id}")
            # Set a safety expiry on the counter (1 hour)
            redis_client.expire(f"conn_count:{user_id}", 3600)

            # Only broadcast 'online' if this is their FIRST connection
            if conn_count == 1:
                redis_client.sadd("online_players_set", user_id)
                redis_client.set(f"user_status:{user_id}", "online", ex=3600)
                await self.broadcast_user_status(user_id, "online")
                self.local_presence[user_id] = "online"
            
        except Exception as e:
            logger.error(f"Redis Error in connect: {e}")

    async def disconnect(self, user_id: str):
        # Remove from local dict first to stop message sending attempts
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
        try:
            # --- SOLUTION A: REFERENCE COUNTING ---
            # Decrement the socket count
            conn_count = redis_client.decr(f"conn_count:{user_id}")

            # Fetch current status to check if they are playing
            raw_status = redis_client.get(f"user_status:{user_id}")
            status = to_str(raw_status)

            # ONLY mark offline if this was the last remaining socket
            if conn_count <= 0:
                print(f"📡 DISCONNECT LOG: User {user_id} has 0 connections. Marking Offline.")
                
                redis_client.srem("online_players_set", user_id)
                redis_client.delete(f"user_status:{user_id}")
                redis_client.delete(f"conn_count:{user_id}") # Clean up counter
                
                await self.broadcast_user_status(user_id, "offline")
                if user_id in self.local_presence:
                    del self.local_presence[user_id]
            else:
                print(f"🛡️ PRESERVING STATUS: {user_id} still has {conn_count} socket(s) open.")

        except Exception as e:
            logger.error(f"Redis Error in disconnect: {e}")

    async def broadcast_user_status(self, user_id: str, status: str):
        payload = {
            "type": "USER_STATUS_CHANGE",
            "user_id": user_id,
            "status": status
        }
        
        # ✅ FIXED: Using list() to prevent "dictionary changed size" error
        active_uids = list(self.active_connections.keys())
        
        for uid in active_uids:
            if uid == user_id:
                continue
            socket = self.active_connections.get(uid)
            if socket:
                try:
                    await socket.send_json(payload)
                except Exception:
                    # Don't call disconnect inside the loop; it's handled by the ping/pong or error catchers
                    pass

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                await websocket.send_json(message)
                return True
            except Exception as e:
                logger.error(f"⚠️ Failed to send lobby message to {user_id}: {e}")
                # Use a background task or safe deletion
                return False
        return False
    
    async def update_status(self, user_id: str, status: str):
        """Used to manually change status to 'playing' or 'online'"""
        try:
            if status == "offline":
                await self.disconnect(user_id)
            else:
                expiry = 600 if status == "playing" else 120
                redis_client.set(f"user_status:{user_id}", status, ex=expiry)
                redis_client.sadd("online_players_set", user_id)
                
                await self.broadcast_user_status(user_id, status)
                self.local_presence[user_id] = status
        except Exception as e:
            logger.error(f"Status Update Error: {e}")

# Global instance
lobby_manager = LobbyManager()