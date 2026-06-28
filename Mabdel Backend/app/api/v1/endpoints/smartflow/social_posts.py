from __future__ import annotations

from fastapi import Depends, Query, status

from app.dependencies import get_current_user, get_mongo_database, require_permission, require_subscription
from app.schemas.social_post import SocialPostCreateRequest
from app.services.social_posts_service import SocialPostsService
from app.utils.responses import success_response
from motor.motor_asyncio import AsyncIOMotorDatabase

from ._router import router


def _get_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> SocialPostsService:
    return SocialPostsService(db)


@router.post("/social-posts", status_code=status.HTTP_201_CREATED)
async def create_social_post(
    payload: SocialPostCreateRequest,
    current_user: dict = Depends(require_permission("social_media", "post")),
    _: dict = Depends(require_subscription),
    service: SocialPostsService = Depends(_get_service),
) -> dict:
    data = await service.create_post(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Social post processed successfully.")


@router.get("/social-posts")
async def list_social_posts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_permission("social_media", "view")),
    service: SocialPostsService = Depends(_get_service),
) -> dict:
    data = await service.list_posts(str(current_user["_id"]), page, page_size)
    return success_response(data=data, message="Social posts fetched successfully.")


@router.get("/social-posts/{post_id}")
async def get_social_post(
    post_id: str,
    current_user: dict = Depends(require_permission("social_media", "view")),
    service: SocialPostsService = Depends(_get_service),
) -> dict:
    data = await service.get_post(str(current_user["_id"]), post_id)
    return success_response(data=data, message="Social post fetched successfully.")
