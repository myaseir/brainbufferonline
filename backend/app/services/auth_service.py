from app.repositories.user_repo import UserRepository
from app.core.security import get_password_hash, verify_password

class AuthService:
    def __init__(self):
        self.repo = UserRepository()

    async def get_user_by_email(self, email: str):
        """Finds a user by email via the repository."""
        return await self.repo.get_by_email(email)

    async def validate_user(self, email, password):
        """
        Validates user credentials for login.
        Returns user data if successful, None otherwise.
        """
        user = await self.repo.get_by_email(email)
        if not user:
            return None
        
        # Check if the plain password matches the hashed password in DB
        if not verify_password(password, user["password"]):
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
            "password": get_password_hash(password),
            "wallet_balance": 50.0,  # 🎁 Welcome bonus for testing
            "total_wins": 0
        }
        
        # 3. Save to DB
        return await self.repo.create_user(new_user)