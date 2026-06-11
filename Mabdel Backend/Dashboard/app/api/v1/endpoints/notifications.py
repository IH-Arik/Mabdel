from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from Dashboard.app.dependencies import get_mongo_database, get_current_user
from Dashboard.app.repositories.notification_repository import NotificationRepository
from Dashboard.app.schemas.dashboard_schemas import (
    BaseResponse, 
    PaginatedResponse, 
    NotificationItem
)

router = APIRouter()

def get_notification_repo(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> NotificationRepository:
    return NotificationRepository(db)


@router.get("/", response_model=BaseResponse[PaginatedResponse[NotificationItem]])
async def list_notifications(
    limit: int = 10,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repo),
):
    """
    Get a paginated list of notifications for the current user. 
    This supports the 'All Notifications' view and the 'Load More' action.
    """
    items, total = await repo.get_user_notifications(str(current_user["_id"]), limit, offset)
    notification_items = [
        NotificationItem(
            id=str(item["_id"]),
            title=item.get("title", ""),
            message=item.get("message", ""),
            type=item.get("type", "info"),
            is_read=item.get("is_read", False),
            created_at=item.get("created_at")
        )
        for item in items
    ]
    data = PaginatedResponse(items=notification_items, total=total, limit=limit, offset=offset)
    return BaseResponse(data=data)


@router.patch("/{notification_id}/read", response_model=BaseResponse[bool])
@router.post("/{notification_id}/read", response_model=BaseResponse[bool])
async def mark_notification_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repo),
):
    """
    Mark a specific notification as read.
    """
    success = await repo.mark_as_read(notification_id, str(current_user["_id"]))
    return BaseResponse(data=success, message="Notification marked as read" if success else "Notification not found or already read")


@router.patch("/read-all", response_model=BaseResponse[bool])
@router.post("/read-all", response_model=BaseResponse[bool])
async def mark_all_notifications_as_read(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    result = await db.notifications.update_many(
        {"user_id": str(current_user["_id"]), "is_read": False},
        {"$set": {"is_read": True}},
    )
    return BaseResponse(data=True, message=f"{result.modified_count} notifications marked as read")


@router.get("/unread-count", response_model=BaseResponse[int])
async def get_unread_notifications_count(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    """
    Get the number of unread notifications for the current user. Used for the UI badge.
    """
    count = await db.notifications.count_documents({"user_id": str(current_user["_id"]), "is_read": False})
    return BaseResponse(data=count)
