from app.schemas.smartflow._types import *  # noqa: F401,F403

from app.schemas.smartflow.contacts import *  # noqa: F401,F403
from app.schemas.smartflow.conversations import *  # noqa: F401,F403
from app.schemas.smartflow.messages import *  # noqa: F401,F403
from app.schemas.smartflow.bulk_messages import *  # noqa: F401,F403
from app.schemas.smartflow.email_domain import *  # noqa: F401,F403
from app.schemas.smartflow.ai_call_settings import *  # noqa: F401,F403
from app.schemas.smartflow.receptionist import *  # noqa: F401,F403
from app.schemas.smartflow.ai_chat import *  # noqa: F401,F403
from app.schemas.smartflow.calendar import *  # noqa: F401,F403
from app.schemas.smartflow.documents import *  # noqa: F401,F403
from app.schemas.smartflow.agreements_leases import *  # noqa: F401,F403
from app.schemas.smartflow.calls import *  # noqa: F401,F403
from app.schemas.smartflow.social_integrations import *  # noqa: F401,F403
from app.schemas.smartflow.notifications import *  # noqa: F401,F403
from app.schemas.smartflow.groups import *  # noqa: F401,F403
from app.schemas.smartflow.settings_profile import *  # noqa: F401,F403
from app.schemas.smartflow.support import *  # noqa: F401,F403
from app.schemas.smartflow.dashboard import *  # noqa: F401,F403

from app.schemas.pagination import PaginatedPayload

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
