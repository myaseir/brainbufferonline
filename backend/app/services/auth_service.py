from app.repositories.user_repo import UserRepository
from app.core.security import get_password_hash, verify_password
from app.db.redis import redis_client
import json
from datetime import datetime, timezone
from bson import ObjectId
import random
import string
# --- 🚀 CUSTOM ENCODER ---
class MongoEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

class AuthService:
    def __init__(self):
        self.repo = UserRepository()

    def _prepare_for_cache(self, data: dict) -> str:
        """
        Uses the Custom Encoder to handle nested dates and IDs automatically.
        """
        return json.dumps(data, cls=MongoEncoder)

    async def get_user_by_email(self, email: str):
        """
        Finds a user by email with a JSON-safe Cache-First strategy.
        """
        cached_user = redis_client.get(f"user:email:{email}")
        if cached_user:
            return json.loads(cached_user)

        user = await self.repo.get_by_email(email)
        
        if user:
            serialized_user = self._prepare_for_cache(user)
            redis_client.set(f"user:email:{email}", serialized_user, ex=3600)
            
        return user

    async def validate_user(self, identifier: str, password: str):
        """
        Validates user credentials for login using high-speed caching.
        """
        user = await self.get_user_by_email(identifier)
        
        if not user:
            user = await self.repo.get_by_username(identifier)
            
        if not user:
            return None
        
        stored_hash = user.get("hashed_password") or user.get("password")
        if not stored_hash or not verify_password(password, stored_hash): 
            return None
            
        return user


    def _generate_referral_code(self, username: str) -> str:
        """Creates a code like BUFFER123"""
        prefix = "".join(filter(str.isalnum, username))[:4].upper()
        digits = "".join(random.choices(string.digits, k=3))
        return f"{prefix}{digits}"
    
    async def register_user(self, username, password, email, device_fingerprint):
        """
        Hashes password and saves a new user with device fingerprint protection.
        """
        # 🛡️ 1. CHECK FINGERPRINT BEFORE CREATING
        # This is the last line of defense
        existing_device = await self.repo.get_by_fingerprint(device_fingerprint)
        if existing_device:
            return None # Or raise a custom exception

        existing_email = await self.repo.get_by_email(email)
        existing_user = await self.repo.get_by_username(username)
        
        if existing_email or existing_user:
            return None
        
        new_user = {
            "username": username,
            "email": email,
            "hashed_password": get_password_hash(password),
            "device_fingerprint": device_fingerprint, # 💾 SAVE THE FINGERPRINT
            "wallet_balance": 50.0,
            "total_wins": 0,
            "role": "user",
            "referral_code": self._generate_referral_code(username), 
            "referred_by": None,
            "created_at": datetime.now(timezone.utc)
        }
        
        user_id = await self.repo.create_user(new_user)
        
        # Pre-cache the new user
        new_user["_id"] = user_id
        serialized_new_user = self._prepare_for_cache(new_user)
        redis_client.set(f"user:email:{email}", serialized_new_user, ex=3600)
        
        return user_id
    
    async def get_all_users_for_admin(self, page: int = 1, search: str = ""):
        """
        Coordinates with UserRepository to provide paginated and 
        searchable data for the UserTable.tsx component.
        """
        # We pass the logic down to the repo you just updated
        users, total_pages = await self.repo.get_all_users(
            page=page, 
            limit=10, 
            search=search
        )
        
        return {
            "users": users,
            "total_pages": total_pages,
            "current_page": page
        }
    
    async def is_device_registered(self, fingerprint: str) -> bool:
        """
        🚀 BREVO SAVER: Checks if a device is already registered 
        before sending an OTP email.
        """
        if not fingerprint:
            return False
        user = await self.repo.get_by_fingerprint(fingerprint)
        return user is not None
    
    async def update_user_password(self, email: str, new_password: str):
        """Hashes the new password and clears the user's login cache."""
        hashed_pwd = get_password_hash(new_password)
    
    # 1. Update in MongoDB via Repository
        success = await self.repo.update_password(email, hashed_pwd)
    
    # 2. ⚡ CACHE INVALIDATION: Force the user to fetch new data on next login
        if success:
            redis_client.delete(f"user:email:{email}")
        
        return success
    
    async def get_detailed_online_list(self):
        """
        Fetches and parses the online list.
        """
        # Now self.user_repo will work!
        raw_list = await self.repo.get_online_users_raw()
        
        online_players = []
        for player in raw_list:
            try:
                import json
                p_str = player.decode("utf-8") if isinstance(player, bytes) else player
                online_players.append(json.loads(p_str))
            except Exception:
                continue
        return online_players