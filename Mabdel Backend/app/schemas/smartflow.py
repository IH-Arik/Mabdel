from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.pagination import PaginatedPayload

PlatformType = Literal[
    "whatsapp",
    "facebook_messenger",
    "instagram",
    "linkedin",
    "twitter_x",
    "snapchat",
    "telegram",
    "sms",
    "email",
    "google_business",
    "ai",
]
MessageDirection = Literal["inbound", "outbound"]
MessageStatus = Literal["sent", "delivered", "read"]
ConversationType = Literal["direct", "group", "ai"]
BulkMessageChannel = Literal["email", "sms"]
BulkMessageStatus = Literal["draft", "scheduled", "processing", "sent", "partial_failed", "failed", "cancelled"]
BulkRecipientStatus = Literal["queued", "sent", "failed", "skipped"]
AIResponseState = Literal["thinking", "processing", "responded"]
VoiceState = Literal["listening", "processing", "responded"]
AIResponseMode = Literal["text", "audio", "both"]
CommandType = Literal["invoice", "voice", "email", "report", "message", "agreement", "lease", "calendar", "bulk_message", "legal", "document"]
CommandStatus = Literal["completed", "archived", "exported", "delivered", "scheduled", "processing", "failed"]
AIWorkflowIntent = Literal["invoice", "bulk_message", "calendar", "lease", "agreement", "contact", "email", "group", "call", "unknown"]
DocumentType = Literal["agreement", "invoice", "lease", "others"]
AgreementType = Literal["contract", "lease", "legal", "vendor", "service", "nda", "other"]
AgreementPriority = Literal["standard", "high", "urgent"]
AgreementStatus = Literal["draft", "pending_signature", "signed", "expired", "cancelled"]
AgreementDeliveryChannel = Literal["email", "link", "manual"]
AgreementSignatureProvider = Literal["native", "docusign"]
AgreementSmartFieldType = Literal["signature", "date", "text", "checkbox"]
LeasePropertyType = Literal["apartment", "house", "office_space", "shop", "warehouse", "land", "other"]
LeaseStatus = Literal["draft", "active", "pending_signature", "expired", "cancelled"]
CallType = Literal["scheduled", "missed", "completed", "outbound", "incoming", "incoming_automated"]
CallStatus = Literal["queued", "initiated", "ringing", "in_progress", "ai_ready", "callback", "missed", "completed", "busy", "no_answer", "failed", "canceled"]
IntegrationStatus = Literal["connected", "disconnected"]
NotificationType = Literal[
    "message",
    "missed_call",
    "scheduled_call",
    "ai_task",
    "calendar",
    "ai_insight",
    "daily_digest",
    "system_update",
]
MeetingMode = Literal["offline", "online"]
MeetingStatus = Literal["scheduled", "cancelled", "completed"]


class PlatformIdentity(BaseModel):
    platform: PlatformType
    external_id: str = Field(min_length=1, max_length=255)
    handle: str | None = None


class ContactCreateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    avatar_url: str | None = Field(default=None, max_length=1000)
    company: str | None = Field(default=None, max_length=160)
    job_title: str | None = Field(default=None, max_length=160)
    address: str | None = Field(default=None, max_length=300)
    date_of_birth: date | None = None
    notes: str | None = Field(default=None, max_length=3000)
    presence: str | None = Field(default=None, max_length=40)
    identities: list[PlatformIdentity] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_contact_name(self) -> "ContactCreateRequest":
        name = (self.name or "").strip()
        first_name = (self.first_name or "").strip()
        last_name = (self.last_name or "").strip()
        if not name and not first_name:
            raise ValueError("name or first_name is required.")
        if not name:
            self.name = " ".join(part for part in [first_name, last_name] if part).strip()
        if not self.first_name and self.name:
            parts = self.name.split(" ", 1)
            self.first_name = parts[0]
            self.last_name = parts[1] if len(parts) > 1 else self.last_name
        return self


class ContactUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    avatar_url: str | None = Field(default=None, max_length=1000)
    company: str | None = Field(default=None, max_length=160)
    job_title: str | None = Field(default=None, max_length=160)
    address: str | None = Field(default=None, max_length=300)
    date_of_birth: date | None = None
    notes: str | None = Field(default=None, max_length=3000)
    identities: list[PlatformIdentity] | None = None
    presence: str | None = Field(default=None, max_length=40)


class ContactImportEntry(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=300)
    notes: str | None = Field(default=None, max_length=3000)
    company: str | None = Field(default=None, max_length=160)
    job_title: str | None = Field(default=None, max_length=160)


class ContactImportRequest(BaseModel):
    contacts: list[ContactImportEntry] = Field(default_factory=list, max_length=500)


class ContactResponse(BaseModel):
    id: str
    name: str
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    avatar_url: str | None = None
    company: str | None = None
    job_title: str | None = None
    address: str | None = None
    date_of_birth: date | None = None
    notes: str | None = None
    identities: list[PlatformIdentity] = Field(default_factory=list)
    presence: str = "offline"
    presence_label: str = "Offline"
    is_online: bool = False
    initials: str = "NA"
    primary_detail: str | None = None
    created_at: datetime
    updated_at: datetime


class ConversationCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    contact_id: str | None = None
    member_ids: list[str] = Field(default_factory=list)
    type: ConversationType = "direct"
    platform: PlatformType = "whatsapp"


