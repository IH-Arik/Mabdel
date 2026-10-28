from __future__ import annotations

from typing import Literal

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
    "global_chat",
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
IntegrationStatus = Literal["connected", "disconnected", "pending_qr"]
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
EmailDomainMode = Literal["subdomain", "custom"]
EmailDomainStatus = Literal["pending", "verifying", "verified", "failed"]
MeetingMode = Literal["offline", "online"]
CallMeetingRequestStatus = Literal["pending", "confirmed", "declined"]
MeetingStatus = Literal["scheduled", "cancelled", "completed"]
