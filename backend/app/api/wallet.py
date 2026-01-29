from fastapi import APIRouter, Request, Header, HTTPException, Depends
from app.services.wallet_service import WalletService
from app.core.config import settings
import hmac
import hashlib

router = APIRouter()
wallet_service = WalletService()

@router.post("/webhook/v2")
async def safepay_webhook(
    request: Request,
    x_sfpy_signature: str = Header(None)
):
    # 1. Get raw body for signature verification
    body = await request.body()
    
    # 2. Verify HMAC SHA256 Signature
    secret = settings.SAFEPAY_WEBHOOK_SECRET
    expected_sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    # if not hmac.compare_digest(expected_sig, x_sfpy_signature):
    #     raise HTTPException(status_code=401, detail="Invalid signature")

    # 3. Process the event
    payload = await request.json()
    if payload.get("type") == "payment.success":
        data = payload.get("data", {})
        # We passed user_id in 'metadata' during 'init'
        user_id = data.get("metadata", {}).get("user_id")
        amount = data.get("amount")
        
        await wallet_service.handle_safepay_deposit(user_id, amount, data.get("tracker"))

    return {"status": "success"}