from __future__ import annotations

from ._base import SmartFlowBase
from .conversation.ai_chat import ConversationAIChatMixin
from .conversation.assignment import ConversationAssignmentMixin
from .conversation.core import ConversationCoreMixin
from .conversation.delivery import ConversationDeliveryMixin
from .conversation.global_chat import ConversationGlobalChatMixin
from .conversation.groups import ConversationGroupsMixin
from .conversation.messages import ConversationMessagesMixin
from .conversation.typing_state import ConversationTypingMixin


class ConversationService(
    ConversationCoreMixin,
    ConversationAssignmentMixin,
    ConversationMessagesMixin,
    ConversationTypingMixin,
    ConversationAIChatMixin,
    ConversationGroupsMixin,
    ConversationDeliveryMixin,
    ConversationGlobalChatMixin,
    SmartFlowBase,
):
    pass
