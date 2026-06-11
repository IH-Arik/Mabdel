from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.common import ApiErrorResponse, ApiResponse
from app.schemas.content import ContentPageResponse
from app.services.content_service import ContentService
from app.utils.responses import success_response

router = APIRouter(prefix="/content", tags=["Content"])


def get_content_service(db: AsyncIOMotorDatabase = Depends(get_database)) -> ContentService:
    return ContentService(db)


@router.get(
    "/pages/{slug}",
    response_model=ApiResponse[ContentPageResponse],
    responses={404: {"model": ApiErrorResponse}},
)
async def get_content_page(slug: str, service: ContentService = Depends(get_content_service)) -> dict:
    page = await service.get_page(slug)
    return success_response(data=page.model_dump(), message="Content page fetched successfully.")


@router.get("/about-us", response_model=ApiResponse[ContentPageResponse])
async def get_about_us(service: ContentService = Depends(get_content_service)) -> dict:
    page = await service.get_page("about-us")
    return success_response(data=page.model_dump(), message="About Us fetched successfully.")


@router.get("/terms-and-conditions", response_model=ApiResponse[ContentPageResponse])
async def get_terms_and_conditions(service: ContentService = Depends(get_content_service)) -> dict:
    page = await service.get_page("terms-and-conditions")
    return success_response(data=page.model_dump(), message="Terms and conditions fetched successfully.")


@router.get("/privacy-policy", response_model=ApiResponse[ContentPageResponse])
async def get_privacy_policy(service: ContentService = Depends(get_content_service)) -> dict:
    page = await service.get_page("privacy-policy")
    return success_response(data=page.model_dump(), message="Privacy policy fetched successfully.")


@router.get("/help-support", response_model=ApiResponse[ContentPageResponse])
async def get_help_support(service: ContentService = Depends(get_content_service)) -> dict:
    page = await service.get_page("help-support")
    return success_response(data=page.model_dump(), message="Help and support fetched successfully.")
