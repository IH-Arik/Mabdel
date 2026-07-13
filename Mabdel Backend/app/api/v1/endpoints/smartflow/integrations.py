from __future__ import annotations

import hashlib
import hmac
import json

from fastapi import Depends, Header, Query, Request, status
from fastapi.responses import HTMLResponse

from app.core.config import settings
from app.core.exceptions import AppException
from app.dependencies import get_current_user, require_permission, require_subscription
from app.schemas.smartflow import (
    SocialIntegrationUpsertRequest,
    TelegramManualConnectRequest,
    WhatsAppManualConnectRequest,
)
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router

META_PLATFORMS = {"facebook_messenger", "instagram", "whatsapp"}


def _verify_meta_signature(raw_body: bytes, signature_header: str | None) -> None:
    secret = settings.META_CLIENT_SECRET
    if not secret:
        return
    if not signature_header or not signature_header.startswith("sha256="):
        raise AppException(status_code=401, code="WEBHOOK_SIGNATURE_MISSING", message="Meta webhook signature missing.")
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature_header):
        raise AppException(status_code=401, code="WEBHOOK_SIGNATURE_INVALID", message="Meta webhook signature invalid.")


@router.get("/integrations")
async def list_integrations(
    current_user: dict = Depends(require_permission("integrations", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_integrations(str(current_user["_id"]))
    return success_response(data=data, message="Integrations fetched successfully.")


@router.get("/integrations/catalog")
async def list_integration_catalog(
    current_user: dict = Depends(require_permission("integrations", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_integration_catalog(str(current_user["_id"]))
    return success_response(data=data, message="Integration catalog fetched successfully.")


@router.get("/integrations/status")
async def get_integration_status(
    current_user: dict = Depends(require_permission("integrations", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_integration_status(str(current_user["_id"]))
    return success_response(data=data, message="Integration status fetched successfully.")


@router.post("/integrations", status_code=status.HTTP_201_CREATED)
async def connect_integration(
    payload: SocialIntegrationUpsertRequest,
    current_user: dict = Depends(require_permission("integrations", "manage")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.upsert_integration(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Integration connected successfully.")


@router.post("/integrations/{platform}/sync")
async def sync_integration(
    platform: str,
    current_user: dict = Depends(require_permission("integrations", "manage")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.sync_integration(str(current_user["_id"]), platform)
    return success_response(data=data, message="Integration sync completed.")


@router.post("/integrations/telegram/manual-connect", status_code=status.HTTP_201_CREATED)
async def connect_telegram_manual(
    payload: TelegramManualConnectRequest,
    current_user: dict = Depends(require_permission("integrations", "manage")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.connect_telegram_manual(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Telegram connected successfully.")


@router.post("/integrations/whatsapp/manual-connect", status_code=status.HTTP_201_CREATED)
async def connect_whatsapp_manual(
    payload: WhatsAppManualConnectRequest,
    current_user: dict = Depends(require_permission("integrations", "manage")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.connect_whatsapp_manual(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="WhatsApp connected successfully.")


@router.get("/integrations/{platform}/oauth/start")
async def start_integration_oauth(
    platform: str,
    current_user: dict = Depends(require_permission("integrations", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.start_integration_oauth(str(current_user["_id"]), platform)
    return success_response(data=data, message="Integration OAuth started successfully.")


@router.get("/integrations/{platform}/oauth/callback", response_model=None)
async def complete_integration_oauth(
    platform: str,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> HTMLResponse | dict:
    if platform == "google_business":
        if error:
            html = """
            <html><body style="font-family:Arial,sans-serif;background:#0b1220;color:#fff;padding:24px;">
            <h2>Google Calendar connection was not completed.</h2>
            <p>You can close this window and try again.</p>
            <script>
              if (window.opener) { window.opener.postMessage({ type: 'mabdel-google-calendar-oauth', status: 'error' }, '*'); }
              window.close();
            </script>
            </body></html>
            """
            return HTMLResponse(content=html, status_code=200)
        if not code or not state:
            raise AppException(status_code=400, code="OAUTH_CALLBACK_INVALID", message="OAuth callback is missing required parameters.")
    else:
        if not code or not state:
            raise AppException(status_code=400, code="OAUTH_CALLBACK_INVALID", message="OAuth callback is missing required parameters.")

    data = await service.complete_integration_oauth(platform, code, state)
    if platform == "google_business":
        html = """
        <html><body style="font-family:Arial,sans-serif;background:#0b1220;color:#fff;padding:24px;">
        <h2>Google Calendar connected.</h2>
        <p>You can close this window.</p>
        <script>
          if (window.opener) { window.opener.postMessage({ type: 'mabdel-google-calendar-oauth', status: 'success' }, '*'); }
          window.close();
        </script>
        </body></html>
        """
        return HTMLResponse(content=html, status_code=200)
    return success_response(data=data, message="Integration OAuth completed successfully.")


@router.delete("/integrations/{platform}")
async def disconnect_integration(
    platform: str,
    current_user: dict = Depends(require_permission("integrations", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.disconnect_integration(str(current_user["_id"]), platform)
    return success_response(data=data, message="Integration disconnected successfully.")


@router.get("/integrations/{platform}/webhook")
async def verify_platform_webhook(
    platform: str,
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    if platform in {"instagram", "facebook_messenger", "whatsapp"}:
        service.validate_meta_webhook_challenge(hub_mode, hub_verify_token)
        return success_response(data={"challenge": hub_challenge}, message="Webhook verified successfully.")
    return success_response(data={"verified": True}, message="Webhook verification not required for this platform.")


@router.post("/integrations/{platform}/webhook")
async def receive_platform_webhook(
    platform: str,
    request: Request,
    user_id: str | None = Query(default=None, min_length=1),
    x_hub_signature_256: str | None = Header(default=None, alias="X-Hub-Signature-256"),
    x_webhook_secret: str | None = Header(default=None, alias="X-Webhook-Secret"),
    x_telegram_bot_api_secret_token: str | None = Header(default=None, alias="X-Telegram-Bot-Api-Secret-Token"),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    raw_body = await request.body()

    if platform in META_PLATFORMS:
        _verify_meta_signature(raw_body, x_hub_signature_256)

    try:
        raw_payload = json.loads(raw_body)
    except Exception:
        raise AppException(status_code=400, code="WEBHOOK_PAYLOAD_INVALID", message="Webhook payload must be valid JSON.")
    if not isinstance(raw_payload, dict):
        raise AppException(status_code=400, code="WEBHOOK_PAYLOAD_INVALID", message="Webhook payload must be a JSON object.")

    resolved_user_id = user_id or await service.resolve_webhook_user_id(
        platform,
        raw_payload,
        x_telegram_bot_api_secret_token or x_webhook_secret,
    )
    if platform == "telegram":
        await service.validate_platform_webhook_secret(resolved_user_id, platform, x_telegram_bot_api_secret_token or x_webhook_secret)
    elif platform not in META_PLATFORMS:
        service.validate_webhook_secret(x_webhook_secret)

    data = await service.handle_inbound_webhook(resolved_user_id, platform, raw_payload)
    return success_response(data=data, message="Webhook processed successfully.")
