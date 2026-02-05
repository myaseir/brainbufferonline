from fastapi import APIRouter, Query
from app.core.config import settings
from packaging import version

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