class ConversationResponse(BaseModel):
    id: str
    title: str | None = None
    type: ConversationType
    platform: PlatformType
    platform_label: str = "WhatsApp"
    platform_icon_key: str = "whatsapp"
    platform_badge_color: str = "#25D366"
    member_ids: list[str] = Field(default_factory=list)
    archived: bool = False
    avatar_url: str | None = None
    presence: str = "offline"
    presence_label: str = "Offline"
    is_ai_assistant: bool = False
    is_group: bool = False
    contact_name: str | None = None
    participant_preview: list[str] = Field(default_factory=list)
    member_count: int = 0
    last_message_preview: str | None = None
    last_message_sender_name: str | None = None
    unread_count: int = 0
    has_unread: bool = False
    delivery_state: str | None = None
    display_time_label: str | None = None
    updated_at: datetime


class MessageAttachment(BaseModel):
    type: Literal["image", "document", "audio", "video", "file"] = "file"
    url: str = Field(min_length=5, max_length=1000)
    file_name: str | None = Field(default=None, max_length=255)
    mime_type: str | None = Field(default=None, max_length=120)
    file_size_bytes: int | None = Field(default=None, ge=0)
    thumbnail_url: str | None = Field(default=None, max_length=1000)


class MessageMentionRef(BaseModel):
    contact_id: str = Field(min_length=1)
    name: str | None = Field(default=None, max_length=120)


class MessageCreateRequest(BaseModel):
    conversation_id: str
    contact_id: str | None = None
    platform: PlatformType
    direction: MessageDirection
    content: str | None = None
    media_url: str | None = None
    attachments: list[MessageAttachment] = Field(default_factory=list)
    mentions: list[str] = Field(default_factory=list)
    reply_to_message_id: str | None = None
    forward_from_message_id: str | None = None

    @model_validator(mode="after")
    def validate_message_body(self) -> "MessageCreateRequest":
        text = (self.content or "").strip()
        if not text and not self.media_url and not self.attachments:
            raise ValueError("Message content, media_url, or attachments are required.")
        self.content = text
        return self


class MessageUpdateRequest(BaseModel):
    status: MessageStatus | None = None
    is_archived: bool | None = None
    unread_count: int | None = Field(default=None, ge=0)


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    contact_id: str | None = None
    platform: PlatformType
    direction: MessageDirection
    content: str
    media_url: str | None = None
    attachments: list[MessageAttachment] = Field(default_factory=list)
    attachment_count: int = 0
    has_attachments: bool = False
    mentions: list[MessageMentionRef] = Field(default_factory=list)
    status: MessageStatus
    timestamp: datetime
    unread_count: int = 0
    is_archived: bool = False
    read_at: datetime | None = None
    delivered_at: datetime | None = None
    is_read: bool = False
    read_receipt_label: str | None = None
    status_timestamps: dict[str, datetime | None] = Field(default_factory=dict)
    reply_to_message_id: str | None = None
    forward_from_message_id: str | None = None
    reply_to_message_preview: dict[str, Any] | None = None
    forward_from_message_preview: dict[str, Any] | None = None
    sender_name: str | None = None
    sender_avatar_url: str | None = None
    sender_presence: str | None = None
    sender_is_self: bool = False


class BulkMessageRecipientRef(BaseModel):
    id: str | None = None
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    avatar_url: str | None = None
    initials: str | None = None
    source: Literal["contact", "group_member", "raw_email", "raw_phone"]


class BulkMessageAttachment(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    url: str = Field(min_length=5, max_length=1000)


class BulkRecipientValidationRequest(BaseModel):
    channel: BulkMessageChannel = "email"
    recipient_emails: list[str] = Field(default_factory=list)
    contact_ids: list[str] = Field(default_factory=list)
    group_ids: list[str] = Field(default_factory=list)


class BulkRecipientValidationResponse(BaseModel):
    channel: BulkMessageChannel
    valid_count: int = 0
    invalid_count: int = 0
    duplicate_count: int = 0
    recipients: list[BulkMessageRecipientRef] = Field(default_factory=list)
    invalid_entries: list[str] = Field(default_factory=list)
    duplicate_entries: list[str] = Field(default_factory=list)
    unavailable_contact_ids: list[str] = Field(default_factory=list)
    unavailable_group_ids: list[str] = Field(default_factory=list)


class BulkMessageImproveRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class BulkMessageCreateRequest(BaseModel):
    channel: BulkMessageChannel = "email"
    recipient_emails: list[str] = Field(default_factory=list)
    contact_ids: list[str] = Field(default_factory=list)
    group_ids: list[str] = Field(default_factory=list)
    subject: str | None = Field(default=None, min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=5000)
    attachments: list[BulkMessageAttachment] = Field(default_factory=list)
    scheduled_at: datetime | None = None
    timezone: str = Field(default="UTC", max_length=64)
    send_now: bool = True
    ai_transcript: str | None = None


class BulkMessageUpdateRequest(BaseModel):
    recipient_emails: list[str] | None = None
    contact_ids: list[str] | None = None
    group_ids: list[str] | None = None
    subject: str | None = Field(default=None, max_length=200)
    content: str | None = Field(default=None, min_length=1, max_length=5000)
    attachments: list[BulkMessageAttachment] | None = None
    scheduled_at: datetime | None = None
    timezone: str | None = Field(default=None, max_length=64)
    send_now: bool | None = None
    ai_transcript: str | None = None


class BulkMessageRecipientDelivery(BaseModel):
    target: str
    contact_id: str | None = None
    name: str | None = None
    status: BulkRecipientStatus
    error: str | None = None
    sent_at: datetime | None = None


class BulkMessageResponse(BaseModel):
    id: str
    channel: BulkMessageChannel
    status: BulkMessageStatus
    subject: str | None = None
    content: str
    attachments: list[BulkMessageAttachment] = Field(default_factory=list)
    recipient_emails: list[str] = Field(default_factory=list)
    contact_ids: list[str] = Field(default_factory=list)
    group_ids: list[str] = Field(default_factory=list)
    recipients: list[BulkMessageRecipientRef] = Field(default_factory=list)
    deliveries: list[BulkMessageRecipientDelivery] = Field(default_factory=list)
    scheduled_at: datetime | None = None
    timezone: str = "UTC"
    ai_transcript: str | None = None
    character_count: int = 0
    segment_count: int = 0
    sent_count: int = 0
    failed_count: int = 0
    created_at: datetime
    updated_at: datetime
    sent_at: datetime | None = None


class AIChatRequest(BaseModel):
    content: str = Field(min_length=1)
    response_mode: AIResponseMode = "text"
    voice_id: str | None = None

    @model_validator(mode="before")
    @classmethod
    def accept_legacy_message_fields(cls, data: Any) -> Any:
        if isinstance(data, dict) and not data.get("content"):
            data = {**data, "content": data.get("transcript") or data.get("prompt") or ""}
        return data


class AIVoiceOption(BaseModel):
    id: str
    label: str
    gender: Literal["male", "female", "neutral"]
    style: str
    provider_voice: str


class AIChatResponse(BaseModel):
    conversation_id: str
    state: AIResponseState
    user_message: MessageResponse
    ai_message: MessageResponse
    workflow: dict[str, Any] | None = None
    navigation: dict[str, Any] | None = None
    audio: dict[str, Any] | None = None


class ImageGenerationRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)


