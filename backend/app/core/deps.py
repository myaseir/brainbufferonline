from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core.config import settings
from app.core.security import decode_access_token
from app.repositories.user_repo import UserRepository

# This tells FastAPI where to look for the token (the login endpoint)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")
user_repo = UserRepository()

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Decodes the JWT and fetches the user from the database.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
        
    user = await user_repo.get_by_id(user_id)
    if user is None:
        raise credentials_exception
        
    return user

async def validate_game_access(user: dict = Depends(get_current_user)):
    """
    Checks if the user has a minimum balance to join a real-money game.
    """
    MIN_ENTRY_FEE = 10.0 # You can adjust this based on your game rules
    
    if user.get("wallet_balance", 0) < MIN_ENTRY_FEE:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient balance. Minimum {MIN_ENTRY_FEE} PKR required to play."
        )
    
    return user