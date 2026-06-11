from fastapi import APIRouter, Depends, Request, Header
from Dashboard.app.services.dashboard_service import DashboardService
from Dashboard.app.dependencies import get_dashboard_service
from Dashboard.app.core.config import settings
from Dashboard.app.core.exceptions import AppException
import json
import hmac
import hashlib
import time

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None),
    service: DashboardService = Depends(get_dashboard_service)
):
    payload = await request.body()
    if settings.STRIPE_WEBHOOK_SECRET:
        _verify_stripe_signature(payload, stripe_signature)
    try:
        event = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise AppException(status_code=400, code="INVALID_WEBHOOK_PAYLOAD", message="Invalid JSON payload.") from exc

    await service.handle_stripe_webhook(event)
    
    return {"status": "success"}


def _verify_stripe_signature(payload: bytes, signature_header: str | None) -> None:
    if not signature_header:
        raise AppException(status_code=400, code="MISSING_STRIPE_SIGNATURE", message="Stripe signature is required.")

    parts = dict(item.split("=", 1) for item in signature_header.split(",") if "=" in item)
    timestamp = parts.get("t")
    signature = parts.get("v1")
    if not timestamp or not signature:
        raise AppException(status_code=400, code="INVALID_STRIPE_SIGNATURE", message="Stripe signature is malformed.")

    if abs(time.time() - int(timestamp)) > 300:
        raise AppException(status_code=400, code="STALE_STRIPE_SIGNATURE", message="Stripe signature timestamp is stale.")

    signed_payload = f"{timestamp}.{payload.decode('utf-8')}".encode("utf-8")
    expected = hmac.new(settings.STRIPE_WEBHOOK_SECRET.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise AppException(status_code=400, code="INVALID_STRIPE_SIGNATURE", message="Stripe signature verification failed.")
