from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_current_user, get_mongo_database
from app.core.exceptions import AppException
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

router = APIRouter(prefix="/api", tags=["Compatibility"])


def get_smartflow_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> SmartFlowService:
    return SmartFlowService(db)


@router.get("/inbox")
async def get_inbox(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    platform: str | None = None,
    archived: bool | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    conversations = await service.list_conversations(str(current_user["_id"]), page, page_size, search, platform, None, archived)
    unread = await service.get_unread_message_summary(str(current_user["_id"]), platform)
    return success_response(
        data={
            "items": conversations["items"],
            "pagination": conversations["pagination"],
            "unread": unread,
        },
        message="Inbox fetched successfully.",
    )


@router.get("/contacts")
async def get_contacts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_contacts(str(current_user["_id"]), page, page_size, search)
    return success_response(data=data, message="Contacts fetched successfully.")


@router.get("/calendar/events")
async def get_calendar_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    upcoming_only: bool = False,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_calendar_events(str(current_user["_id"]), page, page_size, search, upcoming_only)
    return success_response(data=data, message="Calendar events fetched successfully.")


@router.post("/calendar/connect")
async def connect_calendar(
    payload: dict[str, Any] = Body(default_factory=dict),
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    if payload.get("access_token"):
        integration = await service.upsert_integration(
            str(current_user["_id"]),
            {
                "platform": "google_business",
                "access_token": payload["access_token"],
                "refresh_token": payload.get("refresh_token"),
                "external_account_id": payload.get("calendar_email") or current_user.get("email"),
            },
        )
        return success_response(
            data={
                "connected": True,
                "provider": "google_calendar",
                "integration": integration,
            },
            message="Calendar connected successfully.",
        )

    oauth = await service.start_integration_oauth(str(current_user["_id"]), "google_business")
    return success_response(
        data={
            "connected": False,
            "provider": "google_calendar",
            "auth_url": oauth["auth_url"],
            "state": oauth["state"],
            "expires_at": oauth["expires_at"],
        },
        message="Calendar OAuth started successfully.",
    )


@router.get("/integrations")
async def get_integrations(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_integrations(str(current_user["_id"]))
    return success_response(data={"items": data}, message="Integrations fetched successfully.")


@router.post("/integrations/connect")
async def connect_integration(
    payload: dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    platform = str(payload.get("platform") or "").strip()
    if not platform:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="platform is required.",
            details={"field": "platform"},
        )

    if not payload.get("access_token"):
        oauth = await service.start_integration_oauth(str(current_user["_id"]), platform)
        return success_response(
            data={
                "connected": False,
                "platform": platform,
                "auth_url": oauth["auth_url"],
                "state": oauth["state"],
                "expires_at": oauth["expires_at"],
            },
            message="Integration OAuth started successfully.",
        )
    data = await service.upsert_integration(
        str(current_user["_id"]),
        {
            "platform": platform,
            "access_token": payload["access_token"],
            "refresh_token": payload.get("refresh_token"),
            "external_account_id": payload.get("external_account_id"),
        },
    )
    return success_response(data=data, message="Integration connected successfully.")


@router.get("/ai-call-analytics")
async def get_ai_call_analytics(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_call_summary(str(current_user["_id"]))
    return success_response(data=data, message="AI call analytics fetched successfully.")


@router.get("/documents/types")
async def get_document_types(current_user: dict = Depends(get_current_user)) -> dict:
    document_types = [
        {
            "key": "agreement",
            "label": "Agreement",
            "description": "Contracts, MOUs, and formal business agreements.",
            "display_order": 1,
        },
        {
            "key": "invoice",
            "label": "Invoice",
            "description": "Billing records, payment requests, and receivables documents.",
            "display_order": 2,
        },
        {
            "key": "lease",
            "label": "Lease",
            "description": "Lease contracts, rental terms, and occupancy paperwork.",
            "display_order": 3,
        },
        {
            "key": "others",
            "label": "Others",
            "description": "Supporting files that do not fit the primary document categories.",
            "display_order": 4,
        },
    ]

    return success_response(
        data={
            "items": document_types,
            "user_id": str(current_user["_id"]),
        },
        message="Document types fetched successfully.",
    )


@router.post("/calls/{callId}/callback")
async def request_call_callback(
    callId: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_call_log(
        str(current_user["_id"]),
        callId,
        {
            "callback_requested": True,
            "status": "callback",
        },
    )
    return success_response(data=data, message="Callback requested successfully.")