class ImageGenerationResponse(BaseModel):
    image_url: str


class VoiceCommandRequest(BaseModel):
    transcript: str | None = None
    audio_url: str | None = None
    audio_base64: str | None = None
    audio_mime_type: str = "audio/wav"
    audio_filename: str = "voice.wav"
    response_mode: AIResponseMode = "both"
    voice_id: str | None = None


class VoiceCommandResponse(BaseModel):
    state: VoiceState
    transcript: str
    ai_response: str
    history_id: str
    workflow: dict[str, Any] | None = None
    navigation: dict[str, Any] | None = None
    audio: dict[str, Any] | None = None


class AIWorkflowPrefillRequest(VoiceCommandRequest):
    workflow_intent: AIWorkflowIntent | None = None
    current_values: dict[str, Any] = Field(default_factory=dict)


class AIWorkflowPrefillResponse(BaseModel):
    state: VoiceState
    transcript: str
    workflow: dict[str, Any]
    navigation: dict[str, Any]
    prefill: dict[str, Any]
    missing_fields: list[str] = Field(default_factory=list)
    ready_to_create: bool = False
    create_endpoint: str
    create_method: Literal["POST"] = "POST"
    submit_label: str
    next_action: Literal["review_form", "create"] = "review_form"


class ReplyMessageRequest(BaseModel):
    content: str | None = None
    platform: PlatformType
    contact_id: str | None = None
    media_url: str | None = None
    attachments: list[MessageAttachment] = Field(default_factory=list)
    mentions: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_message_body(self) -> "ReplyMessageRequest":
        text = (self.content or "").strip()
        if not text and not self.media_url and not self.attachments:
            raise ValueError("Reply content, media_url, or attachments are required.")
        self.content = text
        return self


class ForwardMessageRequest(BaseModel):
    conversation_id: str
    platform: PlatformType
    contact_id: str | None = None
    content: str | None = Field(default=None, min_length=1)
    media_url: str | None = None
    attachments: list[MessageAttachment] | None = None
    mentions: list[str] | None = None


class TypingStateRequest(BaseModel):
    is_typing: bool = True
    actor_name: str | None = Field(default=None, max_length=120)
    actor_type: Literal["user", "ai", "contact"] = "ai"
    preview_text: str | None = Field(default=None, max_length=280)
    state_label: str | None = Field(default=None, max_length=80)


class TypingStateResponse(BaseModel):
    conversation_id: str
    is_typing: bool
    actor_name: str | None = None
    actor_type: Literal["user", "ai", "contact"] = "ai"
    preview_text: str | None = None
    state_label: str | None = None
    updated_at: datetime | None = None
    expires_at: datetime | None = None


class AICommandHistoryItem(BaseModel):
    id: str
    user_id: str
    command_text: str
    command_type: CommandType
    status: CommandStatus
    timestamp: datetime
    is_replayable: bool = True
    command_type_label: str
    status_label: str
    icon: str
    accent_tone: str
    date_bucket: Literal["today", "yesterday", "older"]
    related_resource: dict[str, Any] | None = None
    preview_payload: dict[str, Any] | None = None


class CalendarEventCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: str | None = None
    starts_at: datetime
    ends_at: datetime
    contact_ids: list[str] = Field(default_factory=list)
    meeting_mode: MeetingMode = "offline"
    location: str | None = Field(default=None, max_length=200)
    meeting_link: str | None = Field(default=None, max_length=500)
    notify_via_push: bool = True
    notify_via_email: bool = False
    notify_via_sms: bool = False
    timezone: str = Field(default="UTC", max_length=64)
    reminder_minutes: int = Field(default=15, ge=0, le=10080)
    google_event_id: str | None = None
    status: MeetingStatus = "scheduled"


class CalendarEventUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    contact_ids: list[str] | None = None
    meeting_mode: MeetingMode | None = None
    location: str | None = Field(default=None, max_length=200)
    meeting_link: str | None = Field(default=None, max_length=500)
    notify_via_push: bool | None = None
    notify_via_email: bool | None = None
    notify_via_sms: bool | None = None
    timezone: str | None = Field(default=None, max_length=64)
    reminder_minutes: int | None = Field(default=None, ge=0, le=10080)
    google_event_id: str | None = None
    status: MeetingStatus | None = None


class CalendarAttendeeResponse(BaseModel):
    id: str
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    avatar_url: str | None = None
    initials: str


class CalendarEventResponse(BaseModel):
    id: str
    title: str
    description: str | None = None
    starts_at: datetime
    ends_at: datetime
    contact_ids: list[str] = Field(default_factory=list)
    attendees: list[CalendarAttendeeResponse] = Field(default_factory=list)
    attendee_count: int = 0
    meeting_mode: MeetingMode = "offline"
    location: str | None = None
    meeting_link: str | None = None
    notify_via_push: bool = True
    notify_via_email: bool = False
    notify_via_sms: bool = False
    timezone: str = "UTC"
    reminder_minutes: int
    google_event_id: str | None = None
    sync_status: str = "local"
    status: MeetingStatus = "scheduled"
    share_url: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CalendarEventShareRequest(BaseModel):
    channel: Literal["email", "link", "manual"] = "link"
    recipient_email: EmailStr | None = None
    message: str | None = Field(default=None, max_length=1000)


class CalendarEventShareResponse(BaseModel):
    event_id: str
    channel: Literal["email", "link", "manual"]
    recipient_email: EmailStr | None = None
    share_url: str | None = None


class DocumentCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    type: DocumentType = "others"
    file_url: str = Field(min_length=5)
    contact_id: str | None = None
    conversation_id: str | None = None


class DocumentUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    type: DocumentType | None = None
    file_url: str | None = Field(default=None, min_length=5)
    contact_id: str | None = None
    conversation_id: str | None = None


class DocumentResponse(BaseModel):
    id: str
    name: str
    type: DocumentType
    file_url: str
    preview_url: str
    contact_id: str | None = None
    conversation_id: str | None = None
    created_at: datetime


class AgreementSmartField(BaseModel):
    key: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=120)
    field_type: AgreementSmartFieldType
    required: bool = True
    enabled: bool = True
    page: int = Field(default=1, ge=1)
    anchor_text: str | None = Field(default=None, max_length=160)


class AgreementReviewFinding(BaseModel):
    key: str
    title: str
    message: str
    severity: Literal["success", "warning", "error"]
    passed: bool


class AgreementGenerateRequest(BaseModel):
    prompt: str = Field(min_length=10, max_length=3000)
    title: str | None = Field(default=None, min_length=2, max_length=200)
    client_name: str | None = Field(default=None, min_length=2, max_length=120)
    agreement_type: AgreementType = "contract"
    priority: AgreementPriority = "standard"
    start_date: date | None = None
    end_date: date | None = None
    smart_fields: list[AgreementSmartField] = Field(default_factory=list)


class AgreementCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    client_name: str = Field(min_length=2, max_length=120)
    client_email: EmailStr | None = None
    client_phone: str | None = Field(default=None, max_length=40)
    agreement_type: AgreementType = "contract"
    priority: AgreementPriority = "standard"
    start_date: date | None = None
    end_date: date | None = None
    content: str = Field(min_length=20, max_length=50000)
    status: AgreementStatus = "draft"
    smart_fields: list[AgreementSmartField] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_dates(self) -> "AgreementCreateRequest":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be after start_date.")
        return self


class AgreementUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    client_name: str | None = Field(default=None, min_length=2, max_length=120)
    client_email: EmailStr | None = None
    client_phone: str | None = Field(default=None, max_length=40)
    agreement_type: AgreementType | None = None
    priority: AgreementPriority | None = None
    start_date: date | None = None
    end_date: date | None = None
    content: str | None = Field(default=None, min_length=20, max_length=50000)
    status: AgreementStatus | None = None
    smart_fields: list[AgreementSmartField] | None = None
    metadata: dict[str, Any] | None = None


class AgreementImproveRequest(BaseModel):
    content: str = Field(min_length=20, max_length=50000)
    instruction: str | None = Field(default=None, max_length=1000)


class AgreementReviewRequest(BaseModel):
    content: str = Field(min_length=20, max_length=50000)
    agreement_type: AgreementType = "contract"


class AgreementSendSignatureRequest(BaseModel):
    recipient_name: str | None = Field(default=None, min_length=2, max_length=120)
    recipient_email: EmailStr | None = None
    channel: AgreementDeliveryChannel = "link"
    message: str | None = Field(default=None, max_length=1000)
    provider: AgreementSignatureProvider = "native"
    signing_order: int | None = Field(default=1, ge=1, le=99)
    return_url: str | None = Field(default=None, max_length=1000)
    embedded_signing: bool = False
    signer_name: str | None = Field(default=None, min_length=2, max_length=120)
    signer_email: EmailStr | None = None
    signers: list[dict[str, Any]] = Field(default_factory=list)


class AgreementSignRequest(BaseModel):
    signer_name: str = Field(min_length=2, max_length=120)
    signer_email: EmailStr | None = None
    signature_text: str | None = Field(default=None, min_length=1, max_length=300)
    signature_url: str | None = Field(default=None, min_length=5, max_length=1000)

    @model_validator(mode="after")
    def validate_signature(self) -> "AgreementSignRequest":
        if not self.signature_text and not self.signature_url:
            raise ValueError("signature_text or signature_url is required.")
        return self


