from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.dependencies import get_current_user, get_mongo_database
from app.services.twilio_provisioning_service import TwilioProvisioningService
from app.utils.responses import success_response


class CustomTwilioCredentials(BaseModel):
    account_sid: str = Field(min_length=34, max_length=34)
    auth_token: str = Field(min_length=10)
    phone_number: str = Field(min_length=7)

router = APIRouter(prefix="/twilio", tags=["Twilio Provisioning"])


def get_provisioning_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> TwilioProvisioningService:
    return TwilioProvisioningService(db)


@router.get("/status")
async def get_twilio_status(
    current_user: dict = Depends(get_current_user),
    service: TwilioProvisioningService = Depends(get_provisioning_service),
) -> dict:
    """Returns the current user's Twilio provisioning status and phone number."""
    user_id = str(current_user["_id"])
    result = await service.get_status(user_id)
    return success_response(data=result, message="Twilio status fetched.")


@router.post("/provision")
async def provision_twilio(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    service: TwilioProvisioningService = Depends(get_provisioning_service),
) -> dict:
    """
    Triggers Twilio sub-account creation and phone number purchase for the current user.
    If already active, returns existing info. Otherwise provisions synchronously
    (runs in thread pool) and returns when complete.
    """
    user_id = str(current_user["_id"])

    # If already provisioning, return current status immediately
    current_status = current_user.get("twilio_setup_status", "not_provisioned")
    if current_status == "provisioning":
        return success_response(
            data={"twilio_setup_status": "provisioning", "twilio_phone_number": None},
            message="Provisioning already in progress.",
        )

    result = await service.provision_user(user_id)
    return success_response(data=result, message="Twilio number provisioned successfully.")


@router.delete("/release")
async def release_twilio(
    current_user: dict = Depends(get_current_user),
    service: TwilioProvisioningService = Depends(get_provisioning_service),
) -> dict:
    """Releases the user's Twilio sub-account and phone number."""
    user_id = str(current_user["_id"])
    await service.release_user(user_id)
    return success_response(message="Twilio number released.")


@router.post("/custom")
async def save_custom_twilio(
    payload: CustomTwilioCredentials,
    current_user: dict = Depends(get_current_user),
    service: TwilioProvisioningService = Depends(get_provisioning_service),
) -> dict:
    """
    Saves the user's own Twilio credentials after validating them.
    Validates Account SID + Auth Token by making a live Twilio API call.
    """
    user_id = str(current_user["_id"])
    result = await service.save_custom_credentials(
        user_id=user_id,
        account_sid=payload.account_sid,
        auth_token=payload.auth_token,
        phone_number=payload.phone_number,
    )
    return success_response(data=result, message="Custom Twilio credentials saved successfully.")


@router.delete("/custom")
async def remove_custom_twilio(
    current_user: dict = Depends(get_current_user),
    service: TwilioProvisioningService = Depends(get_provisioning_service),
) -> dict:
    """Removes the user's custom Twilio credentials."""
    user_id = str(current_user["_id"])
    await service.remove_custom_credentials(user_id)
    return success_response(message="Custom Twilio credentials removed.")
