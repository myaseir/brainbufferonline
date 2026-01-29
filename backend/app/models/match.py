from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class MatchBase(BaseModel):
    player1_id: str
    player2_id: Optional[str] = None # Starts as None until opponent joins
    entry_fee: float = 10.0
    pot_amount: float = 20.0

class MatchCreate(MatchBase):
    pass

class MatchUpdate(BaseModel):
    player2_id: Optional[str] = None
    winner_id: Optional[str] = None
    is_active: bool = False
    ended_at: Optional[datetime] = None

class MatchInDB(MatchBase):
    id: str = Field(alias="_id")
    is_active: bool = True
    winner_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None

    class Config:
        populate_by_name = True # Allows using _id from Mongo as id in Python