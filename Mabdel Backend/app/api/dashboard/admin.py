from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_mongo_database, require_role, require_permission
from app.utils.helpers import utc_now
from app.dependencies import get_dashboard_service
from app.core.security import hash_password, verify_password, create_access_token
from app.core.exceptions import AppException
from app.schemas.dashboard_schemas import (
    BaseResponse, DashboardSummary, GrowthMetrics, PaginatedResponse, 
    UserListItem, AdminCreateRequest, EarningsSummary, TransactionListItem, 
    TransactionDetails, SubscriptionPlan, SubscriptionPlanCreate, AIStats, AILog,
    UserReportListItem, ProfileUpdateRequest, ChangePasswordRequest,
    ForgotPasswordRequest, VerifyOTPRequest, ResetPasswordRequest, SettingsContent,
    ChatConversation, ChatMessage, UserReportActionRequest, UserNoteRequest,
    SubscriptionFeesUpdateRequest, SubscriptionFeesResponse, OwnerCreateRequest,
    OwnerListItem
)

router = APIRouter()

pass


def _page_offset(page: int | None, limit: int, offset: int) -> int:
    if page and page > 0:
        return (page - 1) * limit
    return offset


def _serialize_doc(doc: dict) -> dict:
    data = {}
    for key, value in doc.items():
        if key == "_id":
            data["id"] = str(value)
            data["_id"] = str(value)
        else:
            data[key] = str(value) if value.__class__.__name__ == "ObjectId" else value
    return data


def _search_filter(search: str | None, fields: list[str]) -> dict:
    if not search:
        return {}
    return {"$or": [{field: {"$regex": search, "$options": "i"}} for field in fields]}


def _current_user_id(current_user: dict) -> str:
    return str(current_user.get("user_id") or current_user.get("_id") or current_user.get("id"))


