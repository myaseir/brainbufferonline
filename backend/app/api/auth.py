import random
import resend
import asyncio
from email.message import EmailMessage
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, status
from pydantic import BaseModel, EmailStr
from app.services.auth_service import AuthService
from app.core.security import create_access_token
from app.core.deps import get_current_user  # ✅ Corrected Import
from app.core.config import settings
router = APIRouter()
auth_service = AuthService()

# Temporary in-memory store for OTPs
pending_users = {}

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

# --- Helper: Cleanup Task ---
async def cleanup_otp(email: str, delay: int = 600):
    await asyncio.sleep(delay)
    if email in pending_users:
        del pending_users[email]

# --- Helper: Email Sender ---
import smtplib
from email.message import EmailMessage
# Import your settings instance
# from app.core.config import settings 

def send_otp_email(target_email: str, code: str):
    """
    Sends an OTP email using the Resend API.
    Bypasses SMTP port blocking on hosting providers like Render.
    """
    # Initialize the Resend client with your API key
    resend.api_key = settings.RESEND_API_KEY

    try:
        # Define the email parameters
        params = {
            # Use 'onboarding@resend.dev' if you haven't verified a custom domain yet
            "from": "BrainBuffer <onboarding@resend.dev>",
            "to": [target_email],
            "subject": "Verify Your BrainBuffer Account",
            "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
                    <h2 style="color: #1e293b; text-align: center;">Security Code</h2>
                    <p style="color: #475569; text-align: center;">Enter the code below to verify your account:</p>
                    <div style="background-color: #ffffff; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0f172a;">{code}</span>
                    </div>
                    <p style="font-size: 12px; color: #94a3b8; text-align: center;">This code will expire in 10 minutes.</p>
                </div>
            """
        }

        # Trigger the send via API
        email_response = resend.Emails.send(params)
        print(f"✅ OTP successfully sent via Resend API! ID: {email_response.get('id')}")

    except Exception as e:
        # This will catch API errors (like invalid keys or unverified recipients)
        print(f"❌ Resend API Error: {type(e).__name__} - {e}")
# --- Endpoints ---

@router.get("/me")
async def get_current_user_details(user: dict = Depends(get_current_user)):
    """
    Fetches the current authenticated user's fresh data from the DB.
    The 'user' dict is provided by the get_current_user dependency.
    """
    return {
        "username": user.get("username"),
        "email": user.get("email"),
        "wallet_balance": user.get("wallet_balance", 0),
        "user_id": str(user.get("_id")),
        "total_wins": user.get("total_wins", 0),
        # ✅ ADD THESE TWO LINES BELOW
        "total_matches": user.get("total_matches", 0),
        "recent_matches": user.get("recent_matches", []), 
        "rank": user.get("rank", "Elite")
    }

@router.post("/login")
async def login(data: LoginRequest):
    user = await auth_service.validate_user(data.email, data.password)
    
    if not user:
        raise HTTPException(
            status_code=401, 
            detail="Invalid email or password"
        )
    
    access_token = create_access_token(data={
        "sub": str(user["_id"]),
        "email": user["email"],
        "username": user["username"]
    })
    
    return {
        "msg": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "email": user["email"],
            "wallet_balance": user.get("wallet_balance", 0),
            "user_id": str(user["_id"])
        }
    }

@router.post("/signup/request")
async def signup_request(user_data: SignupRequest, background_tasks: BackgroundTasks):
    existing_email = await auth_service.get_user_by_email(user_data.email)
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    otp_code = str(random.randint(100000, 999999))
    
    pending_users[user_data.email] = {
        "username": user_data.username,
        "password": user_data.password, 
        "code": otp_code
    }
    
    background_tasks.add_task(send_otp_email, user_data.email, otp_code)
    background_tasks.add_task(cleanup_otp, user_data.email)
    
    return {"msg": "Verification code sent to email. Valid for 10 minutes."}

@router.post("/signup/verify")
async def signup_verify(data: VerifyRequest):
    user_info = pending_users.get(data.email)
    
    if not user_info or user_info["code"] != data.code:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    user_id = await auth_service.register_user(
        user_info["username"], 
        user_info["password"],
        data.email
    )
    
    if not user_id:
        raise HTTPException(status_code=500, detail="User creation failed")
    
    if data.email in pending_users:
        del pending_users[data.email]
    
    return {"msg": "Account verified and created successfully", "user_id": str(user_id)}