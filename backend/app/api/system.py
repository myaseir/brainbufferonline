from fastapi import APIRouter, Query,HTTPException, Body,Depends
from app.core.config import settings
from packaging import version
from app.db.redis import redis_client
from app.core.deps import get_current_admin
router = APIRouter()

@router.get("/version-check")
async def check_version(v: str = Query(None, alias="v")):
    # 1. Fallback if version is missing
    if not v:
        return {"must_update": True, "message": "Version header missing"}

    # 2. Clean the strings (removes spaces/newlines from .env or request)
    user_v_str = v.strip()
    min_v_str = settings.MIN_REQUIRED_MOBILE_VERSION.strip()
    latest_v_str = settings.LATEST_MOBILE_VERSION.strip()

    # 3. Parse and Compare
    user_v = version.parse(user_v_str)
    min_v = version.parse(min_v_str)
    latest_v = version.parse(latest_v_str)

    # 4. Logic
    must_update = user_v < min_v
    update_available = user_v < latest_v

    return {
        "must_update": bool(must_update),
        "update_available": bool(update_available),
        "latest_version": latest_v_str,
        "download_url": settings.MOBILE_DOWNLOAD_URL,
        "message": "Critical update required!" if must_update else "App is up to date."
    }

@router.get("/status")
async def get_system_status():
    """
    Called by MaintenanceGuard on the frontend to check if the app is locked.
    """
    # Check for both byte-strings and regular strings for maximum reliability
    raw_value = redis_client.get("system_maintenance")
    is_maintenance = raw_value in [b"true", "true", b"1", "1"]
    
    return {
        "maintenance": is_maintenance,
        "message": "BrainBuffer is undergoing a scheduled integrity audit.",
        # "estimated_time": "30-60 minutes"
    }

# --- 🔐 ADMIN ROUTE (Used by Admin Panel) ---
@router.post("/maintenance/toggle")
async def toggle_maintenance(
    payload: dict = Body(...), 
    admin: dict = Depends(get_current_admin)
):
    """
    Called by the Admin Panel to flip the switch in Redis.
    Expects: {"status": true} or {"status": false}
    """
    status = payload.get("status")
    
    if status is None:
        raise HTTPException(status_code=400, detail="Status boolean is required")

    # Save as string for easy reading by the GET route
    value = "true" if status else "false"
    redis_client.set("system_maintenance", value)
    
    return {
        "success": True, 
        "new_state": status,
        "message": f"System maintenance set to {value}"
    }