from __future__ import annotations


from bson import ObjectId

from app.core.exceptions import AppException
from app.utils.helpers import serialize_mongo_document


class AccessMixin:
    @classmethod
    def _is_customer_conversation(cls, conversation: dict) -> bool:
        return (
            conversation.get("platform") in cls.CUSTOMER_PLATFORMS
            and bool(conversation.get("contact_id"))
            and not conversation.get("is_global_chat")
            and conversation.get("type", "direct") == "direct"
        )

    @classmethod
    def _customer_conversation_clause(cls) -> dict:
        """Mongo form of _is_customer_conversation."""
        return {
            "platform": {"$in": sorted(cls.CUSTOMER_PLATFORMS)},
            "contact_id": {"$nin": [None, ""]},
            "is_global_chat": {"$ne": True},
            "type": {"$in": ["direct", None]},
        }

    @classmethod
    def _org_customer_inbox_filter(cls, organization_id: str) -> dict:
        return {"organization_id": organization_id, **cls._customer_conversation_clause()}

    async def _conversation_organization_id(self, conversation: dict) -> str | None:
        """Stamped on every customer thread since the shared inbox; older threads fall
        back to their owner's organization."""
        return conversation.get("organization_id") or await self._resolve_organization_id(str(conversation.get("user_id") or ""))

    async def _customer_inbox_audience(self, conversation: dict) -> list[str]:
        """Everyone who should see a customer thread change live: the whole org."""
        organization_id = await self._conversation_organization_id(conversation)
        ids = {str(conversation.get("user_id") or "")}
        if organization_id:
            async for user in self.db.users.find({"organization_id": organization_id}, {"_id": 1}):
                ids.add(str(user["_id"]))
        return [user_id for user_id in ids if user_id]

    async def _calendar_visibility_filter(self, user_id: str) -> dict:
        """Your own events, plus the organization's customer appointments (the AI
        receptionist books them under the owner) - a teammate must be able to see, and so
        move or cancel, what the AI booked."""
        team_ids = await self._resolve_team_user_ids(user_id)
        return {"$or": [{"user_id": user_id}, {"user_id": {"$in": team_ids}, "customer": {"$exists": True}}]}

    # A call the AI handled: an outbound AI call, or any call that got an AI summary or
    # transcript (inbound calls the receptionist answers never carried ai_ready).
    AI_HANDLED_CALL_FILTER = {
        "$or": [{"ai_ready": True}, {"ai_summary": {"$ne": None}}, {"voice_engine": {"$exists": True}}]
    }

    @staticmethod
    def _user_has_global_chat_access(user: dict | None) -> bool:
        if not user:
            return False
        return str(user.get("status") or "active").lower() == "active"

    async def _get_accessible_conversation(self, user_id: str, conversation_id: str, code: str = "CONVERSATION_NOT_FOUND") -> dict:
        if not ObjectId.is_valid(conversation_id):
            raise AppException(status_code=404, code=code, message="Requested resource was not found.")

        # Path 1: owner
        conversation = await self.db.conversations.find_one({"_id": ObjectId(conversation_id), "user_id": user_id})
        if conversation:
            return conversation

        # Path 2: global chat member
        conversation = await self.db.conversations.find_one({"_id": ObjectId(conversation_id), "is_global_chat": True})
        if conversation:
            if conversation.get("is_active", True) is False:
                raise AppException(status_code=404, code=code, message="Requested resource was not found.")
            user = await self._get_user_document(user_id)
            organization_id = user.get("organization_id")
            if (
                not organization_id
                or conversation.get("organization_id") != organization_id
                or user_id not in conversation.get("member_ids", [])
                or not self._user_has_global_chat_access(user)
            ):
                raise AppException(status_code=403, code="GLOBAL_CHAT_ACCESS_DENIED", message="You do not have access to this global chat.")
            return conversation

        # Path 3: a customer thread (WhatsApp/Meta/email/SMS...) is shared by the whole
        # organization - the route has already required messages:view.
        conversation = await self.db.conversations.find_one({"_id": ObjectId(conversation_id)})
        if conversation and self._is_customer_conversation(conversation):
            conversation_org = await self._conversation_organization_id(conversation)
            user = await self._get_user_document(user_id)
            if conversation_org and user.get("organization_id") == conversation_org:
                return conversation

        # Path 4: non-global conversation member (teammate inbox)
        conversation = await self.db.conversations.find_one({"_id": ObjectId(conversation_id), "member_ids": user_id})
        if conversation:
            # Team conversations created after the cross-organization messaging fix
            # carry an organization_id (see ConversationService._assert_members_share_
            # organization); enforce it here too as defense in depth, in case some
            # other write path ever populates member_ids without going through that
            # check. Older conversations predate the field and fall back to the
            # member_ids check above, unchanged.
            conversation_org = conversation.get("organization_id")
            if conversation_org:
                user = await self._get_user_document(user_id)
                if user.get("organization_id") != conversation_org:
                    raise AppException(status_code=404, code=code, message="Requested resource was not found.")
            return conversation

        raise AppException(status_code=404, code=code, message="Requested resource was not found.")

    async def _get_accessible_message(self, user_id: str, message_id: str, code: str = "MESSAGE_NOT_FOUND") -> dict:
        if not ObjectId.is_valid(message_id):
            raise AppException(status_code=404, code=code, message="Requested resource was not found.")

        message = await self.db.messages.find_one({"_id": ObjectId(message_id), "user_id": user_id})
        if message:
            return message

        message = await self.db.messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            raise AppException(status_code=404, code=code, message="Requested resource was not found.")

        await self._get_accessible_conversation(user_id, message.get("conversation_id", ""), "CONVERSATION_NOT_FOUND")
        return message

    def _to_public(self, document: dict | None) -> dict:
        safe = serialize_mongo_document(document) or {}
        if "_id" in safe:
            safe["id"] = safe.pop("_id")
        return safe

    def _to_public_many(self, documents: list[dict]) -> list[dict]:
        return [self._to_public(document) for document in documents]

