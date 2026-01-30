from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.security import decode_access_token
from app.repositories.user_repo import UserRepository
from bson import ObjectId

# This matches your frontend login route
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

async def get_user_repo():
    return UserRepository()

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    repo: UserRepository = Depends(get_user_repo)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session expired or invalid. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception
        
    user_id: str = payload.get("sub")
    if not user_id:
        raise credentials_exception
        
    # Fetch user from MongoDB - repo.get_by_id fetches the WHOLE document
    # which includes the 'recent_matches' array automatically.
    user = await repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User no longer exists."
        )
    
    # Standardize IDs
    user["id"] = str(user["_id"])
    
    # We return the whole user object. 
    # Because MongoDB documents are dynamic, if 'recent_matches' exists in DB,
    # it is now inside this dictionary.
    return user

async def validate_game_access(current_user: dict = Depends(get_current_user)):
    MIN_ENTRY_FEE = 50.0 
    balance = current_user.get("wallet_balance", 0)
    
    if balance < MIN_ENTRY_FEE:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "INSUFFICIENT_FUNDS",
                "current_balance": balance,
                "required": MIN_ENTRY_FEE,
                "message": f"You need at least {MIN_ENTRY_FEE} PKR to join this match."
            }
        )
    
    return current_user

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") == "admin":
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin privileges required."
    )