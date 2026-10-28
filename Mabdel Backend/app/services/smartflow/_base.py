from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.call_service import CallService
from app.services.gocustify_ai_service import GoCustifyAIService
from app.services.media_storage_service import MediaStorageService
from app.services.rbac_service import RBACService

from app.services.smartflow._base_mixins.core import CoreMixin
from app.services.smartflow._base_mixins.access import AccessMixin
from app.services.smartflow._base_mixins.contact import ContactMixin
from app.services.smartflow._base_mixins.call import CallMixin
from app.services.smartflow._base_mixins.conversation import ConversationMixin
from app.services.smartflow._base_mixins.notifications import NotificationMixin
from app.services.smartflow._base_mixins.integrations import IntegrationMixin
from app.services.smartflow._base_mixins.calendar import CalendarMixin
from app.services.smartflow._base_mixins.bulk_messaging import BulkMessagingMixin
from app.services.smartflow._base_mixins.lease_agreement import LeaseAgreementMixin
from app.services.smartflow._base_mixins.workflow_prefill import WorkflowPrefillMixin
from app.services.smartflow._base_mixins.business import BusinessMixin


class SmartFlowBase(
    CoreMixin,
    AccessMixin,
    ContactMixin,
    CallMixin,
    ConversationMixin,
    NotificationMixin,
    IntegrationMixin,
    CalendarMixin,
    BulkMessagingMixin,
    LeaseAgreementMixin,
    WorkflowPrefillMixin,
    BusinessMixin,
):
    """Shared base for all SmartFlow domain services.

    Holds the database handle, shared service dependencies, and every cross-cutting
    helper used by multiple domain services. Two public methods (``log_ai_command`` and
    ``create_notification``) live here because they are invoked from nearly every domain.

    The actual helper methods are split across focused mixins under ``_base_mixins/``
    by domain (core/doc helpers, access control, contacts, calls, conversations,
    notifications, integrations, calendar, bulk messaging, lease/agreement, AI workflow
    prefill, business/subscription/support). This class composes them via multiple
    inheritance so the external API (``self.<method>()``) used by every domain service
    subclass is unchanged.
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.ai_service = GoCustifyAIService()
        self.call_service = CallService()
        self.media_storage = MediaStorageService()
        self.rbac_service = RBACService(db)
