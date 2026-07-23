from __future__ import annotations

from math import ceil

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.core.security import hash_password, verify_password
from app.utils.helpers import serialize_mongo_document, utc_now

from ._base import SmartFlowBase
from .agreement_service import AgreementService
from .bulk_message_service import BulkMessageService
from .calendar_service import CalendarService
from .call_history_service import CallHistoryService
from .contact_service import ContactService
from .conversation_service import ConversationService
from .document_service import DocumentService
from .history_service import HistoryService
from .integration_service import IntegrationService
from .lease_service import LeaseService
from .notification_service import NotificationService
from .workflow_service import WorkflowService


class SmartFlowService(SmartFlowBase):
    """Slim orchestrator that instantiates the SmartFlow domain services and
    delegates the public API surface to them.

    Cross-cutting helpers and the two universally shared public methods
    (``log_ai_command`` and ``create_notification``) are inherited from
    :class:`SmartFlowBase`, so any account/business/support methods defined
    directly here have full access to them.
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        super().__init__(db)

        # Domain services with their cross-service dependencies wired up.
        self.contact_service = ContactService(db)
        self.conversation_service = ConversationService(db)
        self.agreement_service = AgreementService(db)
        self.lease_service = LeaseService(db, agreement_service=self.agreement_service)
        self.bulk_message_service = BulkMessageService(db)
        self.calendar_service = CalendarService(db)
        self.integration_service = IntegrationService(db, conversation_service=self.conversation_service)
        self.notification_service = NotificationService(db)
        self.call_history_service = CallHistoryService(db)
        self.workflow_service = WorkflowService(db, conversation_service=self.conversation_service)
        self.document_service = DocumentService(db)
        self.history_service = HistoryService(db, conversation_service=self.conversation_service)

    # ==================================================================
    # Home dashboard
    # ==================================================================
    async def get_home_dashboard(self, user: dict) -> dict:
        user_id = str(user["_id"])
        latest_messages = await self.db.messages.find({"user_id": user_id}).sort("timestamp", -1).limit(3).to_list(length=3)
        upcoming_events = await self.db.calendar_events.find(
            {"user_id": user_id, "starts_at": {"$gte": utc_now()}}
        ).sort("starts_at", 1).limit(3).to_list(length=3)
        integrations = await self.db.social_integrations.find({"user_id": user_id, "status": "connected"}).to_list(length=20)
        contacts = await self.db.contacts.find({"user_id": user_id}).sort("updated_at", -1).limit(5).to_list(length=5)
        doc_pipeline = [
            {"$match": {"user_id": user_id}},
            {"$group": {"_id": "$type", "count": {"$sum": 1}}},
        ]
        doc_counts = await self.db.documents.aggregate(doc_pipeline).to_list(length=10)
        call_logs = await self.db.call_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(5).to_list(length=5)
        unread_notifications = await self.db.notifications.count_documents({"user_id": user_id, "read": False})
        unread_messages = await self.db.messages.aggregate(
            [
                {"$match": {"user_id": user_id}},
                {"$group": {"_id": None, "total": {"$sum": "$unread_count"}}},
            ]
        ).to_list(length=1)

        total_calls = await self.db.call_logs.count_documents({"user_id": user_id})
        total_minutes_saved = sum(max(1, int(item.get("duration", 0) / 60)) for item in call_logs if item.get("ai_ready"))

        return {
            "greeting_name": user.get("full_name", "User").split(" ")[0],
            "language_preference": user.get("language_preference", "EN"),
            "inbox": {
                "unread_count": unread_messages[0]["total"] if unread_messages else 0,
                "latest_messages": self._to_public_many(latest_messages),
            },
            "contacts": {
                "count": await self.db.contacts.count_documents({"user_id": user_id}),
                "items": self._to_public_many(contacts),
            },
            "calendar": {
                "upcoming_count": await self.db.calendar_events.count_documents(
                    {"user_id": user_id, "starts_at": {"$gte": utc_now()}}
                ),
                "items": self._to_public_many(upcoming_events),
            },
            "integrations": {
                "connected_count": len(integrations),
                "items": [{"platform": item["platform"], "status": item["status"]} for item in integrations],
            },
            "documents": {
                "counts_by_type": {item["_id"]: item["count"] for item in doc_counts},
            },
            "ai_call_analytics": {
                "total_calls": total_calls,
                "minutes_saved": total_minutes_saved,
                "latest_calls": self._to_public_many(call_logs),
            },
            "notifications": {
                "unread_count": unread_notifications,
            },
        }

    # ==================================================================
    # Contacts (delegated)
    # ==================================================================
    async def list_contacts(self, user_id, page, page_size, search):
        return await self.contact_service.list_contacts(user_id, page, page_size, search)

    async def get_contact(self, user_id, contact_id):
        return await self.contact_service.get_contact(user_id, contact_id)

    async def create_contact(self, user_id, payload):
        return await self.contact_service.create_contact(user_id, payload)

    async def import_contacts(self, user_id, entries):
        return await self.contact_service.import_contacts(user_id, entries)

    async def update_contact(self, user_id, contact_id, updates):
        return await self.contact_service.update_contact(user_id, contact_id, updates)

    async def delete_contact(self, user_id, contact_id):
        return await self.contact_service.delete_contact(user_id, contact_id)

    async def store_contact_avatar(self, user_id, contact_id, file_bytes, content_type, filename):
        return await self.contact_service.store_contact_avatar(user_id, contact_id, file_bytes, content_type, filename)

    # ==================================================================
    # Conversations / messages / typing / AI chat / groups (delegated)
    # ==================================================================
    async def create_conversation(self, user_id, payload):
        return await self.conversation_service.create_conversation(user_id, payload)

    async def get_conversation(self, user_id, conversation_id):
        return await self.conversation_service.get_conversation(user_id, conversation_id)

    async def list_conversations(self, user_id, page, page_size, search, platform, platforms, archived, unread_only=False, type_filter=None):
        return await self.conversation_service.list_conversations(
            user_id, page, page_size, search, platform, platforms, archived, unread_only=unread_only, type_filter=type_filter
        )

    async def archive_conversation(self, user_id, conversation_id, archived):
        return await self.conversation_service.archive_conversation(user_id, conversation_id, archived)

    async def mark_conversation_read(self, user_id, conversation_id):
        return await self.conversation_service.mark_conversation_read(user_id, conversation_id)

    async def list_messages(self, user_id, conversation_id, page, page_size, search, platform):
        return await self.conversation_service.list_messages(user_id, conversation_id, page, page_size, search, platform)

    async def create_message(self, user_id, payload):
        return await self.conversation_service.create_message(user_id, payload)

    async def store_message_attachment(self, user_id, conversation_id, *, file_bytes, content_type, filename):
        return await self.conversation_service.store_message_attachment(
            user_id,
            conversation_id,
            file_bytes=file_bytes,
            content_type=content_type,
            filename=filename,
        )

    async def update_message(self, user_id, message_id, updates):
        return await self.conversation_service.update_message(user_id, message_id, updates)

    async def reply_to_message(self, user_id, message_id, payload):
        return await self.conversation_service.reply_to_message(user_id, message_id, payload)

    async def forward_message(self, user_id, message_id, payload):
        return await self.conversation_service.forward_message(user_id, message_id, payload)

    async def get_typing_state(self, user_id, conversation_id):
        return await self.conversation_service.get_typing_state(user_id, conversation_id)

    async def set_typing_state(self, user_id, conversation_id, payload):
        return await self.conversation_service.set_typing_state(user_id, conversation_id, payload)

    async def ensure_ai_conversation(self, user_id):
        return await self.conversation_service.ensure_ai_conversation(user_id)

    async def chat_with_ai(self, user_id, content, response_mode="text", voice_id=None):
        return await self.conversation_service.chat_with_ai(user_id, content, response_mode=response_mode, voice_id=voice_id)

    async def generate_ai_image(self, user_id, prompt):
        return await self.conversation_service.generate_ai_image(user_id, prompt)

    async def create_group(self, user_id, payload):
        return await self.conversation_service.create_group(user_id, payload)

    async def get_group(self, user_id, group_id):
        return await self.conversation_service.get_group(user_id, group_id)

    async def list_groups(self, user_id, page, page_size, search):
        return await self.conversation_service.list_groups(user_id, page, page_size, search)

    async def update_group(self, user_id, group_id, updates):
        return await self.conversation_service.update_group(user_id, group_id, updates)

    async def add_group_members(self, user_id, group_id, payload):
        return await self.conversation_service.add_group_members(user_id, group_id, payload)

    async def update_group_member_role(self, user_id, group_id, member_id, role):
        return await self.conversation_service.update_group_member_role(user_id, group_id, member_id, role)

    async def remove_group_member(self, user_id, group_id, member_id):
        return await self.conversation_service.remove_group_member(user_id, group_id, member_id)

    async def invite_group_member(self, user_id, group_id, payload):
        return await self.conversation_service.invite_group_member(user_id, group_id, payload)

    async def cancel_group_invite(self, user_id, group_id, invite_id):
        return await self.conversation_service.cancel_group_invite(user_id, group_id, invite_id)

    async def leave_group(self, user_id, group_id):
        return await self.conversation_service.leave_group(user_id, group_id)

    async def delete_group(self, user_id, group_id):
        return await self.conversation_service.delete_group(user_id, group_id)

    async def get_unread_message_summary(self, user_id, platform):
        return await self.conversation_service.get_unread_message_summary(user_id, platform)

    async def ensure_global_chat(self, organization_id, business_name, owner_id):
        return await self.conversation_service.ensure_global_chat(organization_id, business_name, owner_id)

    async def add_user_to_global_chat(self, organization_id, user_id):
        return await self.conversation_service.add_user_to_global_chat(organization_id, user_id)

    async def remove_user_from_global_chat(self, organization_id, user_id):
        return await self.conversation_service.remove_user_from_global_chat(organization_id, user_id)

    async def sync_user_global_chat_membership(self, user_id, organization_id=None):
        return await self.conversation_service.sync_user_global_chat_membership(user_id, organization_id)

    async def backfill_global_chats(self):
        return await self.conversation_service.backfill_global_chats()

    # ==================================================================
    # AI history / voice / workflow prefill (delegated)
    # ==================================================================
    async def list_ai_history(self, user_id, page, page_size, search, command_type, *, status_filter=None, date_from=None, date_to=None, replayable_only=False, group_by=None):
        return await self.history_service.list_ai_history(
            user_id, page, page_size, search, command_type,
            status_filter=status_filter, date_from=date_from, date_to=date_to,
            replayable_only=replayable_only, group_by=group_by,
        )

    async def replay_ai_command(self, user_id, history_id):
        return await self.history_service.replay_ai_command(user_id, history_id)

    async def process_voice_command(self, user_id, transcript, audio_url, audio_base64=None, audio_mime_type="audio/wav", audio_filename="voice.wav", response_mode="both", voice_id=None):
        return await self.workflow_service.process_voice_command(
            user_id, transcript, audio_url,
            audio_base64=audio_base64, audio_mime_type=audio_mime_type, audio_filename=audio_filename,
            response_mode=response_mode, voice_id=voice_id,
        )

    async def process_workflow_prefill(self, user_id, payload):
        return await self.workflow_service.process_workflow_prefill(user_id, payload)

    async def list_ai_voices(self):
        return await self.workflow_service.list_ai_voices()

    # ==================================================================
    # Bulk messages (delegated)
    # ==================================================================
    async def store_bulk_message_attachment(self, user_id, *, file_bytes, content_type, filename):
        return await self.bulk_message_service.store_bulk_message_attachment(
            user_id, file_bytes=file_bytes, content_type=content_type, filename=filename
        )

    async def improve_bulk_message_content(self, user_id, content):
        return await self.bulk_message_service.improve_bulk_message_content(user_id, content)

    async def validate_bulk_recipients(self, user_id, payload):
        return await self.bulk_message_service.validate_bulk_recipients(user_id, payload)

    async def list_bulk_messages(self, user_id, page, page_size, search, status_filter, channel):
        return await self.bulk_message_service.list_bulk_messages(user_id, page, page_size, search, status_filter, channel)

    async def get_bulk_message(self, user_id, bulk_message_id):
        return await self.bulk_message_service.get_bulk_message(user_id, bulk_message_id)

    async def create_bulk_message(self, user_id, payload):
        return await self.bulk_message_service.create_bulk_message(user_id, payload)

    async def update_bulk_message(self, user_id, bulk_message_id, updates):
        return await self.bulk_message_service.update_bulk_message(user_id, bulk_message_id, updates)

    async def send_bulk_message(self, user_id, bulk_message_id):
        return await self.bulk_message_service.send_bulk_message(user_id, bulk_message_id)

    async def cancel_bulk_message(self, user_id, bulk_message_id):
        return await self.bulk_message_service.cancel_bulk_message(user_id, bulk_message_id)

    # ==================================================================
    # Calendar (delegated)
    # ==================================================================
    async def list_calendar_events(self, user_id, page, page_size, search, upcoming_only, *, date_from=None, date_to=None, contact_id=None):
        return await self.calendar_service.list_calendar_events(
            user_id, page, page_size, search, upcoming_only,
            date_from=date_from, date_to=date_to, contact_id=contact_id,
        )

    async def find_free_slots(self, user_id, day):
        return await self.calendar_service.find_free_slots(user_id, day)

    async def get_calendar_event(self, user_id, event_id):
        return await self.calendar_service.get_calendar_event(user_id, event_id)

    async def create_calendar_event(self, user_id, payload):
        return await self.calendar_service.create_calendar_event(user_id, payload)

    async def update_calendar_event(self, user_id, event_id, updates):
        return await self.calendar_service.update_calendar_event(user_id, event_id, updates)

    async def share_calendar_event(self, user_id, event_id, payload):
        return await self.calendar_service.share_calendar_event(user_id, event_id, payload)

    async def delete_calendar_event(self, user_id, event_id):
        return await self.calendar_service.delete_calendar_event(user_id, event_id)

    # ==================================================================
    # Documents (delegated)
    # ==================================================================
    async def list_documents(self, user_id, page, page_size, search, doc_type):
        return await self.document_service.list_documents(user_id, page, page_size, search, doc_type)

    async def create_document(self, user_id, payload):
        return await self.document_service.create_document(user_id, payload)

    async def update_document(self, user_id, document_id, updates):
        return await self.document_service.update_document(user_id, document_id, updates)

    async def delete_document(self, user_id, document_id):
        return await self.document_service.delete_document(user_id, document_id)

    # ==================================================================
    # Agreements (delegated)
    # ==================================================================
    async def list_agreements(self, user_id, page, page_size, search, status, agreement_type):
        return await self.agreement_service.list_agreements(user_id, page, page_size, search, status, agreement_type)

    async def get_agreement(self, user_id, agreement_id):
        return await self.agreement_service.get_agreement(user_id, agreement_id)

    async def create_agreement(self, user_id, payload):
        return await self.agreement_service.create_agreement(user_id, payload)

    async def update_agreement(self, user_id, agreement_id, updates):
        return await self.agreement_service.update_agreement(user_id, agreement_id, updates)

    async def delete_agreement(self, user_id, agreement_id):
        return await self.agreement_service.delete_agreement(user_id, agreement_id)

    async def generate_agreement_draft(self, user_id, payload):
        return await self.agreement_service.generate_agreement_draft(user_id, payload)

    async def improve_agreement_draft(self, user_id, payload):
        return await self.agreement_service.improve_agreement_draft(user_id, payload)

    async def improve_agreement(self, user_id, agreement_id, payload):
        return await self.agreement_service.improve_agreement(user_id, agreement_id, payload)

    async def review_agreement_draft(self, user_id, payload):
        return await self.agreement_service.review_agreement_draft(user_id, payload)

    async def review_agreement(self, user_id, agreement_id):
        return await self.agreement_service.review_agreement(user_id, agreement_id)

    async def send_agreement_for_signature(self, user_id, agreement_id, payload):
        return await self.agreement_service.send_agreement_for_signature(user_id, agreement_id, payload)

    async def get_docusign_status(self, user_id):
        return await self.agreement_service.get_docusign_status(user_id)

    async def start_docusign_oauth(self, user_id):
        return await self.agreement_service.start_docusign_oauth(user_id)

    async def complete_docusign_oauth(self, code, state):
        return await self.agreement_service.complete_docusign_oauth(code, state)

    async def handle_docusign_webhook(self, raw_body, payload):
        return await self.agreement_service.handle_docusign_webhook(raw_body, payload)

    async def sign_agreement(self, user_id, agreement_id, payload):
        return await self.agreement_service.sign_agreement(user_id, agreement_id, payload)

    async def get_public_signing_agreement(self, signature_token):
        return await self.agreement_service.get_public_signing_agreement(signature_token)

    async def sign_public_agreement(self, signature_token, payload):
        return await self.agreement_service.sign_public_agreement(signature_token, payload)

    async def renew_agreement(self, user_id, agreement_id, payload):
        return await self.agreement_service.renew_agreement(user_id, agreement_id, payload)

    async def generate_agreement_pdf(self, user_id, agreement_id):
        return await self.agreement_service.generate_agreement_pdf(user_id, agreement_id)

    async def download_signed_agreement_pdf(self, user_id, agreement_id):
        return await self.agreement_service.download_signed_agreement_pdf(user_id, agreement_id)

    async def download_agreement_completion_certificate(self, user_id, agreement_id):
        return await self.agreement_service.download_agreement_completion_certificate(user_id, agreement_id)

    async def generate_public_agreement_pdf(self, signature_token):
        return await self.agreement_service.generate_public_agreement_pdf(signature_token)

    def agreement_metadata(self):
        return self.agreement_service.agreement_metadata()

    # ==================================================================
    # Leases (delegated)
    # ==================================================================
    def lease_metadata(self):
        return self.lease_service.lease_metadata()

    async def list_leases(self, user_id, page, page_size, search, status):
        return await self.lease_service.list_leases(user_id, page, page_size, search, status)

    async def get_lease(self, user_id, lease_id):
        return await self.lease_service.get_lease(user_id, lease_id)

    async def create_lease(self, user_id, payload):
        return await self.lease_service.create_lease(user_id, payload)

    async def update_lease(self, user_id, lease_id, updates):
        return await self.lease_service.update_lease(user_id, lease_id, updates)

    async def delete_lease(self, user_id, lease_id):
        return await self.lease_service.delete_lease(user_id, lease_id)

    async def generate_lease_draft(self, user_id, payload):
        return await self.lease_service.generate_lease_draft(user_id, payload)

    async def enhance_lease_terms(self, user_id, payload):
        return await self.lease_service.enhance_lease_terms(user_id, payload)

    async def enhance_saved_lease_terms(self, user_id, lease_id, payload):
        return await self.lease_service.enhance_saved_lease_terms(user_id, lease_id, payload)

    async def review_lease_draft(self, user_id, payload):
        return await self.lease_service.review_lease_draft(user_id, payload)

    async def review_lease(self, user_id, lease_id):
        return await self.lease_service.review_lease(user_id, lease_id)

    async def send_lease_for_signature(self, user_id, lease_id, payload):
        return await self.lease_service.send_lease_for_signature(user_id, lease_id, payload)

    async def sign_lease(self, user_id, lease_id, payload):
        return await self.lease_service.sign_lease(user_id, lease_id, payload)

    async def get_public_signing_lease(self, signature_token):
        return await self.lease_service.get_public_signing_lease(signature_token)

    async def sign_public_lease(self, signature_token, payload):
        return await self.lease_service.sign_public_lease(signature_token, payload)

    async def renew_lease(self, user_id, lease_id, payload):
        return await self.lease_service.renew_lease(user_id, lease_id, payload)

    async def generate_lease_pdf(self, user_id, lease_id):
        return await self.lease_service.generate_lease_pdf(user_id, lease_id)

    async def generate_public_lease_pdf(self, signature_token):
        return await self.lease_service.generate_public_lease_pdf(signature_token)

    # ==================================================================
    # Call history (delegated)
    # ==================================================================
    async def list_call_logs(self, user_id, page, page_size, status, search=None, contact_id=None):
        return await self.call_history_service.list_call_logs(user_id, page, page_size, status, search=search, contact_id=contact_id)

    async def get_call_log(self, user_id, call_id):
        return await self.call_history_service.get_call_log(user_id, call_id)

    async def create_call_log(self, user_id, payload):
        return await self.call_history_service.create_call_log(user_id, payload)

    async def create_outbound_call(self, user_id, payload):
        return await self.call_history_service.create_outbound_call(user_id, payload)

    async def update_call_log(self, user_id, call_id, updates):
        return await self.call_history_service.update_call_log(user_id, call_id, updates)

    async def update_call_log_from_provider_callback(self, *, user_id, call_log_id, twilio_call_sid, call_status, call_duration, from_number, to_number):
        return await self.call_history_service.update_call_log_from_provider_callback(
            user_id=user_id, call_log_id=call_log_id, twilio_call_sid=twilio_call_sid,
            call_status=call_status, call_duration=call_duration, from_number=from_number, to_number=to_number,
        )

    async def get_call_summary(self, user_id):
        return await self.call_history_service.get_call_summary(user_id)

    async def get_call_transcript(self, user_id, call_id):
        return await self.call_history_service.get_call_transcript(user_id, call_id)

    async def update_call_transcript(self, user_id, call_id, payload):
        return await self.call_history_service.update_call_transcript(user_id, call_id, payload)

    async def get_call_ai_summary(self, user_id, call_id):
        return await self.call_history_service.get_call_ai_summary(user_id, call_id)

    async def update_call_ai_summary(self, user_id, call_id, payload):
        return await self.call_history_service.update_call_ai_summary(user_id, call_id, payload)

    async def request_call_callback(self, user_id, call_id):
        return await self.call_history_service.request_call_callback(user_id, call_id)

    async def get_call_recording(self, user_id, call_id):
        return await self.call_history_service.get_call_recording(user_id, call_id)

    async def update_call_recording(self, user_id, call_id, payload):
        return await self.call_history_service.update_call_recording(user_id, call_id, payload)

    # ==================================================================
    # Integrations / webhooks (delegated)
    # ==================================================================
    async def list_integrations(self, user_id):
        return await self.integration_service.list_integrations(user_id)

    async def get_integration_catalog(self, user_id):
        return await self.integration_service.get_integration_catalog(user_id)

    async def get_integration_status(self, user_id):
        return await self.integration_service.get_integration_status(user_id)

    async def upsert_integration(self, user_id, payload):
        return await self.integration_service.upsert_integration(user_id, payload)

    async def sync_integration(self, user_id, platform):
        return await self.integration_service.sync_integration(user_id, platform)

    async def connect_telegram_manual(self, user_id, payload):
        return await self.integration_service.connect_telegram_manual(user_id, payload)

    async def connect_whatsapp_manual(self, user_id, payload):
        return await self.integration_service.connect_whatsapp_manual(user_id, payload)

    async def disconnect_integration(self, user_id, platform):
        return await self.integration_service.disconnect_integration(user_id, platform)

    async def start_integration_oauth(self, user_id, platform):
        return await self.integration_service.start_integration_oauth(user_id, platform)

    async def complete_integration_oauth(self, platform, code, state):
        return await self.integration_service.complete_integration_oauth(platform, code, state)

    async def handle_inbound_webhook(self, user_id, platform, payload):
        return await self.integration_service.handle_inbound_webhook(user_id, platform, payload)

    def normalize_webhook_payload(self, platform, payload):
        return self.integration_service.normalize_webhook_payload(platform, payload)

    def validate_webhook_secret(self, secret):
        return self.integration_service.validate_webhook_secret(secret)

    async def validate_platform_webhook_secret(self, user_id, platform, secret):
        return await self.integration_service.validate_platform_webhook_secret(user_id, platform, secret)

    async def resolve_webhook_user_id(self, platform, payload, secret=None):
        return await self.integration_service.resolve_webhook_user_id(platform, payload, secret)

    def validate_meta_webhook_challenge(self, mode, verify_token):
        return self.integration_service.validate_meta_webhook_challenge(mode, verify_token)

    # ==================================================================
    # Notifications (delegated)
    # ==================================================================
    async def list_notifications(self, user_id, page, page_size, unread_only):
        return await self.notification_service.list_notifications(user_id, page, page_size, unread_only)

    async def mark_notification_read(self, user_id, notification_id):
        return await self.notification_service.mark_notification_read(user_id, notification_id)

    async def mark_all_notifications_read(self, user_id):
        return await self.notification_service.mark_all_notifications_read(user_id)

    async def delete_notification(self, user_id, notification_id):
        return await self.notification_service.delete_notification(user_id, notification_id)

    async def dispatch_pending_push_notifications(self, user_id, limit=50):
        return await self.notification_service.dispatch_pending_push_notifications(user_id, limit=limit)

    # ==================================================================
    # Business profile / account / subscription / reports / support / settings
    # (kept here in the orchestrator)
    # ==================================================================
    async def get_business_profile(self, user: dict) -> dict:
        user_id = str(user["_id"])
        profile = await self.db.business_profiles.find_one({"user_id": user_id})
        return self._serialize_business_profile(profile, user)

    async def update_business_profile(self, user: dict, updates: dict) -> dict:
        user_id = str(user["_id"])
        existing = await self.db.business_profiles.find_one({"user_id": user_id})
        clean_updates = {key: value for key, value in updates.items() if value is not None}
        if "office_address" in clean_updates:
            current_address = (existing or {}).get("office_address", {})
            incoming_address = clean_updates["office_address"] or {}
            clean_updates["office_address"] = {
                **current_address,
                **{key: value for key, value in incoming_address.items() if value is not None},
            }
        now = utc_now()
        updated = await self.db.business_profiles.find_one_and_update(
            {"user_id": user_id},
            {
                "$set": {**clean_updates, "updated_at": now},
                "$setOnInsert": {"user_id": user_id, "created_at": now},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return self._serialize_business_profile(updated, user)

    async def store_business_logo(self, user: dict, file_bytes: bytes, content_type: str | None, filename: str | None) -> dict:
        logo_url = self._store_image_file(
            user_id=str(user["_id"]),
            folder="business_logos",
            file_bytes=file_bytes,
            content_type=content_type,
            filename=filename,
            label="Business logo",
        )
        return await self.update_business_profile(user, {"logo_url": logo_url})

    async def delete_account(self, user: dict) -> dict:
        user_id = str(user["_id"])
        now = utc_now()
        group_ids = [str(group["_id"]) for group in await self.db.groups.find({"user_id": user_id}).to_list(length=1000)]
        deletion_counts: dict[str, int] = {}

        for collection_name in [
            "contacts",
            "conversations",
            "messages",
            "ai_command_history",
            "call_logs",
            "documents",
            "agreements",
            "signature_requests",
            "calendar_events",
            "notifications",
            "typing_states",
            "push_dispatch_jobs",
            "social_integrations",
            "oauth_states",
            "groups",
            "business_profiles",
            "subscriptions",
            "user_reports",
            "support_tickets",
            "support_sessions",
            "support_messages",
            "onboarding_progress",
        ]:
            collection = getattr(self.db, collection_name)
            result = await collection.delete_many({"user_id": user_id})
            deletion_counts[collection_name] = result.deleted_count

        invoice_result = await self.db.invoices.delete_many({"owner_user_id": user_id})
        deletion_counts["invoices"] = invoice_result.deleted_count

        if group_ids:
            group_member_result = await self.db.group_members.delete_many({"group_id": {"$in": group_ids}})
            deletion_counts["group_members"] = group_member_result.deleted_count

        refresh_result = await self.db.refresh_tokens.update_many(
            {"user_id": user_id},
            {"$set": {"is_revoked": True, "revoked_at": now}},
        )
        deletion_counts["refresh_tokens_revoked"] = refresh_result.modified_count

        user_result = await self.db.users.delete_one({"_id": user["_id"]})
        return {
            "deleted": user_result.deleted_count == 1,
            "deleted_at": now,
            "data_summary": deletion_counts,
        }

    async def list_subscription_plans(self) -> dict:
        await self._ensure_default_subscription_plans()
        plans = await self.db.subscription_plans.find({"is_active": True}).sort("display_order", 1).to_list(length=20)
        return {"items": [self._serialize_subscription_plan(plan) for plan in plans]}

    async def get_current_subscription(self, user: dict) -> dict:
        await self._ensure_default_subscription_plans()
        user_id = str(user["_id"])
        subscription = await self.db.subscriptions.find_one(
            {"user_id": user_id, "status": {"$in": ["active", "trialing", "past_due"]}},
            sort=[("updated_at", -1), ("created_at", -1)],
        )
        plan_code = (subscription or {}).get("plan_code", "free")
        plan = await self.db.subscription_plans.find_one({"code": plan_code}) or await self.db.subscription_plans.find_one({"code": "free"})
        return {
            "status": (subscription or {}).get("status", "free"),
            "plan": self._serialize_subscription_plan(plan),
            "started_at": (subscription or {}).get("started_at"),
            "renews_at": (subscription or {}).get("renews_at"),
            "cancelled_at": (subscription or {}).get("cancelled_at"),
        }

    async def list_report_categories(self) -> dict:
        return {
            "items": [
                {"key": "bug", "label": "Bug", "description": "Something is broken or behaving incorrectly."},
                {"key": "billing", "label": "Billing", "description": "Payment, invoice, subscription, or receipt issue."},
                {"key": "account", "label": "Account", "description": "Login, profile, security, or account setting issue."},
                {"key": "ai_response", "label": "AI Response", "description": "Unexpected, low-quality, or unsafe AI output."},
                {"key": "abuse", "label": "Abuse", "description": "Spam, harassment, impersonation, or policy concern."},
                {"key": "other", "label": "Other", "description": "Anything else the team should review."},
            ]
        }

    async def create_user_report(self, user: dict, payload: dict) -> dict:
        now = utc_now()
        document = {
            "user_id": str(user["_id"]),
            "email": user.get("email"),
            "category": payload["category"],
            "subject": payload["subject"].strip(),
            "description": payload["description"].strip(),
            "screen": payload.get("screen"),
            "metadata": payload.get("metadata", {}),
            "status": "open",
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.user_reports.insert_one(document)
        document["_id"] = result.inserted_id
        return self._to_public(document)

    async def create_support_ticket(self, user: dict, payload: dict) -> dict:
        now = utc_now()
        document = {
            "user_id": str(user["_id"]),
            "email": user.get("email"),
            "topic": payload["topic"],
            "subject": payload["subject"].strip(),
            "message": payload["message"].strip(),
            "metadata": payload.get("metadata", {}),
            "status": "open",
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.support_tickets.insert_one(document)
        document["_id"] = result.inserted_id
        return self._to_public(document)

    async def get_or_create_support_session(self, user: dict, topic: str = "general") -> dict:
        return await super().get_or_create_support_session(user, topic=topic)

    async def list_support_messages(self, user: dict, session_id: str | None = None, page: int = 1, page_size: int = 50) -> dict:
        session = await self._get_support_session(user, session_id)
        filters = {"user_id": str(user["_id"]), "session_id": str(session["_id"])}
        total = await self.db.support_messages.count_documents(filters)
        cursor = (
            self.db.support_messages.find(filters)
            .sort("created_at", 1)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )
        messages = [self._serialize_support_message(message) for message in await cursor.to_list(length=page_size)]
        return {
            "session": await self._serialize_support_session(str(user["_id"]), session, include_messages=False),
            "items": messages,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": ceil(total / page_size) if page_size else 1,
            },
        }

    async def create_support_chat_message(self, user: dict, payload: dict) -> dict:
        topic = payload.get("topic") or "general"
        session_payload = await self.get_or_create_support_session(user, topic=topic)
        session_id = session_payload["id"]
        user_message = await self._create_support_message(
            user_id=str(user["_id"]),
            session_id=session_id,
            sender_type="user",
            sender_name=user.get("full_name", "You"),
            sender_avatar_url=user.get("avatar_url"),
            content=payload["content"].strip(),
            attachment_url=payload.get("attachment_url"),
        )
        await self.db.support_sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"topic": topic, "updated_at": utc_now()}},
        )
        return {
            "session_id": session_id,
            "message": self._serialize_support_message(user_message),
            "support_typing": True,
            "next_poll_after_seconds": 2,
        }

    async def get_settings(self, user: dict) -> dict:
        integrations = await self.list_integrations(str(user["_id"]))
        safe_user = serialize_mongo_document(user) or {}
        notification_preferences = self._merge_notification_preferences(safe_user.get("notification_preferences", {}))
        return {
            "id": safe_user["_id"],
            "full_name": safe_user["full_name"],
            "email": safe_user["email"],
            "is_verified": bool(safe_user.get("is_verified", False)),
            "email_verification_required": not bool(safe_user.get("is_verified", False)),
            "avatar_url": self._normalize_media_url(safe_user.get("avatar_url")),
            "date_of_birth": safe_user.get("date_of_birth"),
            "country": safe_user.get("country"),
            "language_preference": safe_user.get("language_preference", "EN"),
            "notification_preferences": notification_preferences,
            "integrations": integrations,
            "created_at": safe_user.get("created_at"),
            "updated_at": safe_user.get("updated_at"),
        }

    async def update_settings(self, user: dict, updates: dict) -> dict:
        clean_updates = {key: value for key, value in updates.items() if value is not None}
        if "full_name" in clean_updates:
            clean_updates["full_name"] = clean_updates["full_name"].strip()
        if "country" in clean_updates and clean_updates["country"]:
            clean_updates["country"] = clean_updates["country"].strip()
        if "date_of_birth" in clean_updates and hasattr(clean_updates["date_of_birth"], "isoformat"):
            clean_updates["date_of_birth"] = clean_updates["date_of_birth"].isoformat()
        if "email" in clean_updates:
            normalized_email = str(clean_updates["email"]).lower().strip()
            current_email = str(user.get("email", "")).lower().strip()
            if normalized_email != current_email:
                existing = await self.db.users.find_one({"email": normalized_email, "_id": {"$ne": user["_id"]}})
                if existing:
                    raise AppException(
                        status_code=409,
                        code="EMAIL_ALREADY_REGISTERED",
                        message="An account with this email already exists.",
                    )
                clean_updates["email"] = normalized_email
                clean_updates["is_verified"] = False
            else:
                clean_updates.pop("email", None)
        if "notification_preferences" in clean_updates:
            clean_updates["notification_preferences"] = self._merge_notification_preferences(
                user.get("notification_preferences", {}),
                clean_updates["notification_preferences"],
            )
        clean_updates["updated_at"] = utc_now()
        updated = await self.db.users.find_one_and_update(
            {"_id": user["_id"]},
            {"$set": clean_updates},
            return_document=ReturnDocument.AFTER,
        )
        return await self.get_settings(updated or user)

    async def get_notification_settings(self, user: dict) -> dict:
        return self._merge_notification_preferences(user.get("notification_preferences", {}))

    async def update_notification_settings(self, user: dict, updates: dict) -> dict:
        preferences = self._merge_notification_preferences(user.get("notification_preferences", {}), updates)
        updated = await self.db.users.find_one_and_update(
            {"_id": user["_id"]},
            {"$set": {"notification_preferences": preferences, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return self._merge_notification_preferences((updated or user).get("notification_preferences", {}))

    async def store_profile_avatar(self, user: dict, file_bytes: bytes, content_type: str | None, filename: str | None) -> dict:
        avatar_url = self._store_image_file(
            user_id=str(user["_id"]),
            folder="profile_avatars",
            file_bytes=file_bytes,
            content_type=content_type,
            filename=filename,
            label="Profile image",
        )
        return await self.update_settings(user, {"avatar_url": avatar_url})

    async def register_push_token(self, user: dict, payload: dict) -> dict:
        await self.db.users.update_one(
            {"_id": user["_id"]},
            {"$pull": {"device_tokens": {"device_id": payload["device_id"]}}},
        )
        await self.db.users.update_one(
            {"_id": user["_id"]},
            {
                "$push": {
                    "device_tokens": {
                        "device_id": payload["device_id"],
                        "token": payload["token"],
                        "platform": payload["platform"],
                        "updated_at": utc_now(),
                    }
                },
                "$set": {"updated_at": utc_now()},
            },
        )
        return {"device_id": payload["device_id"], "registered": True}

    async def change_password(self, user: dict, current_password: str, new_password: str) -> dict:
        if not verify_password(current_password, user["password_hash"]):
            raise AppException(status_code=400, code="INVALID_PASSWORD", message="Current password is incorrect.")
        await self.db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password_hash": hash_password(new_password), "updated_at": utc_now()}},
        )
        await self.db.refresh_tokens.update_many({"user_id": str(user["_id"])}, {"$set": {"is_revoked": True}})
        return {"changed": True}

    async def revoke_sessions(self, user: dict) -> dict:
        result = await self.db.refresh_tokens.update_many({"user_id": str(user["_id"])}, {"$set": {"is_revoked": True}})
        return {"revoked_sessions": result.modified_count}
