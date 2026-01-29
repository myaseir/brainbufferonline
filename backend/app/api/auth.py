import random
import smtplib
import asyncio
from email.message import EmailMessage
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from app.services.auth_service import AuthService
from app.core.security import create_access_token, decode_access_token # ✅ Added decode_access_token

router = APIRouter()
auth_service = AuthService()

# --- OAuth2 Scheme (Required for 'Depends') ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Temporary in-memory store for OTPs and user data
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
        print(f"OTP Expired: Removing {email} from memory.")
        del pending_users[email]

# --- Helper: Email Sender ---
def send_otp_email(target_email: str, code: str):
    msg = EmailMessage()
    msg.set_content(f"Welcome to BrainBuffer! Your verification code is: {code}\n\nThis code will expire in 10 minutes.")
    msg['Subject'] = 'Verify Your BrainBuffer Account'
    msg['From'] = "techglacia@gmail.com"
    msg['To'] = target_email

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login("techglacia@gmail.com", "veyrigopokjsckhw")
            smtp.send_message(msg)
    except Exception as e:
        print(f"SMTP Error: {e}")

# --- Helper: Get Current User ID (Dependency) ---
async def get_current_user_id(token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload.get("sub")

# --- Endpoints ---

@router.get("/me")
async def get_current_user_details(user_id: str = Depends(get_current_user_id)):
    """
    Fetches the current authenticated user's fresh data (Balance, etc.)
    """
    user = await auth_service.get_user_by_id(user_id) # Ensure this method exists in AuthService or use repo directly
    # If AuthService doesn't expose get_user_by_id, use auth_service.repo.get_by_id(user_id)
    
    # Fallback if auth_service wrapper is missing, assuming auth_service has a repo:
    if not user and hasattr(auth_service, 'user_repo'):
         user = await auth_service.user_repo.get_by_id(user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Return fresh details (Safe filtering)
    return {
        "username": user["username"],
        "email": user["email"],
        "wallet_balance": user.get("wallet_balance", 0),
        "user_id": str(user["_id"])
    }

@router.post("/login")
async def login(data: LoginRequest):
    """
    Handles user login, validates credentials, and issues a JWT token.
    """
    user = await auth_service.validate_user(data.email, data.password)
    
    if not user:
        raise HTTPException(
            status_code=401, 
            detail="Invalid email or password"
        )
    
    # ✅ Create JWT Token
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