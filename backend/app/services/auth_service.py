from app.repositories.user_repo import UserRepository
from app.core.security import get_password_hash, verify_password

class AuthService:
    def __init__(self):
        self.repo = UserRepository()

    async def get_user_by_email(self, email: str):
        """Finds a user by email via the repository."""
        return await self.repo.get_by_email(email)

    async def validate_user(self, identifier: str, password: str):
        """
        Validates user credentials for login.
        Supports checking by email OR username.
        Returns user data if successful, None otherwise.
        """
        # 1. Search by email first (standard repo method)
        user = await self.repo.get_by_email(identifier)
        
        # 2. If not found by email, try searching by username
        if not user:
            user = await self.repo.get_by_username(identifier)
            
        if not user:
            return None
        
        # 3. Robust Password Check:
        # Check for 'hashed_password' (New format) OR 'password' (Old format)
        # We use .get() to return None instead of crashing if key is missing
        stored_hash = user.get("hashed_password") or user.get("password")
        
        if not stored_hash:
            return None # No password found in DB record
            
        if not verify_password(password, stored_hash): 
            return None
            
        return user

    async def register_user(self, username, password, email):
        """Hashes password and saves a new user to the database."""
        # 1. Double check existence (Safety check)
        existing_email = await self.repo.get_by_email(email)
        existing_user = await self.repo.get_by_username(username)
        
        if existing_email or existing_user:
            return None
        
        # 2. Prepare user data
        new_user = {
            "username": username,
            "email": email,
            # ✅ Save as 'hashed_password' to match new standard
            "hashed_password": get_password_hash(password),
            "wallet_balance": 50.0,  # 🎁 Welcome bonus
            "total_wins": 0,
            "role": "user" # Default role
        }
        
        # 3. Save to DB
        return await self.repo.create_user(new_user)