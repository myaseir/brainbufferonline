from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from app.core.config import settings
from typing import Optional

# Setup Bcrypt hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compare a plain text password with its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate a Bcrypt hash of a password."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Creates a JWT access token.
    Default expiry is set in your settings or defaults to 60 minutes.
    """
    to_encode = data.copy()
    
    # Modern Python 3.11+ way to handle UTC (avoids DeprecationWarning)
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=60))
    
    to_encode.update({"exp": expire})
    
    # Ensure SECRET_KEY and ALGORITHM are in your settings.py
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=getattr(settings, "ALGORITHM", "HS256")
    )
    return encoded_jwt

def decode_access_token(token: str):
    """
    Decodes the JWT to get user information.
    Useful for protecting routes like /api/wallet or /api/game.
    """
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[getattr(settings, "ALGORITHM", "HS256")]
        )
        return payload if payload.get("exp") else None
    except JWTError:
        return None