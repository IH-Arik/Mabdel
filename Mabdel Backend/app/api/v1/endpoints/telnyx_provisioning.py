from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.core.exceptions import AppException
from app.dependencies import get_current_user, get_mongo_database, require_permission
from app.services.telnyx_provisioning_service import TelnyxProvisioningService
from app.services.telnyx_web_voice_service import TelnyxWebVoiceService
from app.utils.responses import success_response


class CustomTelnyxCredentials(BaseModel):
    api_key: str = Field(min_length=10)
    phone_number: str = Field(min_length=7)


class VoiceRegistrationPayload(BaseModel):
    identity: str = Field(min_length=3)
    active: bool = True


router = APIRouter(prefix="/telnyx", tags=["Telnyx Provisioning"])


def get_provisioning_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> TelnyxProvisioningService:
    return TelnyxProvisioningService(db)


def get_voice_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> TelnyxWebVoiceService:
    return TelnyxWebVoiceService(db)


def _require_organization_id(user: dict) -> str:
    organization_id = user.get("organization_id")
    if not organization_id:
        raise AppException(
            status_code=422,
            code="NO_ORGANIZATION",
            message="Your account isn't part of an organization yet.",
        )
    return organization_id


@router.get("/status")
async def get_telnyx_status(
    # Everyone on the team can see whether the business number is set up — only
    # provisioning/releasing/BYO-credentials needs calls:manage below.
    current_user: dict = Depends(require_permission("calls", "view")),
    service: TelnyxProvisioningService = Depends(get_provisioning_service),
) -> dict:
    """Returns the organization's Telnyx provisioning status and phone number —
    one number per business, shared by the whole team."""
    organization_id = _require_organization_id(current_user)
    result = await service.get_status(organization_id)
    return success_response(data=result, message="Telnyx status fetched.")


@router.post("/provision")
async def provision_telnyx(
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: TelnyxProvisioningService = Depends(get_provisioning_service),
) -> dict:
    """
    Orders a Telnyx voice-enabled number for the organization and attaches it to the
    platform's Call Control Application. Runs synchronously (in a thread pool) and
    returns once the order settles. One number per business — every team member with
    calls:manage (owner + manager by default) shares it.
    """
    organization_id = _require_organization_id(current_user)
    user_id = str(current_user["_id"])

    existing = await service.get_status(organization_id)
    if existing.get("telnyx_setup_status") == "provisioning":
        return success_response(
            data={"telnyx_setup_status": "provisioning", "telnyx_phone_number": None},
            message="Provisioning already in progress.",
        )

    result = await service.provision_organization(organization_id, user_id)
    return success_response(data=result, message="Telnyx number provisioned successfully.")


@router.delete("/release")
async def release_telnyx(
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: TelnyxProvisioningService = Depends(get_provisioning_service),
) -> dict:
    """Releases the organization's Telnyx phone number."""
    organization_id = _require_organization_id(current_user)
    await service.release_organization(organization_id)
    return success_response(message="Telnyx number released.")


@router.post("/custom")
async def save_custom_telnyx(
    payload: CustomTelnyxCredentials,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: TelnyxProvisioningService = Depends(get_provisioning_service),
) -> dict:
    """
    Saves the organization's own Telnyx API key after validating it with a live API call.
    """
    organization_id = _require_organization_id(current_user)
    result = await service.save_custom_credentials(
        organization_id=organization_id,
        api_key=payload.api_key,
        phone_number=payload.phone_number,
    )
    return success_response(data=result, message="Custom Telnyx credentials saved successfully.")


@router.delete("/custom")
async def remove_custom_telnyx(
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: TelnyxProvisioningService = Depends(get_provisioning_service),
) -> dict:
    """Removes the organization's custom Telnyx credentials."""
    organization_id = _require_organization_id(current_user)
    await service.remove_custom_credentials(organization_id)
    return success_response(message="Custom Telnyx credentials removed.")


# ── Browser (WebRTC) calling ─────────────────────────────────────────────────
# Unlike the phone number above, WebRTC login credentials stay per-user — everyone
# needs their own browser session/identity even though they share one caller ID.


@router.get("/voice/token")
async def get_telnyx_voice_token(
    current_user: dict = Depends(get_current_user),
    service: TelnyxWebVoiceService = Depends(get_voice_service),
) -> dict:
    user_id = str(current_user["_id"])
    token_payload = await service.create_access_token(user_id)
    return success_response(data=token_payload, message="Telnyx voice token created.")


@router.post("/voice/registration")
async def update_telnyx_voice_registration(
    payload: VoiceRegistrationPayload,
    current_user: dict = Depends(get_current_user),
    service: TelnyxWebVoiceService = Depends(get_voice_service),
) -> dict:
    user_id = str(current_user["_id"])
    await service.set_registration(user_id=user_id, identity=payload.identity, active=payload.active)
    return success_response(message="Telnyx voice registration updated.")
