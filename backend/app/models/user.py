from pydantic import BaseModel, Field
from typing import Optional

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str
    # We add this so a user can optionally provide a referral code during signup
    referred_by_code: Optional[str] = None 

class UserInDB(UserBase):
    id: str = Field(alias="_id")
    wallet_balance: float = 0.0
    total_wins: int = 0
    
    # --- ADD THESE FOR REFERRAL SYSTEM ---
    # The unique code this user shares with others
    referral_code: str 
    
    # Stores the ID of the person who invited this user (to prevent double claiming)
    referred_by: Optional[str] = None