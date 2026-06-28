from __future__ import annotations

from fastapi import Depends, Query, WebSocket, WebSocketDisconnect, status

from app.core.realtime import conversation_realtime_hub, inbox_realtime_hub
from app.core.security import decode_token
from app.core.exceptions import AppException
from app.dependencies import get_current_user, get_mongo_database, require_permission, require_subscription
from app.repositories.auth_repository import AuthRepository
from app.schemas.smartflow import (
    ConversationCreateRequest,
    ForwardMessageRequest,
    MessageCreateRequest,
    MessageUpdateRequest,
    ReplyMessageRequest,
    TypingStateRequest,
)
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.websocket("/ws/conversations/{conversation_id}")
async def conversation_stream(websocket: WebSocket, conversation_id: str, token: str) -> None:
    try:
        claims = decode_token(token)
        if claims.get("type") != "access":
            await websocket.close(code=1008)
            return
        db = await get_mongo_database()
        user = await AuthRepository(db).get_user_by_id(claims.get("sub", ""))
        if not user:
            await websocket.close(code=1008)
            return
        service = SmartFlowService(db)
        await service.get_conversation(str(user["_id"]), conversation_id)
        await conversation_realtime_hub.connect(conversation_id, websocket)
        await websocket.send_json({"event": "connected", "conversation_id": conversation_id, "data": {"connected": True}})
        await conversation_realtime_hub.publish(conversation_id, "presence.updated", {
            "user_id": str(user["_id"]),
            "presence": "online",
        })
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    except AppException:
        await websocket.close(code=1008)
    finally:
        if "user" in locals() and user:
            try:
                await conversation_realtime_hub.publish(conversation_id, "presence.updated", {
                    "user_id": str(user["_id"]),
                    "presence": "offline",
                })
            except Exception:
                pass
        await conversation_realtime_hub.disconnect(conversation_id, websocket)


@router.websocket("/ws/inbox")
async def inbox_stream(websocket: WebSocket, token: str) -> None:
    try:
        claims = decode_token(token)
        if claims.get("type") != "access":
            await websocket.close(code=1008)
            return
        db = await get_mongo_database()
        user = await AuthRepository(db).get_user_by_id(claims.get("sub", ""))
        if not user:
            await websocket.close(code=1008)
            return
        user_id = str(user["_id"])
        service = SmartFlowService(db)
        await inbox_realtime_hub.connect(user_id, websocket)
        summary = await service.get_unread_message_summary(user_id, None)
        await websocket.send_json({"event": "connected", "channel": "inbox", "data": {"connected": True, "summary": summary}})
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    except AppException:
        await websocket.close(code=1008)
    finally:
        if 'user_id' in locals():
            await inbox_realtime_hub.disconnect(user_id, websocket)


@router.get("/conversations")
async def list_conversations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    platform: str | None = None,
    platforms: str | None = None,
    archived: bool | None = None,
    unread_only: bool = False,
    type_filter: str | None = Query(default=None, alias="type"),
    current_user: dict = Depends(require_permission("messages", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    platform_list = [value.strip() for value in (platforms or "").split(",") if value.strip()] or None
    data = await service.list_conversations(str(current_user["_id"]), page, page_size, search, platform, platform_list, archived, unread_only, type_filter)
    return success_response(data=data, message="Conversations fetched successfully.")


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreateRequest,
    current_user: dict = Depends(require_permission("messages", "send")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_conversation(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Conversation created successfully.")


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: dict = Depends(require_permission("messages", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_conversation(str(current_user["_id"]), conversation_id)
    return success_response(data=data, message="Conversation fetched successfully.")


@router.patch("/conversations/{conversation_id}/archive")
async def archive_conversation(
    conversation_id: str,
    archived: bool = True,
    current_user: dict = Depends(require_permission("messages", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.archive_conversation(str(current_user["_id"]), conversation_id, archived)
    return success_response(data=data, message="Conversation updated successfully.")


@router.post("/conversations/{conversation_id}/mark-read")
async def mark_conversation_read(
    conversation_id: str,
    current_user: dict = Depends(require_permission("messages", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.mark_conversation_read(str(current_user["_id"]), conversation_id)
    return success_response(data=data, message="Conversation marked as read successfully.")


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    platform: str | None = None,
    current_user: dict = Depends(require_permission("messages", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_messages(str(current_user["_id"]), conversation_id, page, page_size, search, platform)
    return success_response(data=data, message="Messages fetched successfully.")


@router.post("/messages", status_code=status.HTTP_201_CREATED)
async def create_message(
    payload: MessageCreateRequest,
    current_user: dict = Depends(require_permission("messages", "send")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_message(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Message created successfully.")


@router.patch("/messages/{message_id}")
async def update_message(
    message_id: str,
    payload: MessageUpdateRequest,
    current_user: dict = Depends(require_permission("messages", "send")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_message(str(current_user["_id"]), message_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Message updated successfully.")


@router.post("/messages/{message_id}/reply", status_code=status.HTTP_201_CREATED)
async def reply_to_message(
    message_id: str,
    payload: ReplyMessageRequest,
    current_user: dict = Depends(require_permission("messages", "send")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.reply_to_message(str(current_user["_id"]), message_id, payload.model_dump())
    return success_response(data=data, message="Reply created successfully.")


@router.post("/messages/{message_id}/forward", status_code=status.HTTP_201_CREATED)
async def forward_message(
    message_id: str,
    payload: ForwardMessageRequest,
    current_user: dict = Depends(require_permission("messages", "send")),
    _: dict = Depends(require_subscription),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.forward_message(str(current_user["_id"]), message_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Message forwarded successfully.")


@router.get("/messages/unread-summary")
async def unread_summary(
    platform: str | None = None,
    current_user: dict = Depends(require_permission("messages", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_unread_message_summary(str(current_user["_id"]), platform)
    return success_response(data=data, message="Unread summary fetched successfully.")


@router.get("/conversations/{conversation_id}/typing")
async def get_typing_state(
    conversation_id: str,
    current_user: dict = Depends(require_permission("messages", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_typing_state(str(current_user["_id"]), conversation_id)
    return success_response(data=data, message="Typing state fetched successfully.")


@router.post("/conversations/{conversation_id}/typing")
async def set_typing_state(
    conversation_id: str,
    payload: TypingStateRequest,
    current_user: dict = Depends(require_permission("messages", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.set_typing_state(str(current_user["_id"]), conversation_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Typing state updated successfully.")
