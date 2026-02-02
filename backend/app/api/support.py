from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from decouple import config
import jwt

# Import the new Repository
from app.repositories.report_repo import ReportRepository

router = APIRouter()

# 1. Config & Secrets
JWT_SECRET = config("SECRET_KEY", default=config("secret", default=config("JWT_SECRET", default=None)))
JWT_ALGORITHM = config("algorithm", default="HS256")

# 2. Input Model
class ReportModel(BaseModel):
    type: str
    description: str
    matchId: str = None

# 3. Auth Helper (Verifies Token)
async def verify_token(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=403, detail="Invalid auth scheme")
    
    token = authorization.split(" ")[1]
    
    if not JWT_SECRET:
        raise HTTPException(status_code=500, detail="Server misconfiguration: Missing Secret")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["sub"] # Returns User ID
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid token")

# 4. API Endpoint (Saves to DB)
@router.post("/report")
async def submit_report(report: ReportModel, user_id: str = Depends(verify_token)):
    
    # Prepare data for the repository
    report_data = {
        "user_id": user_id,
        "type": report.type,
        "description": report.description,
        "match_id": report.matchId
    }
    
    # Save to MongoDB
    repo = ReportRepository()
    await repo.create_report(report_data)

    print(f"✅ REPORT SAVED to DB for User: {user_id}")
    
    return {"status": "saved", "message": "Report submitted successfully"}

@router.get("/all")
async def get_all_reports(user_id: str = Depends(verify_token)):
    # In a real app, you should check if user_id is an Admin here!
    repo = ReportRepository()
    reports = await repo.get_all_reports()
    return reports