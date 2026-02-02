from pydantic import BaseModel, Field, BeforeValidator
from typing import Optional, Annotated
from datetime import datetime

# 1. Helper to handle MongoDB's weird ObjectId format
# This converts the database's ObjectId -> String for your code
PyObjectId = Annotated[str, BeforeValidator(str)]

class Friendship(BaseModel):
    # Map "_id" from MongoDB to "id" in Python
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    
    requester_id: str
    recipient_id: str
    
    # Default status is always "pending" when created
    status: str = Field(default="pending") 
    
    # Auto-generate timestamp if not provided
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        # Allows you to use either 'id' or '_id' when creating the object
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}
        json_schema_extra = {
            "example": {
                "requester_id": "65b8f123...",
                "recipient_id": "65b9a456...",
                "status": "pending",
                "created_at": "2026-02-02T10:00:00Z"
            }
        }