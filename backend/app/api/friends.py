from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.core.config import settings
from app.repositories.friend_repo import FriendRepository
# from app.db.redis import redis_client # ❌ Removed: Logic moved to Repo

router = APIRouter()

# 1. Define the Security Scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# 2. Dependency to decode JWT from Header
async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# 3. Routes
@router.post("/request")
async def send_friend_request(username: str, user_id: str = Depends(get_current_user)):
    repo = FriendRepository()
    return await repo.send_request(user_id, username)

@router.post("/accept/{request_id}")
async def accept_friend_request(request_id: str, user_id: str = Depends(get_current_user)):
    repo = FriendRepository()
    success = await repo.accept_request(request_id, user_id)
    return {"success": success}

@router.get("/list")
async def list_friends(user_id: str = Depends(get_current_user)):
    """
    ✅ UPDATED: Just call the repo. 
    The repo now handles fetching profiles AND live status from Redis automatically.
    """
    repo = FriendRepository()
    return await repo.get_friends(user_id)

@router.get("/requests")
async def list_requests(user_id: str = Depends(get_current_user)):
    repo = FriendRepository()
    return await repo.get_pending_requests(user_id)

@router.get("/search")
async def search_people(q: str, user_id: str = Depends(get_current_user)):
    repo = FriendRepository()
    return await repo.search_users(q, user_id)

@router.post("/decline/{request_id}")
async def decline_friend_request(request_id: str, user_id: str = Depends(get_current_user)):
    repo = FriendRepository()
    success = await repo.decline_request(request_id, user_id)
    return {"success": success}