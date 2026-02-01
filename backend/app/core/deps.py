from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.security import decode_access_token
from app.repositories.user_repo import UserRepository
from app.db.redis import redis_mgr
from app.core.config import settings

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
        
    # Heartbeat for online status
    await redis_mgr.set_player_online(user_id)
    
    user = await repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    
    user["id"] = str(user["_id"])
    return user

# --- 🚀 NEW: EMAIL VERIFICATION GATE ---
async def require_verified_user(current_user: dict = Depends(get_current_user)):
    """
    Use this dependency for routes that require the user to have 
    verified their email via OTP.
    """
    if not current_user.get("is_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "EMAIL_NOT_VERIFIED",
                "message": "Please verify your email to access this feature."
            }
        )
    return current_user

async def validate_game_access(current_user: dict = Depends(require_verified_user)):
    """Now automatically checks for verification AND balance."""
    MIN_ENTRY_FEE = 50.0 
    balance = current_user.get("wallet_balance", 0)
    
    if balance < MIN_ENTRY_FEE:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "INSUFFICIENT_FUNDS",
                "current_balance": balance,
                "required": MIN_ENTRY_FEE
            }
        )
    return current_user

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") == "admin":
        return current_user
    raise HTTPException(status_code=403, detail="Admin privileges required.")