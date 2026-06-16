from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import AppException

from ._base import SmartFlowBase
from .conversation_service import ConversationService


class HistoryService(SmartFlowBase):
    def __init__(self, db: AsyncIOMotorDatabase, conversation_service: ConversationService | None = None) -> None:
        super().__init__(db)
        self.conversation_service = conversation_service or ConversationService(db)

    async def list_ai_history(
        self,
        user_id: str,
        page: int,
        page_size: int,
        search: str | None,
        command_type: str | None,
        *,
        status_filter: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        replayable_only: bool = False,
        group_by: str | None = None,
    ) -> dict:
        filters = {"user_id": user_id}
        if search:
            filters["command_text"] = {"$regex": search, "$options": "i"}
        if command_type:
            filters["command_type"] = command_type
        if status_filter:
            filters["status"] = status_filter
        if replayable_only:
            filters["is_replayable"] = True
        if date_from or date_to:
            timestamp_filter = filters.get("timestamp", {})
            if date_from:
                timestamp_filter["$gte"] = self._parse_date_boundary(date_from, end_of_day=False)
            if date_to:
                timestamp_filter["$lte"] = self._parse_date_boundary(date_to, end_of_day=True)
            filters["timestamp"] = timestamp_filter
        page_result = await self._paginate(self.db.ai_command_history, filters, page, page_size, "timestamp")
        items = [self._serialize_history_item(item) for item in page_result["items"]]
        page_result["items"] = items
        if group_by == "day":
            page_result["groups"] = self._group_history_items_by_day(items)
        return page_result

    async def replay_ai_command(self, user_id: str, history_id: str) -> dict:
        history = await self._get_owned_document(self.db.ai_command_history, user_id, history_id, "AI_COMMAND_NOT_FOUND")
        if not history.get("is_replayable", True):
            raise AppException(status_code=400, code="COMMAND_NOT_REPLAYABLE", message="This command cannot be replayed.")
        linked = await self._replay_linked_resource(user_id, history)
        if linked is not None:
            return {
                **linked,
                "history_item": self._serialize_history_item(history),
                "replayed_action_status": "linked",
            }
        replay_result = await self.conversation_service.chat_with_ai(user_id, history["command_text"])
        return {
            **replay_result,
            "history_item": self._serialize_history_item(history),
            "result_type": "ai_chat",
            "replayed_action_status": "completed",
        }
