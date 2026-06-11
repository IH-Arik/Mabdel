from __future__ import annotations

import base64

from fastapi import APIRouter, Depends, File, Form, Header, Query, Request, Response, UploadFile, WebSocket, WebSocketDisconnect, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import ValidationError

from app.core.realtime import conversation_realtime_hub, inbox_realtime_hub
from app.core.security import decode_token
from app.core.exceptions import AppException
from app.dependencies import get_current_user, get_mongo_database
from app.repositories.auth_repository import AuthRepository
from app.schemas.smartflow import (
    AgreementCreateRequest,
    AgreementGenerateRequest,
    AgreementImproveRequest,
    AgreementRenewRequest,
    AgreementReviewRequest,
    AgreementSendSignatureRequest,
    AgreementSignRequest,
    AgreementUpdateRequest,
    AIWorkflowPrefillRequest,
    AIVoiceOption,
    AIChatRequest,
    ImageGenerationRequest,
    BulkMessageCreateRequest,
    BulkMessageUpdateRequest,
    BulkRecipientValidationRequest,
    BusinessProfileResponse,
    BusinessProfileUpdateRequest,
    CalendarEventCreateRequest,
    CalendarEventShareRequest,
    CalendarEventUpdateRequest,
    CallAISummaryUpdateRequest,
    CallLogCreateRequest,
    CallRecordingUpdateRequest,
    CallTranscriptUpdateRequest,
    CallLogUpdateRequest,
    OutboundCallRequest,
    ChangePasswordRequest,
    ContactCreateRequest,
    ContactUpdateRequest,
    ConversationCreateRequest,
    DocumentCreateRequest,
    DocumentUpdateRequest,
    GroupCreateRequest,
    GroupInviteRequest,
    GroupMemberAddRequest,
    GroupMemberRoleUpdateRequest,
    GroupUpdateRequest,
    ForwardMessageRequest,
    LeaseCreateRequest,
    LeaseEnhanceTermsRequest,
    LeaseGenerateRequest,
    LeaseRenewRequest,
    LeaseReviewRequest,
    LeaseUpdateRequest,
    CurrentSubscriptionResponse,
    MessageCreateRequest,
    MessageUpdateRequest,
    NotificationPreferences,
    NotificationSettingsUpdateRequest,
    ProfileResponse,
    PushTokenRequest,
    ReplyMessageRequest,
    SupportTicketCreateRequest,
    SupportMessageCreateRequest,
    SupportSessionCreateRequest,
    SupportSessionResponse,
    SettingsUpdateRequest,
    SocialIntegrationUpsertRequest,
    TelegramManualConnectRequest,
    WhatsAppManualConnectRequest,
    WhatsAppManualConnectResponse,
    TypingStateRequest,
    UserReportCreateRequest,
    VoiceCommandRequest,
    VoiceCommandResponse,
)
from app.schemas.common import ApiResponse
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/smartflow", tags=["SmartFlow"])


def get_smartflow_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> SmartFlowService:
    return SmartFlowService(db)


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
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    except AppException:
        await websocket.close(code=1008)
    finally:
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


