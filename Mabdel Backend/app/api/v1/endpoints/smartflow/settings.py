from __future__ import annotations

from fastapi import Depends, File, Query, UploadFile, status

from app.dependencies import get_current_user, get_mongo_database
from app.repositories.auth_repository import AuthRepository
from app.schemas.common import ApiResponse
from app.schemas.smartflow import (
    BusinessProfileResponse,
    BusinessProfileUpdateRequest,
    ChangePasswordRequest,
    CurrentSubscriptionResponse,
    NotificationPreferences,
    NotificationSettingsUpdateRequest,
    ProfileResponse,
    PushTokenRequest,
    SettingsUpdateRequest,
    SupportMessageCreateRequest,
    SupportSessionCreateRequest,
    SupportSessionResponse,
    SupportTicketCreateRequest,
    UserReportCreateRequest,
)
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.get("/users/search")
async def search_app_users(
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_mongo_database),
) -> dict:
    data = await AuthRepository(db).search_users(
        query=q,
        organization_id=current_user.get("organization_id"),
        exclude_user_id=str(current_user["_id"]),
        page=page,
        page_size=page_size,
    )
    return success_response(data=data, message="Users fetched successfully.")


@router.get("/business-profile", response_model=ApiResponse[BusinessProfileResponse])
async def get_business_profile(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_business_profile(current_user)
    return success_response(data=data, message="Business profile fetched successfully.")


@router.patch("/business-profile", response_model=ApiResponse[BusinessProfileResponse])
async def update_business_profile(
    payload: BusinessProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_business_profile(current_user, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Business profile updated successfully.")


@router.post("/business-profile/logo", response_model=ApiResponse[BusinessProfileResponse])
async def upload_business_logo(
    logo_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    file_bytes = await logo_file.read()
    data = await service.store_business_logo(
        current_user,
        file_bytes=file_bytes,
        content_type=logo_file.content_type,
        filename=logo_file.filename,
    )
    return success_response(data=data, message="Business logo uploaded successfully.")


@router.get("/subscription/plans")
async def list_subscription_plans(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_subscription_plans()
    return success_response(data=data, message="Subscription plans fetched successfully.")


@router.get("/subscription/current", response_model=ApiResponse[CurrentSubscriptionResponse])
async def get_current_subscription(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_current_subscription(current_user)
    return success_response(data=data, message="Current subscription fetched successfully.")


@router.get("/reports/categories")
async def list_report_categories(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_report_categories()
    return success_response(data=data, message="Report categories fetched successfully.")


@router.post("/reports", status_code=status.HTTP_201_CREATED)
async def create_user_report(
    payload: UserReportCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_user_report(current_user, payload.model_dump())
    return success_response(data=data, message="Report submitted successfully.")


@router.post("/support/tickets", status_code=status.HTTP_201_CREATED)
async def create_support_ticket(
    payload: SupportTicketCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_support_ticket(current_user, payload.model_dump())
    return success_response(data=data, message="Support ticket created successfully.")


@router.get("/support/session", response_model=ApiResponse[SupportSessionResponse])
async def get_support_session(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_or_create_support_session(current_user)
    return success_response(data=data, message="Support session fetched successfully.")


@router.post("/support/session", response_model=ApiResponse[SupportSessionResponse])
async def start_support_session(
    payload: SupportSessionCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_or_create_support_session(current_user, topic=payload.topic)
    return success_response(data=data, message="Support session started successfully.")


@router.get("/support/messages")
async def list_support_messages(
    session_id: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_support_messages(current_user, session_id=session_id, page=page, page_size=page_size)
    return success_response(data=data, message="Support messages fetched successfully.")


@router.post("/support/messages", status_code=status.HTTP_201_CREATED)
async def create_support_message(
    payload: SupportMessageCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_support_chat_message(current_user, payload.model_dump(exclude_none=True))
    return success_response(data=data, message="Support message sent successfully.")


@router.delete("/account")
async def delete_account(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.delete_account(current_user)
    return success_response(data=data, message="Account deleted successfully.")


@router.get("/settings")
async def get_settings(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_settings(current_user)
    return success_response(data=data, message="Settings fetched successfully.")


@router.patch("/settings")
async def update_settings(
    payload: SettingsUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_settings(current_user, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Settings updated successfully.")


@router.post("/settings/avatar", response_model=ApiResponse[ProfileResponse])
async def upload_profile_avatar(
    avatar_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    file_bytes = await avatar_file.read()
    data = await service.store_profile_avatar(
        current_user,
        file_bytes=file_bytes,
        content_type=avatar_file.content_type,
        filename=avatar_file.filename,
    )
    return success_response(data=data, message="Profile image uploaded successfully.")


@router.get("/settings/notifications", response_model=ApiResponse[NotificationPreferences])
async def get_notification_settings(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_notification_settings(current_user)
    return success_response(data=data, message="Notification settings fetched successfully.")


@router.patch("/settings/notifications", response_model=ApiResponse[NotificationPreferences])
async def update_notification_settings(
    payload: NotificationSettingsUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_notification_settings(current_user, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Notification settings updated successfully.")


@router.post("/devices/push-token")
async def register_push_token(
    payload: PushTokenRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.register_push_token(current_user, payload.model_dump())
    return success_response(data=data, message="Push token registered successfully.")


@router.post("/settings/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.change_password(current_user, payload.current_password, payload.new_password)
    return success_response(data=data, message="Password changed successfully.")


@router.post("/settings/revoke-sessions")
async def revoke_sessions(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.revoke_sessions(current_user)
    return success_response(data=data, message="Sessions revoked successfully.")
