from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from bson import ObjectId

# ==========================================
# 1. DEPOSIT SCHEMAS
# ==========================================
class DepositCreate(BaseModel):
    """
    The exact payload received from the frontend for deposits.
    """
    full_name: str = Field(..., min_length=3, description="Full name of the sender")
    sender_number: str = Field(..., min_length=10, description="The Easypaisa/JazzCash number")
    amount: float = Field(..., gt=0, description="Amount sent in PKR")
    trx_id: str = Field(..., min_length=4, description="The unique Transaction ID")

    class Config:
        json_schema_extra = {
            "example": {
                "full_name": "Owais Afzal",
                "sender_number": "03001234567",
                "amount": 500.0,
                "trx_id": "882736451"
            }
        }

class DepositTransaction(DepositCreate):
    """
    The full document stored in the database for deposits.
    """
    user_id: str 
    username: str
    status: str = Field(default="PENDING", description="PENDING, COMPLETED, REJECTED")
    created_at: datetime = Field(default_factory=datetime.now)
    admin_note: Optional[str] = None
    approved_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

# ==========================================
# 2. WITHDRAWAL SCHEMAS (This was missing!)
# ==========================================
class WithdrawalRequest(BaseModel):
    """
    Payload for withdrawal requests from the frontend.
    """
    amount: float = Field(..., gt=0, description="Amount to withdraw")
    method: str = Field(..., description="Easypaisa or JazzCash")
    account_number: str = Field(..., min_length=10, description="User's account number")
    account_name: str = Field(..., min_length=3, description="User's account title")

    class Config:
        json_schema_extra = {
            "example": {
                "amount": 1000.0,
                "method": "Easypaisa",
                "account_number": "03001234567",
                "account_name": "Muhammad Yasir"
            }
        }