@router.get("/home")
async def get_home_dashboard(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_home_dashboard(current_user)
    return success_response(data=data, message="Home dashboard fetched successfully.")


@router.get("/contacts")
async def list_contacts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_contacts(str(current_user["_id"]), page, page_size, search)
    return success_response(data=data, message="Contacts fetched successfully.")


@router.post("/contacts", status_code=status.HTTP_201_CREATED)
async def create_contact(
    payload: ContactCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_contact(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Contact created successfully.")


@router.get("/contacts/{contact_id}")
async def get_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_contact(str(current_user["_id"]), contact_id)
    return success_response(data=data, message="Contact fetched successfully.")


@router.patch("/contacts/{contact_id}")
async def update_contact(
    contact_id: str,
    payload: ContactUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_contact(str(current_user["_id"]), contact_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Contact updated successfully.")


@router.post("/contacts/{contact_id}/avatar")
async def upload_contact_avatar(
    contact_id: str,
    avatar_file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    file_bytes = await avatar_file.read()
    data = await service.store_contact_avatar(
        str(current_user["_id"]),
        contact_id,
        file_bytes=file_bytes,
        content_type=avatar_file.content_type,
        filename=avatar_file.filename,
    )
    return success_response(data=data, message="Contact image uploaded successfully.")


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_contact(str(current_user["_id"]), contact_id)
    return success_response(data={"deleted": True}, message="Contact deleted successfully.")


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
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    platform_list = [value.strip() for value in (platforms or "").split(",") if value.strip()] or None
    data = await service.list_conversations(str(current_user["_id"]), page, page_size, search, platform, platform_list, archived, unread_only, type_filter)
    return success_response(data=data, message="Conversations fetched successfully.")


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_conversation(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Conversation created successfully.")


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_conversation(str(current_user["_id"]), conversation_id)
    return success_response(data=data, message="Conversation fetched successfully.")


@router.patch("/conversations/{conversation_id}/archive")
async def archive_conversation(
    conversation_id: str,
    archived: bool = True,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.archive_conversation(str(current_user["_id"]), conversation_id, archived)
    return success_response(data=data, message="Conversation updated successfully.")


@router.post("/conversations/{conversation_id}/mark-read")
async def mark_conversation_read(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
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
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_messages(str(current_user["_id"]), conversation_id, page, page_size, search, platform)
    return success_response(data=data, message="Messages fetched successfully.")


@router.post("/messages", status_code=status.HTTP_201_CREATED)
async def create_message(
    payload: MessageCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_message(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Message created successfully.")


@router.patch("/messages/{message_id}")
async def update_message(
    message_id: str,
    payload: MessageUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_message(str(current_user["_id"]), message_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Message updated successfully.")


@router.post("/messages/{message_id}/reply", status_code=status.HTTP_201_CREATED)
async def reply_to_message(
    message_id: str,
    payload: ReplyMessageRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.reply_to_message(str(current_user["_id"]), message_id, payload.model_dump())
    return success_response(data=data, message="Reply created successfully.")


@router.post("/messages/{message_id}/forward", status_code=status.HTTP_201_CREATED)
async def forward_message(
    message_id: str,
    payload: ForwardMessageRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.forward_message(str(current_user["_id"]), message_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Message forwarded successfully.")


@router.get("/messages/unread-summary")
async def unread_summary(
    platform: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_unread_message_summary(str(current_user["_id"]), platform)
    return success_response(data=data, message="Unread summary fetched successfully.")


@router.get("/conversations/{conversation_id}/typing")
async def get_typing_state(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_typing_state(str(current_user["_id"]), conversation_id)
    return success_response(data=data, message="Typing state fetched successfully.")


@router.post("/conversations/{conversation_id}/typing")
async def set_typing_state(
    conversation_id: str,
    payload: TypingStateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.set_typing_state(str(current_user["_id"]), conversation_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Typing state updated successfully.")


@router.post("/ai/chat")
async def ai_chat(
    request: Request,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    try:
        body = await request.json()
        payload = AIChatRequest.model_validate(body)
    except ValidationError as exc:
        raise AppException(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Validation error.",
            details=exc.errors(),
        ) from exc
    data = await service.chat_with_ai(
        str(current_user["_id"]),
        payload.content,
        response_mode=payload.response_mode,
        voice_id=payload.voice_id,
    )
    return success_response(data=data, message="AI response generated successfully.")


@router.post("/ai/generate-image")
async def generate_ai_image(
    payload: ImageGenerationRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.generate_ai_image(str(current_user["_id"]), payload.prompt)
    return success_response(data=data, message="AI Image generated successfully.")


@router.get("/ai/voices")
async def list_ai_voices(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_ai_voices()
    return success_response(data=data, message="AI voices fetched successfully.")


@router.get("/ai/history")
async def list_ai_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    command_type: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: str | None = None,
    date_to: str | None = None,
    replayable_only: bool = False,
    group_by: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_ai_history(
        str(current_user["_id"]),
        page,
        page_size,
        search,
        command_type,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to,
        replayable_only=replayable_only,
        group_by=group_by,
    )
    return success_response(data=data, message="AI command history fetched successfully.")


@router.post("/bulk-messages/recipients/validate")
async def validate_bulk_recipients(
    payload: BulkRecipientValidationRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.validate_bulk_recipients(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Bulk recipients validated successfully.")


@router.get("/bulk-messages")
async def list_bulk_messages(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    channel: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_bulk_messages(str(current_user["_id"]), page, page_size, search, status_filter, channel)
    return success_response(data=data, message="Bulk messages fetched successfully.")


@router.get("/bulk-messages/{bulk_message_id}")
async def get_bulk_message(
    bulk_message_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_bulk_message(str(current_user["_id"]), bulk_message_id)
    return success_response(data=data, message="Bulk message fetched successfully.")


@router.post("/bulk-messages", status_code=status.HTTP_201_CREATED)
async def create_bulk_message(
    payload: BulkMessageCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_bulk_message(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Bulk message created successfully.")


@router.patch("/bulk-messages/{bulk_message_id}")
async def update_bulk_message(
    bulk_message_id: str,
    payload: BulkMessageUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_bulk_message(str(current_user["_id"]), bulk_message_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Bulk message updated successfully.")


@router.post("/bulk-messages/{bulk_message_id}/send")
async def send_bulk_message(
    bulk_message_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.send_bulk_message(str(current_user["_id"]), bulk_message_id)
    return success_response(data=data, message="Bulk message dispatched successfully.")


@router.post("/bulk-messages/{bulk_message_id}/cancel")
async def cancel_bulk_message(
    bulk_message_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.cancel_bulk_message(str(current_user["_id"]), bulk_message_id)
    return success_response(data=data, message="Bulk message cancelled successfully.")


@router.post("/ai/history/{history_id}/replay")
async def replay_ai_history(
    history_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.replay_ai_command(str(current_user["_id"]), history_id)
    return success_response(data=data, message="AI command replayed successfully.")


@router.post("/voice/transcribe", response_model=ApiResponse[VoiceCommandResponse])
async def transcribe_voice(
    payload: VoiceCommandRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Any:
    data = await service.process_voice_command(
        str(current_user["_id"]),
        payload.transcript,
        payload.audio_url,
        audio_base64=payload.audio_base64,
        audio_mime_type=payload.audio_mime_type,
        audio_filename=payload.audio_filename,
        response_mode=payload.response_mode,
        voice_id=payload.voice_id,
    )
    return success_response(data=data, message="Voice command processed successfully.")


@router.post("/ai/voice-chat", response_model=ApiResponse[VoiceCommandResponse])
async def ai_voice_chat(
    payload: VoiceCommandRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Any:
    data = await service.process_voice_command(
        str(current_user["_id"]),
        payload.transcript,
        payload.audio_url,
        audio_base64=payload.audio_base64,
        audio_mime_type=payload.audio_mime_type,
        audio_filename=payload.audio_filename,
        response_mode=payload.response_mode,
        voice_id=payload.voice_id,
    )
    return success_response(data=data, message="AI voice chat processed successfully.")


@router.post("/ai/voice-chat-upload", response_model=ApiResponse[VoiceCommandResponse])
async def ai_voice_chat_upload(
    audio_file: UploadFile = File(...),
    response_mode: str = Form(default="audio"),
    voice_id: str | None = Form(default=None),
    transcript: str | None = Form(default=None),
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Any:
    audio_bytes = await audio_file.read()
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8") if audio_bytes else None
    data = await service.process_voice_command(
        str(current_user["_id"]),
        transcript,
        None,
        audio_base64=audio_base64,
        audio_mime_type=audio_file.content_type or "audio/wav",
        audio_filename=audio_file.filename or "voice.wav",
        response_mode=response_mode,
        voice_id=voice_id,
    )
    return success_response(data=data, message="AI voice chat processed successfully.")


@router.post("/ai/workflow-prefill")
async def ai_workflow_prefill(
    payload: AIWorkflowPrefillRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    try:
        data = await service.process_workflow_prefill(str(current_user["_id"]), payload.model_dump())
        return success_response(data=data, message="AI workflow form prefill generated successfully.")
    except Exception as exc:
        logger.error(f"AI Workflow Prefill Error: {exc}", exc_info=True)
        raise



@router.get("/calendar/events")
async def list_calendar_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    upcoming_only: bool = False,
    date_from: str | None = None,
    date_to: str | None = None,
    contact_id: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_calendar_events(
        str(current_user["_id"]),
        page,
        page_size,
        search,
        upcoming_only,
        date_from=date_from,
        date_to=date_to,
        contact_id=contact_id,
    )
    return success_response(data=data, message="Calendar events fetched successfully.")


@router.get("/calendar/events/{event_id}")
async def get_calendar_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_calendar_event(str(current_user["_id"]), event_id)
    return success_response(data=data, message="Calendar event fetched successfully.")


@router.post("/calendar/events", status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    payload: CalendarEventCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_calendar_event(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Calendar event created successfully.")


@router.patch("/calendar/events/{event_id}")
async def update_calendar_event(
    event_id: str,
    payload: CalendarEventUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_calendar_event(str(current_user["_id"]), event_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Calendar event updated successfully.")


@router.post("/calendar/events/{event_id}/share")
async def share_calendar_event(
    event_id: str,
    payload: CalendarEventShareRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.share_calendar_event(str(current_user["_id"]), event_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Calendar event shared successfully.")


@router.delete("/calendar/events/{event_id}")
async def delete_calendar_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_calendar_event(str(current_user["_id"]), event_id)
    return success_response(data={"deleted": True}, message="Calendar event deleted successfully.")


@router.get("/documents")
async def list_documents(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    doc_type: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_documents(str(current_user["_id"]), page, page_size, search, doc_type)
    return success_response(data=data, message="Documents fetched successfully.")


@router.post("/documents", status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_document(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Document created successfully.")


@router.patch("/documents/{document_id}")
async def update_document(
    document_id: str,
    payload: DocumentUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_document(str(current_user["_id"]), document_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Document updated successfully.")


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_document(str(current_user["_id"]), document_id)
    return success_response(data={"deleted": True}, message="Document deleted successfully.")


@router.get("/leases/metadata")
async def get_lease_metadata(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    return success_response(data=service.lease_metadata(), message="Lease metadata fetched successfully.")


@router.post("/leases/generate")
async def generate_lease_draft(
    payload: LeaseGenerateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.generate_lease_draft(str(current_user["_id"]), payload.model_dump(exclude_none=True))
    return success_response(data=data, message="Lease draft generated successfully.")


@router.post("/leases/enhance-terms")
async def enhance_lease_terms(
    payload: LeaseEnhanceTermsRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.enhance_lease_terms(str(current_user["_id"]), payload.model_dump(exclude_none=True))
    return success_response(data=data, message="Lease terms enhanced successfully.")


@router.post("/leases/review")
async def review_lease_draft(
    payload: LeaseReviewRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.review_lease_draft(str(current_user["_id"]), payload.model_dump(exclude_none=True))
    return success_response(data=data, message="Lease draft reviewed successfully.")


@router.get("/leases/signing/{signature_token}")
async def get_public_signing_lease(
    signature_token: str,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_public_signing_lease(signature_token)
    return success_response(data=data, message="Signing lease fetched successfully.")


@router.post("/leases/signing/{signature_token}")
async def sign_public_lease(
    signature_token: str,
    payload: AgreementSignRequest,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.sign_public_lease(signature_token, payload.model_dump())
    return success_response(data=data, message="Lease signed successfully.")


@router.get("/leases")
async def list_leases(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_leases(str(current_user["_id"]), page, page_size, search, status_filter)
    return success_response(data=data, message="Leases fetched successfully.")


@router.post("/leases", status_code=status.HTTP_201_CREATED)
async def create_lease(
    payload: LeaseCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_lease(str(current_user["_id"]), payload.model_dump(exclude_none=True))
    return success_response(data=data, message="Lease created successfully.")


@router.get("/leases/{lease_id}")
async def get_lease(
    lease_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_lease(str(current_user["_id"]), lease_id)
    return success_response(data=data, message="Lease fetched successfully.")


@router.patch("/leases/{lease_id}")
async def update_lease(
    lease_id: str,
    payload: LeaseUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_lease(str(current_user["_id"]), lease_id, payload.model_dump(exclude_unset=True, exclude_none=True))
    return success_response(data=data, message="Lease updated successfully.")


@router.delete("/leases/{lease_id}")
async def delete_lease(
    lease_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_lease(str(current_user["_id"]), lease_id)
    return success_response(data={"deleted": True, "lease_id": lease_id}, message="Lease deleted successfully.")


@router.post("/leases/{lease_id}/review")
async def review_lease(
    lease_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.review_lease(str(current_user["_id"]), lease_id)
    return success_response(data=data, message="Lease reviewed successfully.")


@router.post("/leases/{lease_id}/enhance-terms")
async def enhance_saved_lease_terms(
    lease_id: str,
    payload: LeaseEnhanceTermsRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.enhance_saved_lease_terms(str(current_user["_id"]), lease_id, payload.model_dump(exclude_none=True))
    return success_response(data=data, message="Lease terms enhanced successfully.")


@router.post("/leases/{lease_id}/send-signature")
async def send_lease_for_signature(
    lease_id: str,
    payload: AgreementSendSignatureRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.send_lease_for_signature(str(current_user["_id"]), lease_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Lease sent for signature successfully.")


@router.post("/leases/{lease_id}/sign")
async def sign_lease(
    lease_id: str,
    payload: AgreementSignRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.sign_lease(str(current_user["_id"]), lease_id, payload.model_dump())
    return success_response(data=data, message="Lease signed successfully.")


@router.post("/leases/{lease_id}/renew")
async def renew_lease(
    lease_id: str,
    payload: LeaseRenewRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.renew_lease(str(current_user["_id"]), lease_id, payload.model_dump(exclude_unset=True, exclude_none=True))
    return success_response(data=data, message="Lease renewed successfully.")


@router.get("/leases/{lease_id}/pdf")
async def download_lease_pdf(
    lease_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Response:
    pdf_bytes = await service.generate_lease_pdf(str(current_user["_id"]), lease_id)
    filename = f"lease-{lease_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/agreements/metadata")
async def get_agreement_metadata(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    return success_response(data=service.agreement_metadata(), message="Agreement metadata fetched successfully.")


@router.get("/agreements/types")
async def get_agreement_types(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    return success_response(data=service.agreement_metadata()["types"], message="Agreement types fetched successfully.")


@router.get("/agreements/priorities")
async def get_agreement_priorities(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    return success_response(data=service.agreement_metadata()["priorities"], message="Agreement priorities fetched successfully.")


@router.post("/agreements/generate")
async def generate_agreement_draft(
    payload: AgreementGenerateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.generate_agreement_draft(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Agreement draft generated successfully.")


@router.post("/agreements/improve")
async def improve_agreement_draft(
    payload: AgreementImproveRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.improve_agreement_draft(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Agreement draft improved successfully.")


@router.post("/agreements/review")
async def review_agreement_draft(
    payload: AgreementReviewRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.review_agreement_draft(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Agreement draft reviewed successfully.")


@router.get("/agreements/signing/{signature_token}")
async def get_public_signing_agreement(
    signature_token: str,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_public_signing_agreement(signature_token)
    return success_response(data=data, message="Signing agreement fetched successfully.")


@router.post("/agreements/signing/{signature_token}")
async def sign_public_agreement(
    signature_token: str,
    payload: AgreementSignRequest,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.sign_public_agreement(signature_token, payload.model_dump())
    return success_response(data=data, message="Agreement signed successfully.")


@router.get("/agreements")
async def list_agreements(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    agreement_type: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_agreements(str(current_user["_id"]), page, page_size, search, status_filter, agreement_type)
    return success_response(data=data, message="Agreements fetched successfully.")


@router.post("/agreements", status_code=status.HTTP_201_CREATED)
async def create_agreement(
    payload: AgreementCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_agreement(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Agreement created successfully.")


@router.get("/agreements/{agreement_id}")
async def get_agreement(
    agreement_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_agreement(str(current_user["_id"]), agreement_id)
    return success_response(data=data, message="Agreement fetched successfully.")


@router.patch("/agreements/{agreement_id}")
async def update_agreement(
    agreement_id: str,
    payload: AgreementUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_agreement(str(current_user["_id"]), agreement_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Agreement updated successfully.")


@router.delete("/agreements/{agreement_id}")
async def delete_agreement(
    agreement_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_agreement(str(current_user["_id"]), agreement_id)
    return success_response(data={"deleted": True, "agreement_id": agreement_id}, message="Agreement deleted successfully.")


@router.post("/agreements/{agreement_id}/improve")
async def improve_agreement(
    agreement_id: str,
    payload: AgreementImproveRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.improve_agreement(str(current_user["_id"]), agreement_id, payload.model_dump())
    return success_response(data=data, message="Agreement improved successfully.")


@router.post("/agreements/{agreement_id}/review")
async def review_agreement(
    agreement_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.review_agreement(str(current_user["_id"]), agreement_id)
    return success_response(data=data, message="Agreement reviewed successfully.")


@router.post("/agreements/{agreement_id}/send-signature")
async def send_agreement_for_signature(
    agreement_id: str,
    payload: AgreementSendSignatureRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.send_agreement_for_signature(str(current_user["_id"]), agreement_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Agreement sent for signature successfully.")


@router.post("/agreements/{agreement_id}/sign")
async def sign_agreement(
    agreement_id: str,
    payload: AgreementSignRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.sign_agreement(str(current_user["_id"]), agreement_id, payload.model_dump())
    return success_response(data=data, message="Agreement signed successfully.")


@router.post("/agreements/{agreement_id}/renew")
async def renew_agreement(
    agreement_id: str,
    payload: AgreementRenewRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.renew_agreement(str(current_user["_id"]), agreement_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Agreement renewed successfully.")


@router.get("/agreements/{agreement_id}/pdf")
async def download_agreement_pdf(
    agreement_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Response:
    pdf_bytes = await service.generate_agreement_pdf(str(current_user["_id"]), agreement_id)
    filename = f"agreement-{agreement_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/calls")
async def list_calls(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = None,
    contact_id: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_call_logs(str(current_user["_id"]), page, page_size, status_filter, search, contact_id)
    return success_response(data=data, message="Call logs fetched successfully.")


@router.post("/calls", status_code=status.HTTP_201_CREATED)
async def create_call_log(
    payload: CallLogCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_call_log(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Call log created successfully.")


@router.post("/calls/outbound", status_code=status.HTTP_201_CREATED)
async def create_outbound_call(
    payload: OutboundCallRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_outbound_call(str(current_user["_id"]), payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Outbound call initiated successfully.")


@router.get("/calls/summary")
async def get_call_summary(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_call_summary(str(current_user["_id"]))
    return success_response(data=data, message="Call analytics fetched successfully.")


@router.get("/calls/{call_id}")
async def get_call_log(
    call_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_call_log(str(current_user["_id"]), call_id)
    return success_response(data=data, message="Call log fetched successfully.")


@router.patch("/calls/{call_id}")
async def update_call_log(
    call_id: str,
    payload: CallLogUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_call_log(str(current_user["_id"]), call_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Call log updated successfully.")


@router.get("/calls/{call_id}/transcript")
async def get_call_transcript(
    call_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_call_transcript(str(current_user["_id"]), call_id)
    return success_response(data=data, message="Call transcript fetched successfully.")


@router.put("/calls/{call_id}/transcript")
async def update_call_transcript(
    call_id: str,
    payload: CallTranscriptUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_call_transcript(str(current_user["_id"]), call_id, payload.model_dump())
    return success_response(data=data, message="Call transcript updated successfully.")


@router.get("/calls/{call_id}/ai-summary")
async def get_call_ai_summary(
    call_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_call_ai_summary(str(current_user["_id"]), call_id)
    return success_response(data=data, message="Call AI summary fetched successfully.")


@router.put("/calls/{call_id}/ai-summary")
async def update_call_ai_summary(
    call_id: str,
    payload: CallAISummaryUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_call_ai_summary(str(current_user["_id"]), call_id, payload.model_dump())
    return success_response(data=data, message="Call AI summary updated successfully.")


@router.post("/calls/{call_id}/callback")
async def request_call_callback(
    call_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.request_call_callback(str(current_user["_id"]), call_id)
    return success_response(data=data, message="Callback requested successfully.")


@router.get("/calls/{call_id}/recording")
async def get_call_recording(
    call_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_call_recording(str(current_user["_id"]), call_id)
    return success_response(data=data, message="Call recording fetched successfully.")


@router.put("/calls/{call_id}/recording")
async def update_call_recording(
    call_id: str,
    payload: CallRecordingUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_call_recording(str(current_user["_id"]), call_id, payload.model_dump())
    return success_response(data=data, message="Call recording updated successfully.")


@router.get("/integrations")
async def list_integrations(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_integrations(str(current_user["_id"]))
    return success_response(data=data, message="Integrations fetched successfully.")


@router.get("/integrations/catalog")
async def list_integration_catalog(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_integration_catalog(str(current_user["_id"]))
    return success_response(data=data, message="Integration catalog fetched successfully.")


@router.get("/integrations/status")
async def get_integration_status(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_integration_status(str(current_user["_id"]))
    return success_response(data=data, message="Integration status fetched successfully.")


@router.post("/integrations", status_code=status.HTTP_201_CREATED)
async def connect_integration(
    payload: SocialIntegrationUpsertRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.upsert_integration(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Integration connected successfully.")


@router.post("/integrations/{platform}/sync")
async def sync_integration(
    platform: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.sync_integration(str(current_user["_id"]), platform)
    return success_response(data=data, message="Integration sync completed.")


@router.post("/integrations/telegram/manual-connect", status_code=status.HTTP_201_CREATED)
async def connect_telegram_manual(
    payload: TelegramManualConnectRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.connect_telegram_manual(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Telegram connected successfully.")


@router.post("/integrations/whatsapp/manual-connect", status_code=status.HTTP_201_CREATED)
async def connect_whatsapp_manual(
    payload: WhatsAppManualConnectRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.connect_whatsapp_manual(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="WhatsApp connected successfully.")



@router.get("/integrations/{platform}/oauth/start")
async def start_integration_oauth(
    platform: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.start_integration_oauth(str(current_user["_id"]), platform)
    return success_response(data=data, message="Integration OAuth started successfully.")


@router.get("/integrations/{platform}/oauth/callback")
async def complete_integration_oauth(
    platform: str,
    code: str,
    state: str,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.complete_integration_oauth(platform, code, state)
    return success_response(data=data, message="Integration OAuth completed successfully.")


@router.delete("/integrations/{platform}")
async def disconnect_integration(
    platform: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.disconnect_integration(str(current_user["_id"]), platform)
    return success_response(data=data, message="Integration disconnected successfully.")


@router.get("/integrations/{platform}/webhook")
async def verify_platform_webhook(
    platform: str,
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    if platform in {"instagram", "facebook_messenger", "whatsapp"}:
        service.validate_meta_webhook_challenge(hub_mode, hub_verify_token)
        return success_response(data={"challenge": hub_challenge}, message="Webhook verified successfully.")
    return success_response(data={"verified": True}, message="Webhook verification not required for this platform.")


@router.post("/integrations/{platform}/webhook")
async def receive_platform_webhook(
    platform: str,
    request: Request,
    user_id: str | None = Query(default=None, min_length=1),
    x_webhook_secret: str | None = Header(default=None, alias="X-Webhook-Secret"),
    x_telegram_bot_api_secret_token: str | None = Header(default=None, alias="X-Telegram-Bot-Api-Secret-Token"),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    raw_payload = await request.json()
    if not isinstance(raw_payload, dict):
        raise AppException(status_code=400, code="WEBHOOK_PAYLOAD_INVALID", message="Webhook payload must be a JSON object.")
    resolved_user_id = user_id or await service.resolve_webhook_user_id(
        platform,
        raw_payload,
        x_telegram_bot_api_secret_token or x_webhook_secret,
    )
    if platform == "telegram":
        await service.validate_platform_webhook_secret(resolved_user_id, platform, x_telegram_bot_api_secret_token or x_webhook_secret)
    else:
        service.validate_webhook_secret(x_webhook_secret)
    data = await service.handle_inbound_webhook(resolved_user_id, platform, raw_payload)
    return success_response(data=data, message="Webhook processed successfully.")


@router.get("/notifications")
async def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_notifications(str(current_user["_id"]), page, page_size, unread_only)
    return success_response(data=data, message="Notifications fetched successfully.")


@router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.mark_all_notifications_read(str(current_user["_id"]))
    return success_response(data=data, message="All notifications marked as read.")


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.mark_notification_read(str(current_user["_id"]), notification_id)
    return success_response(data=data, message="Notification marked as read.")


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.delete_notification(str(current_user["_id"]), notification_id)
    return success_response(data=data, message="Notification deleted successfully.")


@router.post("/notifications/dispatch-pending")
async def dispatch_pending_notifications(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.dispatch_pending_push_notifications(str(current_user["_id"]), limit=limit)
    return success_response(data={"items": data}, message="Pending push notifications dispatched successfully.")


@router.get("/groups")
async def list_groups(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_groups(str(current_user["_id"]), page, page_size, search)
    return success_response(data=data, message="Groups fetched successfully.")


@router.post("/groups", status_code=status.HTTP_201_CREATED)
async def create_group(
    payload: GroupCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_group(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Group created successfully.")


@router.get("/groups/{group_id}")
async def get_group(
    group_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_group(str(current_user["_id"]), group_id)
    return success_response(data=data, message="Group fetched successfully.")


@router.patch("/groups/{group_id}")
async def update_group(
    group_id: str,
    payload: GroupUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_group(str(current_user["_id"]), group_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Group updated successfully.")


@router.post("/groups/{group_id}/members")
async def add_group_members(
    group_id: str,
    payload: GroupMemberAddRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.add_group_members(str(current_user["_id"]), group_id, payload.model_dump())
    return success_response(data=data, message="Group members added successfully.")


@router.patch("/groups/{group_id}/members/{member_id}")
async def update_group_member_role(
    group_id: str,
    member_id: str,
    payload: GroupMemberRoleUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_group_member_role(str(current_user["_id"]), group_id, member_id, payload.role)
    return success_response(data=data, message="Group member updated successfully.")


@router.delete("/groups/{group_id}/members/{member_id}")
async def remove_group_member(
    group_id: str,
    member_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.remove_group_member(str(current_user["_id"]), group_id, member_id)
    return success_response(data=data, message="Group member removed successfully.")


@router.post("/groups/{group_id}/invites")
async def invite_group_member(
    group_id: str,
    payload: GroupInviteRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.invite_group_member(str(current_user["_id"]), group_id, payload.model_dump(exclude_none=True))
    return success_response(data=data, message="Group invite created successfully.")


@router.delete("/groups/{group_id}/invites/{invite_id}")
async def cancel_group_invite(
    group_id: str,
    invite_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.cancel_group_invite(str(current_user["_id"]), group_id, invite_id)
    return success_response(data=data, message="Group invite cancelled successfully.")


@router.post("/groups/{group_id}/leave")
async def leave_group(
    group_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.leave_group(str(current_user["_id"]), group_id)
    return success_response(data=data, message="Group left successfully.")


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_group(str(current_user["_id"]), group_id)
    return success_response(data={"deleted": True}, message="Group deleted successfully.")


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