@router.get("/summary", response_model=BaseResponse[DashboardSummary])
async def get_admin_summary(
    current_user: dict = Depends(require_permission("settings", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get a high-level summary of organization metrics including user counts, AI usage, and revenue.
    """
    org_id = current_user.get("organization_id")
    data = await service.get_admin_summary(org_id)
    return BaseResponse(data=data)


@router.get("/users", response_model=BaseResponse[PaginatedResponse[UserListItem]])
async def list_users(
    limit: int = 10,
    offset: int = 0,
    page: int | None = None,
    search: str | None = None,
    status: str | None = None,  # active, blocked
    current_user: dict = Depends(require_permission("users", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get a paginated list of users for the dashboard table. Supports searching and filtering by status (Blocked/Active).
    """
    if page and page > 0:
        offset = (page - 1) * limit

    data = await service.get_paginated_users(
        organization_id=current_user.get("organization_id"),
        limit=limit,
        offset=offset,
        search=search,
        status=status
    )
    return BaseResponse(data=data)


@router.get("/users/blocked", response_model=BaseResponse[PaginatedResponse[UserListItem]])
async def list_blocked_users(
    limit: int = 10,
    offset: int = 0,
    page: int | None = None,
    search: str | None = None,
    current_user: dict = Depends(require_permission("users", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    if page and page > 0:
        offset = (page - 1) * limit

    data = await service.get_paginated_users(
        organization_id=current_user.get("organization_id"),
        limit=limit,
        offset=offset,
        search=search,
        status="blocked",
    )
    return BaseResponse(data=data)


@router.get("/users/search", response_model=BaseResponse[PaginatedResponse[UserListItem]])
async def search_users_before_user_id(
    q: str = "",
    search: str | None = None,
    limit: int = 10,
    offset: int = 0,
    page: int | None = None,
    current_user: dict = Depends(require_permission("users", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    if page and page > 0:
        offset = (page - 1) * limit

    data = await service.get_paginated_users(
        organization_id=current_user.get("organization_id"),
        limit=limit,
        offset=offset,
        search=search or q,
    )
    return BaseResponse(data=data)


@router.get("/users/{user_id}", response_model=BaseResponse[UserListItem])
async def get_user_details(
    user_id: str,
    current_user: dict = Depends(require_permission("users", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get detailed information about a specific user. Supports the 'User Details' and 'Provider Details' screens.
    """
    data = await service.get_user_by_id(user_id)
    return BaseResponse(data=data)


@router.patch("/users/{user_id}/status", response_model=BaseResponse[bool])
async def update_user_status(
    user_id: str,
    status: str | None = None,
    body: dict | None = Body(default=None),
    current_user: dict = Depends(require_permission("users", "edit")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Update a user's status (e.g., 'active', 'blocked'). This corresponds to the 'Block/Unblock' buttons in the UI.
    """
    body = body or {}
    status = status or body.get("status")
    if not status:
        status = "blocked" if body.get("isBlocked") or body.get("blocked") else "active"

    success = await service.toggle_user_status(user_id, status)
    return BaseResponse(data=success, message=f"User status updated to {status}" if success else "Failed to update status")


@router.patch("/users/{user_id}", response_model=BaseResponse[bool])
async def update_user(
    user_id: str,
    body: dict | None = Body(default=None),
    current_user: dict = Depends(require_permission("users", "edit")),
    service: DashboardService = Depends(get_dashboard_service),
):
    body = body or {}
    status = body.get("status")
    if status or "isBlocked" in body or "blocked" in body:
        status = status or ("blocked" if body.get("isBlocked") or body.get("blocked") else "active")
        success = await service.toggle_user_status(user_id, status)
        return BaseResponse(data=success, message=f"User status updated to {status}")

    success = await service.update_admin_profile(user_id, ProfileUpdateRequest(**body))
    return BaseResponse(data=success, message="User updated")


@router.post("/create-admin", response_model=BaseResponse[str])
async def create_organization_admin(
    request: AdminCreateRequest,
    current_user: dict = Depends(require_permission("admins", "create")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    """
    Create a new administrator or privileged user. Requires 'admins:create' permission.
    Super Admin can create any role; Admin can only create roles below their hierarchy.
    """
    from app.core.exceptions import AppException
    from app.services.dashboard.rbac_service import RBACService
    from app.models.rbac_models import ROLE_HIERARCHY

    actor_role = current_user.get("primary_role") or current_user.get("role", "user")
    target_role = request.role  # e.g. "admin", "owner", "supervisor", "staff"

    # Enforce hierarchy: cannot create a role >= your own (unless super_admin)
    if actor_role != "super_admin":
        actor_level = ROLE_HIERARCHY.get(actor_role, 0)
        target_level = ROLE_HIERARCHY.get(target_role, 0)
        if target_level >= actor_level:
            raise AppException(
                status_code=403,
                code="INSUFFICIENT_HIERARCHY",
                message=f"You cannot create a '{target_role}' — it is equal to or above your own role.",
            )

    existing_user = await db.users.find_one({"email": request.email})
    if existing_user:
        raise AppException(status_code=400, code="EMAIL_EXISTS", message="User with this email already exists.")

    password_hash = hash_password(request.password)
    now = utc_now()
    new_user = {
        "full_name": request.full_name,
        "email": request.email,
        "hashed_password": password_hash,
        "password_hash": password_hash,
        "role": target_role,
        "primary_role": target_role,
        "organization_id": request.organization_id,
        "status": "active",
        "is_verified": True,
        "auth_provider": "email",
        "created_at": now,
        "updated_at": now,
        "is_subscribed": False,
    }
    result = await db.users.insert_one(new_user)
    new_user_id = str(result.inserted_id)

    # Assign role in RBAC system
    actor_id = str(current_user.get("_id") or current_user.get("id") or "")
    try:
        rbac = RBACService(db)
        await rbac.assign_role_to_user(
            user_id=new_user_id,
            role_slug=target_role,
            assigned_by=actor_id,
            assigned_by_role=actor_role,
            organization_id=request.organization_id,
        )
    except Exception:
        pass  # RBAC assignment is best-effort; user is still created

    try:
        from app.services.smartflow.smartflow_orchestrator import SmartFlowService
        smartflow = SmartFlowService(db)
        await smartflow.sync_user_global_chat_membership(new_user_id, request.organization_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Failed to add user to global chat: %s", e)

    return BaseResponse(data=new_user_id, message=f"New '{target_role}' created successfully.")


@router.get("/users-growth", response_model=BaseResponse[GrowthMetrics])
async def get_users_growth(
    current_user: dict = Depends(require_permission("users", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get analytical data for user growth trends over time for charting.
    """
    data = await service.get_growth_metrics("users", organization_id=current_user.get("organization_id"))
    return BaseResponse(data=data)


@router.get("/earnings", response_model=BaseResponse[EarningsSummary])
async def get_earnings_report(
    current_user: dict = Depends(require_permission("earnings", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get a summary of earnings (Today, This Month, Total) for the organization.
    """
    data = await service.get_earnings_summary(current_user.get("organization_id"))
    return BaseResponse(data=data)


@router.get("/earnings/transactions", response_model=BaseResponse[PaginatedResponse[TransactionListItem]])
async def list_transactions(
    limit: int = 10,
    offset: int = 0,
    current_user: dict = Depends(require_permission("earnings", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get a paginated list of transactions for the Earnings table.
    """
    data = await service.get_paginated_transactions(
        organization_id=current_user.get("organization_id"),
        limit=limit,
        offset=offset
    )
    return BaseResponse(data=data)


@router.get("/earnings/transactions/{trx_id}", response_model=BaseResponse[TransactionDetails])
async def get_trx_details(
    trx_id: str,
    current_user: dict = Depends(require_permission("earnings", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get detailed information about a specific transaction for the 'Transaction Details' pop-up.
    """
    data = await service.get_transaction_details(trx_id)
    return BaseResponse(data=data)


@router.get("/earnings/transactions/{trx_id}/invoice")
async def download_invoice(
    trx_id: str,
    current_user: dict = Depends(require_permission("earnings", "export")),
):
    """
    Download the PDF invoice for a transaction.
    """
    return BaseResponse(data=None, message="PDF Generation logic will be integrated with your invoice service")


@router.get("/reports", response_model=BaseResponse[PaginatedResponse[UserReportListItem]])
async def get_user_reports(
    limit: int = 10,
    offset: int = 0,
    current_user: dict = Depends(require_permission("reports", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get a paginated list of user reports (Moderation/Complaints). Corresponds to the 'Report' screen.
    """
    data = await service.get_paginated_user_reports(limit, offset)
    return BaseResponse(data=data)


@router.get("/admins", response_model=BaseResponse[list[UserListItem]])
async def list_admins(
    current_user: dict = Depends(require_permission("admins", "view")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    """
    List all administrators. Only accessible by Super Admins.
    """
    cursor = db.users.find({"role": {"$in": ["admin", "super_admin"]}})
    admins = await cursor.to_list(length=100)
    data = [
        UserListItem(
            id=str(a["_id"]),
            full_name=a.get("full_name", "Unknown"),
            email=a.get("email", ""),
            role=a.get("role", "admin"),
            status=a.get("status", "active"),
            created_at=a.get("created_at")
        ) for a in admins
    ]
    return BaseResponse(data=data)


@router.get("/settings", response_model=BaseResponse[dict])
async def get_dashboard_settings(
    current_user: dict = Depends(require_permission("settings", "view")),
):
    """
    Get dashboard specific settings and configurations.
    """
    return BaseResponse(data={}, message="Settings placeholder")


@router.get("/subscriptions", response_model=BaseResponse[list[SubscriptionPlan]])
async def list_subscriptions(
    current_user: dict = Depends(require_permission("subscriptions", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    List all available subscription plans for the organization.
    """
    data = await service.get_subscription_plans()
    return BaseResponse(data=data)


@router.post("/subscriptions", response_model=BaseResponse[str])
async def create_subscription_plan(
    plan: SubscriptionPlanCreate,
    current_user: dict = Depends(require_permission("subscriptions", "manage")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Create a new subscription plan (Price, Interval, Features). Only for Super Admins.
    """
    plan_id = await service.create_subscription_plan(plan)
    return BaseResponse(data=plan_id, message="Subscription plan created successfully")


@router.get("/ai/stats", response_model=BaseResponse[AIStats])
async def get_ai_stats(
    current_user: dict = Depends(require_permission("ai_logs", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get AI performance metrics and usage trends for the 'AI Insights & Monitoring' section.
    """
    data = await service.get_ai_monitoring_data(current_user.get("organization_id"))
    return BaseResponse(data=data)


@router.get("/ai/logs", response_model=BaseResponse[list[AILog]])
async def get_ai_logs(
    limit: int = 50,
    current_user: dict = Depends(require_permission("ai_logs", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get recent AI activity logs for real-time monitoring.
    """
    data = await service.get_detailed_ai_logs(limit)
    return BaseResponse(data=data)


@router.get("/profile", response_model=BaseResponse[UserListItem])
async def get_admin_profile(
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner", "supervisor", "staff"])),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get the logged-in admin's profile data. Corresponds to the 'Profile' screen header.
    """
    data = await service.get_user_by_id(_current_user_id(current_user))
    return BaseResponse(data=data)


@router.patch("/profile", response_model=BaseResponse[bool])
async def update_profile(
    data: ProfileUpdateRequest,
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner", "supervisor", "staff"])),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Update admin profile (Name, Email, Contact). Corresponds to the 'Edit Profile' screen.
    """
    success = await service.update_admin_profile(_current_user_id(current_user), data)
    return BaseResponse(data=success, message="Profile updated successfully")


@router.post("/change-password", response_model=BaseResponse[bool])
async def change_password(
    data: ChangePasswordRequest,
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner", "supervisor", "staff"])),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Change admin password. Corresponds to the 'Change Password' screen.
    """
    success = await service.change_admin_password(_current_user_id(current_user), data)
    return BaseResponse(data=success, message="Password updated successfully")


@router.post("/logout", response_model=BaseResponse[bool])
async def logout(
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner", "supervisor", "staff"])),
):
    """
    Invalidate the current session. Corresponds to the 'Confirm logging out!' modal.
    """
    # In a stateless JWT system, logout is usually handled by the frontend clearing the token.
    # However, you can implement a blacklist here if needed.
    return BaseResponse(data=True, message="Logged out successfully")


@router.get("/settings/content", response_model=BaseResponse[str])
async def get_settings_page_content(
    type: str, # privacy_policy, terms_conditions, about_us
    current_user: dict = Depends(require_role(["super_admin", "admin"])),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Fetch static content for settings pages. Corresponds to Settings Menu items.
    """
    content = await service.get_settings_content(type)
    return BaseResponse(data=content)


@router.post("/settings/content", response_model=BaseResponse[bool])
async def update_settings_page_content(
    data: SettingsContent,
    current_user: dict = Depends(require_role(["super_admin", "admin"])),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Update static content for settings pages (Privacy, Terms, etc.). Corresponds to the 'Save' button.
    """
    success = await service.update_settings_content(data)
    return BaseResponse(data=success, message=f"{data.type} updated successfully")


# AUTH (Forgot Password) Endpoints - Usually public
@router.post("/auth/forgot-password", response_model=BaseResponse[None])
async def forgot_password(
    data: ForgotPasswordRequest,
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Request an OTP for password reset. Corresponds to 'Forgot Password' screen.
    """
    await service.forgot_password(data.email)
    return BaseResponse(data=None, message="OTP sent to your email")


@router.post("/auth/verify-otp", response_model=BaseResponse[bool])
async def verify_otp(
    data: VerifyOTPRequest,
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Verify the OTP sent to email. Corresponds to 'OTP Verification' screen.
    """
    success = await service.verify_otp(data)
    return BaseResponse(data=success, message="OTP verified successfully" if success else "Invalid OTP")


@router.post("/auth/reset-password", response_model=BaseResponse[bool])
async def reset_password(
    data: ResetPasswordRequest,
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Reset password using valid OTP. Final step of forgot password flow.
    """
    success = await service.reset_password(data)
    return BaseResponse(data=success, message="Password reset successful")


# INBOX (Messaging) Endpoints
@router.get("/chats", response_model=BaseResponse[list[ChatConversation]])
async def get_all_conversations(
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner", "supervisor", "staff"])),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get all active conversations. Corresponds to the left panel of the 'Inbox' screen.
    """
    data = await service.get_conversations()
    return BaseResponse(data=data)


@router.get("/chats/{user_id}/messages", response_model=BaseResponse[list[ChatMessage]])
async def get_chat_messages(
    user_id: str,
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner", "supervisor", "staff"])),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get message history for a specific user. Corresponds to the chat bubbles on the 'Inbox' screen.
    """
    data = await service.get_chat_history(user_id, _current_user_id(current_user))
    return BaseResponse(data=data)


@router.post("/chats/{user_id}/messages", response_model=BaseResponse[None])
async def send_message(
    user_id: str,
    text: str | None = None,
    image_url: str | None = None,
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner", "supervisor", "staff"])),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Send a message to a user. Supports both text and images.
    """
    await service.send_chat_message(_current_user_id(current_user), user_id, text, image_url)
    return BaseResponse(data=None, message="Message sent")


@router.get("/activities", response_model=BaseResponse[list[dict]])
async def list_admin_activities(
    limit: int = 100,
    offset: int = 0,
    page: int | None = None,
    q: str | None = None,
    search: str | None = None,
    current_user: dict = Depends(require_permission("activities", "view")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    query = _search_filter(search or q, ["title", "name", "description", "hostName"])
    offset = _page_offset(page, limit, offset)
    items = await db.activities.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(length=limit)
    return BaseResponse(data=[_serialize_doc(item) for item in items])


@router.get("/activities/search", response_model=BaseResponse[list[dict]])
async def search_admin_activities(
    limit: int = 100,
    offset: int = 0,
    page: int | None = None,
    q: str | None = None,
    search: str | None = None,
    current_user: dict = Depends(require_permission("activities", "view")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    return await list_admin_activities(limit, offset, page, q, search, current_user, db)


@router.get("/activities/{activity_id}", response_model=BaseResponse[dict])
async def get_admin_activity(
    activity_id: str,
    current_user: dict = Depends(require_permission("activities", "view")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    from bson import ObjectId
    from app.core.exceptions import AppException

    item = await db.activities.find_one({"_id": ObjectId(activity_id) if ObjectId.is_valid(activity_id) else activity_id})
    if not item:
        raise AppException(status_code=404, code="ACTIVITY_NOT_FOUND", message="Activity not found")
    return BaseResponse(data=_serialize_doc(item))


@router.patch("/activities/{activity_id}/status", response_model=BaseResponse[bool])
async def update_admin_activity_status(
    activity_id: str,
    body: dict | None = Body(default=None),
    current_user: dict = Depends(require_permission("activities", "approve")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    from bson import ObjectId

    body = body or {}
    status = body.get("status", "approved")
    result = await db.activities.update_one(
        {"_id": ObjectId(activity_id) if ObjectId.is_valid(activity_id) else activity_id},
        {"$set": {"status": status, "updated_at": utc_now()}},
    )
    return BaseResponse(data=result.modified_count > 0, message=f"Activity status updated to {status}")


@router.post("/activities/{activity_id}/approve", response_model=BaseResponse[bool])
async def approve_admin_activity(
    activity_id: str,
    body: dict | None = Body(default=None),
    current_user: dict = Depends(require_permission("activities", "approve")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    return await update_admin_activity_status(activity_id, {"status": "approved", **(body or {})}, current_user, db)


@router.post("/activities/{activity_id}/cancel", response_model=BaseResponse[bool])
async def cancel_admin_activity(
    activity_id: str,
    body: dict | None = Body(default=None),
    current_user: dict = Depends(require_permission("activities", "approve")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    return await update_admin_activity_status(activity_id, {"status": "cancelled", **(body or {})}, current_user, db)


@router.delete("/activities/{activity_id}", response_model=BaseResponse[bool])
async def delete_admin_activity(
    activity_id: str,
    current_user: dict = Depends(require_permission("activities", "delete")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    from bson import ObjectId

    result = await db.activities.delete_one({"_id": ObjectId(activity_id) if ObjectId.is_valid(activity_id) else activity_id})
    return BaseResponse(data=result.deleted_count > 0, message="Activity deleted")


@router.get("/events", response_model=BaseResponse[list[dict]])
async def list_admin_events(
    limit: int = 100,
    offset: int = 0,
    page: int | None = None,
    q: str | None = None,
    search: str | None = None,
    current_user: dict = Depends(require_permission("events", "view")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    query = _search_filter(search or q, ["title", "name", "description", "hostName"])
    offset = _page_offset(page, limit, offset)
    items = await db.events.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(length=limit)
    return BaseResponse(data=[{**_serialize_doc(item), "entityType": "event"} for item in items])


@router.patch("/events/{event_id}/status", response_model=BaseResponse[bool])
async def update_admin_event_status(
    event_id: str,
    body: dict | None = Body(default=None),
    current_user: dict = Depends(require_permission("events", "approve")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    from bson import ObjectId

    body = body or {}
    status = body.get("status", "approved")
    result = await db.events.update_one(
        {"_id": ObjectId(event_id) if ObjectId.is_valid(event_id) else event_id},
        {"$set": {"status": status, "updated_at": utc_now()}},
    )
    return BaseResponse(data=result.modified_count > 0, message=f"Event status updated to {status}")


@router.get("/categories")
async def list_admin_categories(
    limit: int = 10,
    offset: int = 0,
    page: int | None = None,
    q: str | None = None,
    search: str | None = None,
    current_user: dict = Depends(require_permission("categories", "view")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    query = _search_filter(search or q, ["categoryName", "name"])
    offset = _page_offset(page, limit, offset)
    total = await db.categories.count_documents(query)
    items = await db.categories.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(length=limit)
    current_page = page or (offset // limit + 1)
    return {
        "success": True,
        "data": [_serialize_doc(item) for item in items],
        "meta": {
            "page": current_page,
            "limit": limit,
            "totalItems": total,
            "totalPages": max(1, (total + limit - 1) // limit),
        },
    }


@router.post("/categories")
async def create_admin_category(
    body: dict = Body(...),
    current_user: dict = Depends(require_permission("categories", "create")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    payload = {
        "categoryName": body.get("categoryName") or body.get("name") or "Untitled",
        "name": body.get("name") or body.get("categoryName") or "Untitled",
        "isActive": body.get("isActive", True),
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    result = await db.categories.insert_one(payload)
    payload["id"] = str(result.inserted_id)
    payload["_id"] = str(result.inserted_id)
    return {"success": True, "data": payload, "message": "Category created"}


@router.patch("/categories/{category_id}")
@router.put("/categories/{category_id}")
async def update_admin_category(
    category_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(require_permission("categories", "edit")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    from bson import ObjectId

    update = {k: v for k, v in body.items() if k not in {"id", "_id"}}
    if "categoryName" in update and "name" not in update:
        update["name"] = update["categoryName"]
    update["updated_at"] = utc_now()
    result = await db.categories.update_one(
        {"_id": ObjectId(category_id) if ObjectId.is_valid(category_id) else category_id},
        {"$set": update},
    )
    return {"success": True, "data": result.modified_count > 0, "message": "Category updated"}


@router.delete("/categories/{category_id}")
async def delete_admin_category(
    category_id: str,
    current_user: dict = Depends(require_permission("categories", "delete")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    from bson import ObjectId

    result = await db.categories.delete_one({"_id": ObjectId(category_id) if ObjectId.is_valid(category_id) else category_id})
    return {"success": True, "data": result.deleted_count > 0, "message": "Category deleted"}


@router.get("/event-creators")
@router.get("/event-creators/premium")
async def list_event_creators(
    limit: int = 10,
    offset: int = 0,
    page: int | None = None,
    current_user: dict = Depends(require_permission("users", "view")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    offset = _page_offset(page, limit, offset)
    query = {"role": {"$in": ["event_creator", "creator", "host"]}}
    total = await db.users.count_documents(query)
    users = await db.users.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(length=limit)
    rows = []
    for index, user in enumerate(users):
        creator_id = str(user["_id"])
        event_query = {"$or": [{"creatorId": creator_id}, {"creator_id": creator_id}, {"host_id": creator_id}, {"user_id": creator_id}]}
        total_events = await db.events.count_documents(event_query)
        rows.append({
            "sId": offset + index + 1,
            "creatorId": creator_id,
            "creatorName": user.get("full_name") or user.get("name") or "Unknown Creator",
            "creatorAvatarUrl": user.get("avatar_url") or user.get("profilePhoto"),
            "totalEvents": total_events,
            "ticketSold": int(user.get("ticketSold", 0)),
            "totalEarnings": float(user.get("totalEarnings", 0)),
            "paymentStatus": user.get("paymentStatus", "complete"),
        })
    return {"success": True, "data": rows, "meta": {"totalItems": total, "page": page or 1, "limit": limit}}


@router.get("/event-creators/{creator_id}")
@router.get("/event-creators/premium/{creator_id}")
async def get_event_creator(
    creator_id: str,
    current_user: dict = Depends(require_permission("users", "view")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    from bson import ObjectId
    from app.core.exceptions import AppException

    creator = await db.users.find_one({"_id": ObjectId(creator_id) if ObjectId.is_valid(creator_id) else creator_id})
    if not creator:
        raise AppException(status_code=404, code="EVENT_CREATOR_NOT_FOUND", message="Event creator not found")
    event_query = {"$or": [{"creatorId": creator_id}, {"creator_id": creator_id}, {"host_id": creator_id}, {"user_id": creator_id}]}
    events = await db.events.find(event_query).sort("created_at", -1).to_list(length=100)
    total_earnings = float(creator.get("totalEarnings", 0))
    paid_out = float(creator.get("totalPaidOut", 0))
    return {
        "success": True,
        "data": {
            "creator": _serialize_doc(creator),
            "metrics": {
                "totalEarnings": total_earnings,
                "totalPaidOut": paid_out,
                "pendingAmount": max(0, total_earnings - paid_out),
                "paymentStatus": creator.get("paymentStatus", "pending"),
            },
            "events": [_serialize_doc(event) for event in events],
        },
    }


@router.post("/event-creators/{creator_id}/payout")
async def payout_event_creator(
    creator_id: str,
    body: dict | None = Body(default=None),
    current_user: dict = Depends(require_permission("earnings", "manage")),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    from bson import ObjectId

    creator = await db.users.find_one({"_id": ObjectId(creator_id) if ObjectId.is_valid(creator_id) else creator_id})
    total_earnings = float((creator or {}).get("totalEarnings", 0))
    result = await db.users.update_one(
        {"_id": ObjectId(creator_id) if ObjectId.is_valid(creator_id) else creator_id},
        {"$set": {"totalPaidOut": total_earnings, "paymentStatus": "complete", "updated_at": utc_now()}},
    )
    return {"success": True, "data": result.modified_count > 0, "message": "Payout processed"}


# --- NEW INTEGRATION ENDPOINTS FOR FRONTEND ---

# Report Action endpoints
@router.post("/reports/{report_id}/action", response_model=BaseResponse[bool])
async def report_action(
    report_id: str,
    request: UserReportActionRequest,
    current_user: dict = Depends(require_permission("reports", "approve")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Apply action on a report (warn, disable_user, recover_user).
    """
    success = await service.apply_report_action(report_id, request.action, request.note)
    return BaseResponse(data=success, message="Action applied successfully")


@router.post("/reports/{report_id}/resolve", response_model=BaseResponse[bool])
async def resolve_report_endpoint(
    report_id: str,
    current_user: dict = Depends(require_permission("reports", "approve")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Resolve/close a report.
    """
    success = await service.resolve_report(report_id)
    return BaseResponse(data=success, message="Report resolved successfully")


@router.post("/reports/{report_id}/dismiss", response_model=BaseResponse[bool])
async def dismiss_report_endpoint(
    report_id: str,
    current_user: dict = Depends(require_permission("reports", "approve")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Dismiss a report.
    """
    success = await service.dismiss_report(report_id)
    return BaseResponse(data=success, message="Report dismissed successfully")


# User Management (Block, Notes) endpoints
@router.post("/users/{user_id}/block", response_model=BaseResponse[bool])
@router.post("/users/{user_id}/ban", response_model=BaseResponse[bool])
async def block_user(
    user_id: str,
    current_user: dict = Depends(require_permission("users", "edit")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Block a user.
    """
    success = await service.toggle_user_status(user_id, "blocked")
    return BaseResponse(data=success, message="User blocked successfully")


@router.post("/users/{user_id}/unblock", response_model=BaseResponse[bool])
@router.post("/users/{user_id}/unban", response_model=BaseResponse[bool])
async def unblock_user(
    user_id: str,
    current_user: dict = Depends(require_permission("users", "edit")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Unblock a user.
    """
    success = await service.toggle_user_status(user_id, "active")
    return BaseResponse(data=success, message="User unblocked successfully")


@router.post("/users/{user_id}/notes", response_model=BaseResponse[bool])
async def add_user_note(
    user_id: str,
    request: UserNoteRequest,
    current_user: dict = Depends(require_permission("users", "edit")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Add a note to a user.
    """
    success = await service.add_user_note(user_id, request.note)
    return BaseResponse(data=success, message="Note added successfully")


# Subscription Fees endpoints
@router.get("/subscriptions/fees", response_model=BaseResponse[SubscriptionFeesResponse])
async def get_subscription_fees(
    current_user: dict = Depends(require_permission("subscriptions", "view")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get subscription fees.
    """
    data = await service.get_subscription_fees()
    return BaseResponse(data=SubscriptionFeesResponse(**data))


@router.patch("/subscriptions/fees", response_model=BaseResponse[SubscriptionFeesResponse])
@router.put("/subscriptions/fees", response_model=BaseResponse[SubscriptionFeesResponse])
async def update_subscription_fees(
    request: SubscriptionFeesUpdateRequest,
    current_user: dict = Depends(require_permission("subscriptions", "manage")),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Update subscription fees.
    """
    data = await service.update_subscription_fees(request.subscriptionMonthlyPrice, request.subscriptionYearlyPrice)
    return BaseResponse(data=SubscriptionFeesResponse(**data), message="Subscription fees updated")


# Profile put/patch alignment
@router.put("/profile", response_model=BaseResponse[bool])
async def update_admin_profile_put(
    data: ProfileUpdateRequest,
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner", "supervisor", "staff"])),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    PUT method fallback to update admin profile (delegates to PATCH update_profile).
    """
    return await update_profile(data, current_user, service)


# Password change PUT alignment
@router.put("/change-password", response_model=BaseResponse[bool])
async def change_admin_password_put(
    data: ChangePasswordRequest,
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner", "supervisor", "staff"])),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    PUT method fallback for change-password.
    """
    return await change_password(data, current_user, service)


# Logout PUT alignment
@router.put("/logout", response_model=BaseResponse[bool])
async def logout_admin_put(
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner", "supervisor", "staff"])),
):
    """
    PUT method fallback for logout.
    """
    return await logout(current_user)


# Logout all sessions fallback
@router.post("/logout-all", response_model=BaseResponse[bool])
async def logout_all(
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner", "supervisor", "staff"])),
):
    """
    Fallback endpoint to logout all devices.
    """
    return BaseResponse(data=True, message="Logged out from all devices")


# Invoice generation POST alignment
@router.post("/earnings/transactions/{trx_id}/invoice")
async def generate_transaction_invoice_post(
    trx_id: str,
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner", "supervisor", "staff"])),
):
    """
    POST method fallback for generating transaction invoice (delegates to download_invoice).
    """
    return await download_invoice(trx_id, current_user)


# Admin and super_admin Login endpoints
@router.post("/auth/login", response_model=BaseResponse[dict])
@router.post("/login", response_model=BaseResponse[dict])
async def admin_login(
    body: dict = Body(...),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    """
    Authentication endpoint for dashboard users (admins, super_admins, owners, etc.).
    """
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")

    if not email or not password:
        raise AppException(status_code=400, code="INVALID_INPUT", message="Email and password are required.")

    user = await db.users.find_one({"email": email})
    if not user:
        raise AppException(status_code=401, code="INVALID_CREDENTIALS", message="Invalid email or password.")

    stored_password = user.get("hashed_password") or user.get("password_hash")
    if not stored_password or not verify_password(password, stored_password):
        raise AppException(status_code=401, code="INVALID_CREDENTIALS", message="Invalid email or password.")

    # Fetch effective user roles from the RBAC system
    from app.services.dashboard.rbac_service import RBACService
    rbac = RBACService(db)
    role_slugs = await rbac.get_user_role_slugs(str(user["_id"]), user.get("role", "user"))
    allowed_roles = {"super_admin", "admin", "owner", "supervisor", "staff"}
    matching_roles = role_slugs & allowed_roles

    if not matching_roles:
        raise AppException(status_code=403, code="FORBIDDEN", message="You do not have permission to access the dashboard.")

    # Generate JWT token
    access_token = create_access_token(user_id=str(user["_id"]), email=user["email"])
    role = list(matching_roles)[0]

    # Team members inherit owner's subscription — skip onboarding for them
    non_owner_roles = {"super_admin", "admin", "supervisor", "staff"}
    if role in non_owner_roles:
        onboarding_complete = True
    else:
        onboarding_complete = bool(user.get("onboarding_complete", False))

    return BaseResponse(
        data={
            "accessToken": access_token,
            "refreshToken": None,
            "email": email,
            "admin": {
                "id": str(user["_id"]),
                "full_name": user.get("full_name") or user.get("name") or "Admin",
                "email": email,
                "role": role,
                "onboarding_complete": onboarding_complete,
                "subscription_status": user.get("subscription_status", "none"),
            }
        },
        message="Login successful"
    )

@router.get("/owners", response_model=BaseResponse[PaginatedResponse[OwnerListItem]])
async def list_owners(
    limit: int = 10,
    offset: int = 0,
    page: int | None = None,
    search: str | None = None,
    current_user: dict = Depends(require_role(["super_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    if page and page > 0:
        offset = (page - 1) * limit
        
    query_filter = {"role": "owner"}
    if search:
        query_filter["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"original_email": {"$regex": search, "$options": "i"}},
            {"business_name": {"$regex": search, "$options": "i"}}
        ]
        
    total = await db.users.count_documents(query_filter)
    cursor = db.users.find(query_filter).sort("created_at", -1).skip(offset).limit(limit)
    users = await cursor.to_list(length=limit)
    
    items = []
    for user in users:
        owner_id = str(user["_id"])
        
        # Fetch subordinates
        assignments = await db.rbac_user_roles.find({"assigned_by": owner_id}).to_list(None)
        subordinates = []
        if assignments:
            from bson import ObjectId
            user_ids = [ObjectId(a["user_id"]) for a in assignments if ObjectId.is_valid(a["user_id"])]
            string_user_ids = [a["user_id"] for a in assignments if not ObjectId.is_valid(a["user_id"])]
            
            query_conds = []
            if user_ids:
                query_conds.append({"_id": {"$in": user_ids}})
            if string_user_ids:
                query_conds.append({"id": {"$in": string_user_ids}})
                
            if query_conds:
                sub_users = await db.users.find({"$or": query_conds}).to_list(None)
                sub_user_map = {str(u["_id"]): u for u in sub_users}
                for a in assignments:
                    s_u = sub_user_map.get(str(a["user_id"]))
                    if s_u:
                        subordinates.append({
                            "id": str(s_u["_id"]),
                            "full_name": s_u.get("full_name") or "Unknown",
                            "login_email": s_u.get("email", ""),
                            "original_email": s_u.get("original_email", ""),
                            "role": a.get("role_slug", "Unknown"),
                            "status": "active" if s_u.get("is_active", True) else "blocked",
                        })

        items.append(OwnerListItem(
            id=owner_id,
            full_name=user.get("full_name") or "Unknown",
            login_email=user.get("email", ""),
            original_email=user.get("original_email", ""),
            business_name=user.get("business_name"),
            business_address=user.get("business_address"),
            owner_dob=user.get("owner_dob"),
            phone_no=user.get("phone_no"),
            business_type=user.get("business_type"),
            created_at=user.get("created_at"),
            status="active" if user.get("is_active", True) else "blocked",
            plan=user.get("subscription_plan") or "7-Day Trial",
            expiration_date=user.get("subscription_expiration"),
            subordinates=subordinates
        ))
        
    return BaseResponse(data=PaginatedResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset
    ))

@router.post("/owners/create", response_model=BaseResponse)
async def create_owner_account(
    body: OwnerCreateRequest,
    current_user: dict = Depends(require_role(["super_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    creator_id = _current_user_id(current_user)
    creator_role = current_user.get("primary_role") or current_user.get("role") or "admin"

    # Generate login credentials
    from app.services.dashboard.credential_generator import generate_login_email, generate_secure_password
    
    while True:
        generated_login_email = generate_login_email(body.business_name, "owner")
        existing = await db.users.find_one({"email": generated_login_email})
        if not existing:
            break
            
    generated_password = generate_secure_password()
    hashed_pw = hash_password(generated_password)
    
    now = utc_now()
    user_doc = {
        "email": generated_login_email,
        "original_email": body.original_email,
        "password_hash": hashed_pw,
        "full_name": body.full_name,
        "created_by": creator_id,
        "is_subordinate_account": False,
        "business_name": body.business_name,
        "business_address": body.business_address,
        "owner_dob": body.owner_dob,
        "phone_no": body.phone_no,
        "business_type": body.business_type,
        "role": "owner",
        "primary_role": "owner",
        "roles": ["owner"],
        "is_verified": True,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    
    result = await db.users.insert_one(user_doc)
    new_user_id = str(result.inserted_id)

    # Assign role
    from app.repositories.dashboard.rbac_repository import RBACRepository
    repo = RBACRepository(db)
    role_doc = await repo.get_role_by_slug("owner")
    if role_doc:
        await repo.assign_role(
            user_id=new_user_id,
            role_id=str(role_doc["_id"]),
            role_slug="owner",
            assigned_by=creator_id,
            organization_id=None,
        )

    # Send credentials
    from app.services.email_service import EmailService
    await EmailService().send_subordinate_credentials_email(
        email=body.original_email,
        login_email=generated_login_email,
        password=generated_password,
        role="owner"
    )

    # Log action
    from app.services.dashboard.rbac_service import RBACService
    rbac = RBACService(db)
    await rbac.log_action(creator_id, creator_role, "owner.create", "user", new_user_id, {"login_email": generated_login_email}, "")

    return BaseResponse(message="Owner created successfully.")
