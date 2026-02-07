import random
import asyncio
import httpx  # Using httpx for async email sending
import json
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, status
from pydantic import BaseModel, EmailStr
from app.services.auth_service import AuthService
from app.core.security import create_access_token
from app.core.deps import get_current_user
from app.core.config import settings
from app.db.redis import redis_client # Import our shared brain

router = APIRouter()
auth_service = AuthService()

# --- Pydantic Models ---
class SignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class VerifyRequest(BaseModel):
    email: str
    code: str

# --- Helper: Email Sender (Updated to Async) ---
async def send_otp_email(target_email: str, code: str):
    # These pull directly from your .env via your settings object
    brevo_key = settings.BREVO_API_KEY
    sender_email = settings.SENDER_EMAIL
    sender_name = getattr(settings, "SENDER_NAME", "Glacia Labs")

    if not brevo_key:
        print("❌ Error: BREVO_API_KEY is missing in .env")
        return

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": brevo_key,
        "content-type": "application/json"
    }

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": target_email}],
        "subject": f"Verify Your Account - {sender_name}",
        "htmlContent": f"""
            <html>
                <body style="font-family: sans-serif; padding: 20px;">
                    <h2>Your Security Code</h2>
                    <p>Use the following code to verify your identity:</p>
                    <div style="background: #f4f4f4; padding: 10px; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
                        {code}
                    </div>
                    <p>This code was requested for <strong>{target_email}</strong>.</p>
                </body>
            </html>
        """
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, headers=headers)
            
            if response.status_code >= 400:
                print(f"❌ Brevo API Error ({response.status_code}): {response.text}")
            else:
                print(f"✅ OTP sent successfully to {target_email}")
                
        except httpx.RequestError as e:
            print(f"❌ Network Exception while hitting Brevo: {e}")
# --- Endpoints ---

@router.post("/signup/request")
async def signup_request(user_data: SignupRequest, background_tasks: BackgroundTasks):
    existing_email = await auth_service.get_user_by_email(user_data.email)
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    otp_code = str(random.randint(100000, 999999))
    
    # --- 🚀 SCALING UPDATE: REDIS STORAGE ---
    # We store the signup info in Redis with a 10-minute expiry (600s)
    # This works across all servers!
    signup_data = {
        "username": user_data.username,
        "password": user_data.password, 
        "code": otp_code
    }
    
    # Store as a JSON string in Redis
    redis_client.set(
        f"signup:{user_data.email}", 
        json.dumps(signup_data), 
        ex=600
    )
    
    background_tasks.add_task(send_otp_email, user_data.email, otp_code)
    return {"msg": "Verification code sent to email. Valid for 10 minutes."}

@router.post("/signup/verify")
async def signup_verify(data: VerifyRequest):
    # --- 🚀 SCALING UPDATE: FETCH FROM REDIS ---
    cached_data = redis_client.get(f"signup:{data.email}")
    
    if not cached_data:
        raise HTTPException(status_code=400, detail="OTP expired or email not found")
    
    user_info = json.loads(cached_data)
    
    if user_info["code"] != data.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Create the user in MongoDB
    user_id = await auth_service.register_user(
        user_info["username"], 
        user_info["password"],
        data.email
    )
    
    if not user_id:
        raise HTTPException(status_code=500, detail="User creation failed")
    
    # Delete from Redis after successful verification
    redis_client.delete(f"signup:{data.email}")
    
    return {"msg": "Account verified successfully", "user_id": str(user_id)}


@router.get("/me")
async def get_current_user_details(user: dict = Depends(get_current_user)):
    """
    Returns the full profile including referral data with serialized IDs.
    """
    # 1. Handle potential ObjectIds in recent_matches list
    recent_matches = user.get("recent_matches", [])
    for match in recent_matches:
        if "match_id" in match:
            match["match_id"] = str(match["match_id"])
        if "winner_id" in match:
            match["winner_id"] = str(match["winner_id"])

    # 2. Return serialized dictionary
    return {
        "username": user.get("username"),
        "email": user.get("email"),
        "wallet_balance": round(user.get("wallet_balance", 0), 2),
        "user_id": str(user.get("_id") or user.get("id")),
        "total_wins": user.get("total_wins", 0),
        "total_matches": user.get("total_matches", 0),
        "rank": user.get("rank", "Elite"),
        "recent_matches": recent_matches,
        "referral_code": user.get("referral_code"), 
        # ✅ CRITICAL: Convert referred_by to string or None
        "referred_by": str(user.get("referred_by")) if user.get("referred_by") else None
    }
@router.post("/login")
async def login(data: LoginRequest):
    user = await auth_service.validate_user(data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": str(user["_id"])})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "wallet_balance": round(user.get("wallet_balance", 0), 2),
            "user_id": str(user["_id"]),
            "recent_matches": user.get("recent_matches", []) # ✅ Also good to include on login
        }
    }