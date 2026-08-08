from fastapi import APIRouter, Depends, Request, Header
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.dashboard.dashboard_service import DashboardService
from app.services.email_domain import InboundEmailService
from app.dependencies import get_dashboard_service, get_mongo_database
from app.core.config import settings
from app.core.exceptions import AppException
import json
import logging
import hmac
import hashlib
import time

logger = logging.getLogger(__name__)

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


@router.post("/resend/inbound")
async def resend_inbound_webhook(
    request: Request,
    svix_id: str = Header(default=None, alias="svix-id"),
    svix_timestamp: str = Header(default=None, alias="svix-timestamp"),
    svix_signature: str = Header(default=None, alias="svix-signature"),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
) -> dict:
    """Receive mail sent to any address on a customer's verified domain."""
    raw_body = await request.body()

    if settings.RESEND_INBOUND_WEBHOOK_SECRET:
        _verify_resend_signature(raw_body, svix_id, svix_timestamp, svix_signature)
    elif settings.ENVIRONMENT.lower() != "development":
        raise AppException(
            status_code=503,
            code="INBOUND_WEBHOOK_NOT_CONFIGURED",
            message="Inbound email webhook secret is not configured.",
        )

    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise AppException(
            status_code=400, code="INVALID_WEBHOOK_PAYLOAD", message="Invalid JSON payload."
        ) from exc

    try:
        result = await InboundEmailService(db).handle_event(event)
    except Exception:
        # Never 500 back to Resend: that triggers redelivery storms for a message
        # we will fail on again. Log it and acknowledge.
        logger.exception("Inbound email processing failed")
        return {"status": "error"}

    return {"status": result.get("status", "processed"), "reason": result.get("reason")}


def _verify_resend_signature(
    payload: bytes,
    svix_id: str | None,
    svix_timestamp: str | None,
    svix_signature: str | None,
) -> None:
    import resend

    try:
        resend.Webhooks.verify(
            {
                "payload": payload.decode("utf-8"),
                "headers": {
                    "id": svix_id,
                    "timestamp": svix_timestamp,
                    "signature": svix_signature,
                },
                "webhook_secret": settings.RESEND_INBOUND_WEBHOOK_SECRET,
            }
        )
    except ValueError as exc:
        raise AppException(
            status_code=401,
            code="INVALID_WEBHOOK_SIGNATURE",
            message="Inbound email webhook signature verification failed.",
        ) from exc


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