class AgreementRenewRequest(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    reset_signature: bool = True


class LeaseSignatureFields(BaseModel):
    tenant_signature: bool = True
    landlord_signature: bool = True


class LeaseBasePayload(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    prompt: str | None = Field(default=None, min_length=3, max_length=3000)
    property_address: str | None = Field(default=None, min_length=2, max_length=300)
    property_type: LeasePropertyType = "apartment"
    landlord_name: str | None = Field(default=None, min_length=2, max_length=120)
    tenant_name: str | None = Field(default=None, min_length=2, max_length=120)
    tenant_email: EmailStr | None = None
    tenant_phone: str | None = Field(default=None, max_length=40)
    monthly_rent_cents: int | None = Field(default=None, ge=0)
    monthly_rent: float | None = Field(default=None, ge=0)
    security_deposit_cents: int | None = Field(default=None, ge=0)
    security_deposit: float | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    rent_due_day: int = Field(default=1, ge=1, le=31)
    start_date: date | None = None
    end_date: date | None = None
    custom_terms: str | None = Field(default=None, max_length=12000)
    signature_fields: LeaseSignatureFields = Field(default_factory=LeaseSignatureFields)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("currency")
    @classmethod
    def normalize_currency_code(cls, value: str) -> str:
        return value.strip().upper()

    @model_validator(mode="after")
    def validate_lease_dates(self) -> "LeaseBasePayload":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be after start_date.")
        return self


class LeaseGenerateRequest(LeaseBasePayload):
    prompt: str = Field(min_length=3, max_length=3000)


class LeaseCreateRequest(LeaseBasePayload):
    content: str | None = Field(default=None, min_length=20, max_length=50000)
    status: LeaseStatus = "draft"


class LeaseUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    property_address: str | None = Field(default=None, min_length=2, max_length=300)
    property_type: LeasePropertyType | None = None
    landlord_name: str | None = Field(default=None, min_length=2, max_length=120)
    tenant_name: str | None = Field(default=None, min_length=2, max_length=120)
    tenant_email: EmailStr | None = None
    tenant_phone: str | None = Field(default=None, max_length=40)
    monthly_rent_cents: int | None = Field(default=None, ge=0)
    monthly_rent: float | None = Field(default=None, ge=0)
    security_deposit_cents: int | None = Field(default=None, ge=0)
    security_deposit: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    rent_due_day: int | None = Field(default=None, ge=1, le=31)
    start_date: date | None = None
    end_date: date | None = None
    custom_terms: str | None = Field(default=None, max_length=12000)
    signature_fields: LeaseSignatureFields | None = None
    content: str | None = Field(default=None, min_length=20, max_length=50000)
    status: LeaseStatus | None = None
    metadata: dict[str, Any] | None = None
    regenerate_content: bool = False

    @field_validator("currency")
    @classmethod
    def normalize_currency_code(cls, value: str | None) -> str | None:
        return value.strip().upper() if value is not None else None

    @model_validator(mode="after")
    def validate_lease_dates(self) -> "LeaseUpdateRequest":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be after start_date.")
        return self


class LeaseReviewRequest(BaseModel):
    content: str = Field(min_length=20, max_length=50000)
    property_address: str | None = Field(default=None, max_length=300)
    landlord_name: str | None = Field(default=None, max_length=120)
    tenant_name: str | None = Field(default=None, max_length=120)
    monthly_rent_cents: int | None = Field(default=None, ge=0)
    monthly_rent: float | None = Field(default=None, ge=0)
    security_deposit_cents: int | None = Field(default=None, ge=0)
    security_deposit: float | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    rent_due_day: int | None = Field(default=None, ge=1, le=31)
    start_date: date | None = None
    end_date: date | None = None
    custom_terms: str | None = Field(default=None, max_length=12000)
    signature_fields: LeaseSignatureFields = Field(default_factory=LeaseSignatureFields)


class LeaseEnhanceTermsRequest(BaseModel):
    custom_terms: str | None = Field(default=None, max_length=12000)
    content: str | None = Field(default=None, min_length=20, max_length=50000)
    focus: Literal["balanced", "tenant", "landlord", "compliance"] = "balanced"


class LeaseRenewRequest(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    monthly_rent_cents: int | None = Field(default=None, ge=0)
    monthly_rent: float | None = Field(default=None, ge=0)
    reset_signature: bool = True


class AgreementDraftResponse(BaseModel):
    title: str
    client_name: str
    agreement_type: AgreementType
    priority: AgreementPriority
    content: str
    smart_fields: list[AgreementSmartField]
    ai_review: list[AgreementReviewFinding]


class AgreementSignatureRequestResponse(BaseModel):
    agreement_id: str
    status: AgreementStatus
    channel: AgreementDeliveryChannel
    recipient_name: str | None = None
    recipient_email: EmailStr | None = None
    signature_request_url: str
    expires_at: datetime | None = None


class AgreementResponse(BaseModel):
    id: str
    agreement_number: str
    title: str
    client_name: str
    client_email: EmailStr | None = None
    client_phone: str | None = None
    agreement_type: AgreementType
    agreement_type_label: str
    priority: AgreementPriority
    status: AgreementStatus
    status_label: str
    status_tone: str
    content: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    smart_fields: list[AgreementSmartField] = Field(default_factory=list)
    ai_review: list[AgreementReviewFinding] = Field(default_factory=list)
    signature_provider: AgreementSignatureProvider | None = None
    provider_status: str | None = None
    provider_envelope_id: str | None = None
    provider_error: str | None = None
    provider_signing_url: str | None = None
    signed_pdf_url: str | None = None
    completion_certificate_url: str | None = None
    signature_request_url: str | None = None
    pdf_url: str
    actions: list[str] = Field(default_factory=list)
    sent_at: datetime | None = None
    signed_at: datetime | None = None
    expired_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AgreementProviderStatusResponse(BaseModel):
    provider: AgreementSignatureProvider
    connected: bool = False
    connection_status: Literal["connected", "disconnected", "needs_reauth", "misconfigured", "error"] = "disconnected"
    account_id: str | None = None
    account_name: str | None = None
    base_uri: str | None = None
    auth_url: str | None = None
    last_error: str | None = None
    connected_at: datetime | None = None


class AgreementSummaryResponse(BaseModel):
    total_agreements: int
    draft_agreements: int
    pending_signature_agreements: int
    signed_agreements: int
    expired_agreements: int
    cancelled_agreements: int


class CallLogCreateRequest(BaseModel):
    contact_id: str | None = None
    contact_name: str | None = Field(default=None, max_length=120)
    call_type: CallType
    phone_number: str | None = Field(default=None, max_length=40)
    scheduled_at: datetime | None = None
    duration: int = Field(default=0, ge=0)
    ai_ready: bool = False
    callback_requested: bool = False
    recording_url: str | None = Field(default=None, max_length=1000)
    transcript: str | None = Field(default=None, max_length=50000)
    ai_summary: dict[str, Any] | None = None


class CallLogUpdateRequest(BaseModel):
    call_type: CallType | None = None
    contact_name: str | None = Field(default=None, max_length=120)
    phone_number: str | None = Field(default=None, max_length=40)
    scheduled_at: datetime | None = None
    duration: int | None = Field(default=None, ge=0)
    ai_ready: bool | None = None
    callback_requested: bool | None = None
    status: CallStatus | None = None
    recording_url: str | None = Field(default=None, max_length=1000)
    transcript: str | None = Field(default=None, max_length=50000)
    ai_summary: dict[str, Any] | None = None


class CallTranscriptUpdateRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=50000)
    speaker_segments: list[dict[str, Any]] = Field(default_factory=list)


class CallAISummaryUpdateRequest(BaseModel):
    purpose: str | None = Field(default=None, max_length=500)
    key_points: list[str] = Field(default_factory=list)
    action_items: list[str] = Field(default_factory=list)
    highlights: list[dict[str, Any]] = Field(default_factory=list)


class CallRecordingUpdateRequest(BaseModel):
    recording_url: str = Field(min_length=5, max_length=1000)
    recording_duration: int | None = Field(default=None, ge=0)


class CallLogResponse(BaseModel):
    id: str
    contact_id: str | None = None
    contact_name: str | None = None
    contact: dict[str, Any] | None = None
    phone_number: str | None = None
    call_type: CallType
    call_type_label: str = "Call"
    scheduled_at: datetime | None = None
    duration: int
    duration_label: str = "--"
    ai_ready: bool
    callback_requested: bool
    timestamp: datetime
    display_time_label: str | None = None
    date_bucket: Literal["today", "yesterday", "older"] = "older"
    status: CallStatus
    status_label: str = "Completed"
    status_tone: str = "muted"
    twilio_call_sid: str | None = None
    from_number: str | None = None
    recording_url: str | None = None
    recording_available: bool = False
    transcript: str | None = None
    transcript_available: bool = False
    speaker_segments: list[dict[str, Any]] = Field(default_factory=list)
    ai_summary: dict[str, Any] | None = None
    ai_summary_available: bool = False
    repeat_count: int = 1
    initials: str = "NA"
    actions: list[str] = Field(default_factory=list)


class OutboundCallRequest(BaseModel):
    contact_id: str | None = None
    phone_number: str | None = None
    from_number: str | None = None
    ai_ready: bool = True


class OutboundCallResponse(BaseModel):
    call_log: CallLogResponse
    twilio_call_sid: str
    twilio_status: str


class SocialIntegrationUpsertRequest(BaseModel):
    platform: PlatformType
    access_token: str = Field(min_length=1)
    refresh_token: str | None = None
    external_account_id: str | None = None
    external_account_name: str | None = None
    provider_metadata: dict[str, Any] | None = None


class TelegramManualConnectRequest(BaseModel):
    bot_token: str = Field(min_length=10, max_length=255)
    bot_username: str | None = Field(default=None, max_length=255)
    secret_token: str | None = Field(default=None, min_length=8, max_length=255)


class TelegramManualConnectResponse(BaseModel):
    connected: bool = True
    platform: Literal["telegram"] = "telegram"
    webhook_url: str
    secret_token: str
    integration: SocialIntegrationResponse


class WhatsAppManualConnectRequest(BaseModel):
    phone_number: str = Field(min_length=8, max_length=50)
    whatsapp_gateway_url: str | None = Field(default=None, max_length=255)


class WhatsAppManualConnectResponse(BaseModel):
    connected: bool = True
    platform: Literal["whatsapp"] = "whatsapp"
    integration: SocialIntegrationResponse



class SocialIntegrationResponse(BaseModel):
    id: str
    platform: PlatformType
    status: IntegrationStatus
    connected: bool = False
    platform_label: str = "WhatsApp"
    description: str | None = None
    icon_key: str | None = None
    brand_color: str | None = None
    cta_label: str = "Connect"
    is_available: bool = True
    is_configured: bool = False
    auth_mode: Literal["oauth", "manual", "hybrid"] = "oauth"
    health_status: Literal["connected", "disconnected", "pending", "needs_reauth", "misconfigured", "error"] = "disconnected"
    external_account_id: str | None = None
    external_account_name: str | None = None
    sync_status: Literal["idle", "syncing", "synced", "needs_provider_access", "unsupported_by_provider", "error"] = "idle"
    last_sync_at: datetime | None = None
    last_error: str | None = None
    message_sync_enabled: bool = False
    webhook_status: Literal["not_configured", "configured", "active", "error"] = "not_configured"
    connected_at: datetime | None = None
    last_webhook_at: datetime | None = None


class SocialIntegrationCatalogItem(BaseModel):
    platform: PlatformType
    platform_label: str
    description: str
    icon_key: str
    brand_color: str
    status: Literal["connected", "disconnected", "pending", "needs_reauth", "misconfigured", "error"]
    connected: bool = False
    cta_label: str = "Connect"
    is_available: bool = True
    is_configured: bool = False
    auth_mode: Literal["oauth", "manual", "hybrid"] = "oauth"
    external_account_id: str | None = None
    external_account_name: str | None = None
    sync_status: Literal["idle", "syncing", "synced", "needs_provider_access", "unsupported_by_provider", "error"] = "idle"
    last_sync_at: datetime | None = None
    last_error: str | None = None
    message_sync_enabled: bool = False
    webhook_status: Literal["not_configured", "configured", "active", "error"] = "not_configured"
    connected_at: datetime | None = None
    last_webhook_at: datetime | None = None


class WebhookMessageRequest(BaseModel):
    event_id: str = Field(min_length=1)
    contact_external_id: str = Field(min_length=1)
    content: str = Field(min_length=1)
    media_url: str | None = None
    timestamp: datetime | None = None


class NotificationPreferences(BaseModel):
    general_notification: bool = True
    sound: bool = True
    vibrate: bool = True
    new_messages: bool = True
    missed_calls: bool = True
    scheduled_calls: bool = True
    ai_tasks: bool = True
    calendar_reminders: bool = True


class NotificationSettingsUpdateRequest(BaseModel):
    general_notification: bool | None = None
    sound: bool | None = None
    vibrate: bool | None = None
    new_messages: bool | None = None
    missed_calls: bool | None = None
    scheduled_calls: bool | None = None
    ai_tasks: bool | None = None
    calendar_reminders: bool | None = None


class NotificationResponse(BaseModel):
    id: str
    type: NotificationType
    title: str
    body: str
    read: bool = False
    unread: bool = True
    icon_key: str = "bell"
    accent_tone: str = "neutral"
    date_bucket: Literal["today", "earlier"] = "earlier"
    display_time_label: str
    primary_action: str | None = None
    action_url: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class PushTokenRequest(BaseModel):
    device_id: str = Field(min_length=1)
    token: str = Field(min_length=8)
    platform: Literal["ios", "android", "web"] = "ios"


class GroupCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    member_ids: list[str] = Field(default_factory=list)
    admin_ids: list[str] = Field(default_factory=list)
    avatar_url: str | None = Field(default=None, max_length=1000)
    description: str | None = Field(default=None, max_length=500)
    role_slug: Literal["manager", "staff", "assistant"] | None = None


class GroupUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    member_ids: list[str] | None = None
    admin_ids: list[str] | None = None
    avatar_url: str | None = Field(default=None, max_length=1000)
    description: str | None = Field(default=None, max_length=500)
    role_slug: Literal["manager", "staff", "assistant"] | None = None


class GroupMemberResponse(BaseModel):
    id: str
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    avatar_url: str | None = None
    presence: str = "offline"
    role: Literal["owner", "admin", "member"] = "member"
    status: Literal["active", "pending"] = "active"
    is_self: bool = False


class GroupInviteRequest(BaseModel):
    email: EmailStr | None = None
    phone: str | None = None
    name: str | None = Field(default=None, max_length=120)
    role: Literal["member", "admin"] = "member"

    @model_validator(mode="after")
    def validate_target(self) -> "GroupInviteRequest":
        if not self.email and not self.phone:
            raise ValueError("Invite email or phone is required.")
        return self


class GroupInviteResponse(BaseModel):
    id: str
    email: EmailStr | None = None
    phone: str | None = None
    name: str | None = None
    role: Literal["member", "admin"] = "member"
    status: Literal["pending"] = "pending"
    invited_at: datetime


class GroupMemberAddRequest(BaseModel):
    member_ids: list[str] = Field(default_factory=list, min_length=1)
    admin_ids: list[str] = Field(default_factory=list)


class GroupMemberRoleUpdateRequest(BaseModel):
    role: Literal["admin", "member"]


class GroupResponse(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None
    description: str | None = None
    role_slug: Literal["manager", "staff", "assistant"] | None = None
    member_ids: list[str] = Field(default_factory=list)
    admin_ids: list[str] = Field(default_factory=list)
    members: list[GroupMemberResponse] = Field(default_factory=list)
    pending_invites: list[GroupInviteResponse] = Field(default_factory=list)
    member_count: int = 0
    pending_invite_count: int = 0
    admin_count: int = 0
    can_manage: bool = False
    can_leave: bool = True
    conversation_id: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class SettingsUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    avatar_url: str | None = None
    date_of_birth: date | None = None
    country: str | None = Field(default=None, max_length=120)
    language_preference: str | None = Field(default=None, min_length=2, max_length=10)
    notification_preferences: NotificationSettingsUpdateRequest | None = None


class ProfileResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    is_verified: bool
    email_verification_required: bool = False
    avatar_url: str | None = None
    date_of_birth: date | None = None
    country: str | None = None
    language_preference: str = "EN"
    notification_preferences: NotificationPreferences
    created_at: datetime | None = None
    updated_at: datetime | None = None


class BusinessAddress(BaseModel):
    street_address: str | None = Field(default=None, max_length=180)
    suite: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    postal_code: str | None = Field(default=None, max_length=40)
    country: str | None = Field(default=None, max_length=120)


class BusinessProfileUpdateRequest(BaseModel):
    business_name: str | None = Field(default=None, min_length=2, max_length=160)
    email: EmailStr | None = None
    phone_number: str | None = Field(default=None, max_length=40)
    website: str | None = Field(default=None, max_length=300)
    logo_url: str | None = Field(default=None, max_length=1000)
    office_address: BusinessAddress | None = None
    office_address_text: str | None = Field(default=None, max_length=600)

    @field_validator("website")
    @classmethod
    def normalize_website(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        if "://" not in cleaned:
            cleaned = f"https://{cleaned}"
        if "." not in cleaned.split("://", 1)[1]:
            raise ValueError("Website must include a valid domain.")
        return cleaned


class BusinessProfileResponse(BaseModel):
    id: str | None = None
    business_name: str | None = None
    email: EmailStr | None = None
    phone_number: str | None = None
    website: str | None = None
    logo_url: str | None = None
    office_address: BusinessAddress = Field(default_factory=BusinessAddress)
    office_address_text: str | None = None
    office_location_lines: list[str] = Field(default_factory=list)
    profile_completed: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None


class SubscriptionPlanResponse(BaseModel):
    code: str
    name: str
    description: str
    price_cents: int = Field(ge=0)
    currency: str = "USD"
    billing_interval: Literal["month", "year", "one_time"] = "month"
    features: list[str] = Field(default_factory=list)
    is_popular: bool = False
    is_active: bool = True
    display_order: int = 0


class CurrentSubscriptionResponse(BaseModel):
    status: Literal["active", "trialing", "past_due", "cancelled", "free"] = "free"
    plan: SubscriptionPlanResponse
    started_at: datetime | None = None
    renews_at: datetime | None = None
    cancelled_at: datetime | None = None


class UserReportCreateRequest(BaseModel):
    category: Literal["bug", "billing", "account", "ai_response", "abuse", "other"] = "other"
    subject: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=10, max_length=3000)
    screen: str | None = Field(default=None, max_length=120)
    metadata: dict[str, Any] = Field(default_factory=dict)


class SupportTicketCreateRequest(BaseModel):
    topic: Literal["general", "account", "billing", "technical", "feature_request"] = "general"
    subject: str = Field(min_length=3, max_length=160)
    message: str = Field(min_length=10, max_length=3000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str | None = Field(default=None, min_length=8, max_length=128)

    @model_validator(mode="after")
    def validate_passwords_match(self) -> "ChangePasswordRequest":
        if self.confirm_password is not None and self.new_password != self.confirm_password:
            raise ValueError("new_password and confirm_password must match.")
        return self


class SupportSessionCreateRequest(BaseModel):
    topic: Literal["general", "billing", "technical", "account"] = "general"


class SupportMessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=3000)
    topic: Literal["general", "billing", "technical", "account"] | None = None
    attachment_url: str | None = Field(default=None, max_length=1000)


class SupportMessageResponse(BaseModel):
    id: str
    session_id: str
    sender_type: Literal["user", "support", "system"]
    sender_name: str
    sender_avatar_url: str | None = None
    content: str
    attachment_url: str | None = None
    created_at: datetime


class SupportSessionResponse(BaseModel):
    id: str
    status: Literal["open", "closed"]
    topic: str = "general"
    agent: dict[str, Any]
    quick_replies: list[dict[str, str]] = Field(default_factory=list)
    support_typing: bool = False
    started_at: datetime
    updated_at: datetime
    latest_messages: list[SupportMessageResponse] = Field(default_factory=list)


class SettingsResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    is_verified: bool = True
    email_verification_required: bool = False
    avatar_url: str | None = None
    date_of_birth: date | None = None
    country: str | None = None
    language_preference: str = "EN"
    notification_preferences: NotificationPreferences
    integrations: list[SocialIntegrationResponse] = Field(default_factory=list)


class HomeDashboardResponse(BaseModel):
    greeting_name: str
    language_preference: str = "EN"
    inbox: dict[str, Any]
    contacts: dict[str, Any]
    calendar: dict[str, Any]
    integrations: dict[str, Any]
    documents: dict[str, Any]
    ai_call_analytics: dict[str, Any]
    notifications: dict[str, Any]


ContactListResponse = PaginatedPayload[ContactResponse]
ConversationListResponse = PaginatedPayload[ConversationResponse]
MessageListResponse = PaginatedPayload[MessageResponse]
HistoryListResponse = PaginatedPayload[AICommandHistoryItem]
CalendarListResponse = PaginatedPayload[CalendarEventResponse]
DocumentListResponse = PaginatedPayload[DocumentResponse]
AgreementListResponse = PaginatedPayload[AgreementResponse]
CallLogListResponse = PaginatedPayload[CallLogResponse]
NotificationListResponse = PaginatedPayload[NotificationResponse]
GroupListResponse = PaginatedPayload[GroupResponse]
