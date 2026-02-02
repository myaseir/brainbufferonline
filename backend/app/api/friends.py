from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.core.config import settings
from app.repositories.friend_repo import FriendRepository
from app.db.redis import redis_client

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
    repo = FriendRepository()
    friends = await repo.get_friends(user_id)
    
    # Check Real-Time Online Status
    for friend in friends:
        # 🔥 FIX: Removed 'await' here because your Redis client is synchronous
        is_online = redis_client.get(f"presence:{friend['id']}")
        friend["is_online"] = True if is_online else False
        
    return friends

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
    # Assuming you have a delete method. If not, you might need to add it to friend_repo.py
    # If using pure SQL in repo, it would look like: 
    # await database.execute("DELETE FROM friend_requests WHERE id = :id AND receiver_id = :uid", {"id": request_id, "uid": user_id})
    
    # Simple workaround if you don't want to edit repo:
    # return await repo.reject_request(request_id, user_id) 
    
    # Or assuming you updated the repo:
    await repo.decline_request(request_id, user_id)
    return {"success": True}