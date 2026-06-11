from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.repositories.app_config_repository import AppConfigRepository
from app.repositories.onboarding_repository import OnboardingRepository
from app.schemas.app_config import AppConfigResponseData
from app.schemas.common import ApiErrorResponse, ApiResponse
from app.services.app_config_service import AppConfigService
from app.utils.responses import success_response

router = APIRouter(prefix="/app", tags=["App Config"])


def get_app_config_service(db: AsyncIOMotorDatabase = Depends(get_database)) -> AppConfigService:
    return AppConfigService(
        config_repository=AppConfigRepository(db),
        onboarding_repository=OnboardingRepository(db),
    )


@router.get(
    "/config",
    response_model=ApiResponse[AppConfigResponseData],
    responses={
        200: {
            "description": "Application config for splash screen.",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "App config fetched successfully.",
                        "data": {
                            "app_name": "Mabdel AI",
                            "maintenance_mode": False,
                            "force_update": False,
                            "minimum_supported_version": "1.0.0",
                            "latest_version": "1.2.0",
                            "default_language": "en",
                            "onboarding_enabled": True,
                            "onboarding_required": True,
                            "feature_flags": {
                                "voice_assistant": True,
                                "notifications": True,
                                "contacts_sync": True,
                            },
                        },
                    }
                }
            },
        },
        422: {"model": ApiErrorResponse},
    },
    summary="Fetch splash screen app config",
)
async def get_app_config(
    current_version: str | None = Query(default=None, description="Client app version, e.g. 1.0.0"),
    user_id: str | None = Query(default=None, description="Optional logged-in user id"),
    device_id: str | None = Query(default=None, description="Optional device id for guest mode"),
    service: AppConfigService = Depends(get_app_config_service),
) -> dict:
    data = await service.get_app_config(current_version=current_version, user_id=user_id, device_id=device_id)
    return success_response(data=data.model_dump(), message="App config fetched successfully.")
