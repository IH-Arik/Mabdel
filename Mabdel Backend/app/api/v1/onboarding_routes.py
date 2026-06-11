from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.repositories.onboarding_repository import OnboardingRepository
from app.schemas.common import ApiErrorResponse, ApiResponse
from app.schemas.onboarding import (
    OnboardingActionRequest,
    OnboardingProgressResponse,
    OnboardingProgressUpsertRequest,
    OnboardingSlideResponse,
)
from app.services.onboarding_service import OnboardingService
from app.utils.responses import success_response

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


def get_onboarding_service(db: AsyncIOMotorDatabase = Depends(get_database)) -> OnboardingService:
    return OnboardingService(OnboardingRepository(db))


@router.get(
    "/slides",
    response_model=ApiResponse[list[OnboardingSlideResponse]],
    responses={200: {"description": "Returns only active onboarding slides sorted by sort_order."}},
    summary="Get onboarding slides",
)
async def get_onboarding_slides(service: OnboardingService = Depends(get_onboarding_service)) -> dict:
    data = await service.get_slides()
    return success_response(data=[slide.model_dump() for slide in data], message="Onboarding slides fetched successfully.")


@router.get(
    "/progress",
    response_model=ApiResponse[OnboardingProgressResponse],
    responses={400: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
    summary="Fetch onboarding progress by user_id or device_id",
)
async def get_onboarding_progress(
    user_id: str | None = Query(default=None),
    device_id: str | None = Query(default=None),
    service: OnboardingService = Depends(get_onboarding_service),
) -> dict:
    progress = await service.get_progress(user_id=user_id, device_id=device_id)
    return success_response(data=progress.model_dump(), message="Onboarding progress fetched successfully.")


@router.post(
    "/progress",
    status_code=status.HTTP_200_OK,
    response_model=ApiResponse[OnboardingProgressResponse],
    responses={400: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
    summary="Save current onboarding step",
)
async def save_onboarding_progress(
    payload: OnboardingProgressUpsertRequest, service: OnboardingService = Depends(get_onboarding_service)
) -> dict:
    progress = await service.upsert_progress(payload)
    return success_response(data=progress.model_dump(), message="Onboarding progress saved successfully.")


@router.post(
    "/skip",
    status_code=status.HTTP_200_OK,
    response_model=ApiResponse[OnboardingProgressResponse],
    responses={400: {"model": ApiErrorResponse}, 409: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
    summary="Mark onboarding as skipped",
)
async def skip_onboarding(payload: OnboardingActionRequest, service: OnboardingService = Depends(get_onboarding_service)) -> dict:
    progress = await service.mark_skipped(payload)
    return success_response(data=progress.model_dump(), message="Onboarding marked as skipped.")


@router.post(
    "/complete",
    status_code=status.HTTP_200_OK,
    response_model=ApiResponse[OnboardingProgressResponse],
    responses={400: {"model": ApiErrorResponse}, 409: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
    summary="Mark onboarding as completed",
)
async def complete_onboarding(
    payload: OnboardingActionRequest, service: OnboardingService = Depends(get_onboarding_service)
) -> dict:
    progress = await service.mark_completed(payload)
    return success_response(data=progress.model_dump(), message="Onboarding marked as completed.")


@router.post(
    "/reset",
    status_code=status.HTTP_200_OK,
    response_model=ApiResponse[OnboardingProgressResponse],
    responses={400: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
    summary="Reset onboarding progress (testing/admin only)",
)
async def reset_onboarding(payload: OnboardingActionRequest, service: OnboardingService = Depends(get_onboarding_service)) -> dict:
    progress = await service.reset_progress(payload)
    return success_response(data=progress.model_dump(), message="Onboarding progress has been reset.")
