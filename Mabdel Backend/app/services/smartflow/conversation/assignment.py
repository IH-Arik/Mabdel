from __future__ import annotations

from bson import ObjectId
from pymongo import ReturnDocument
from app.core.exceptions import AppException
from app.core.realtime import conversation_realtime_hub
from app.core.realtime import inbox_realtime_hub
from app.utils.helpers import utc_now


class ConversationAssignmentMixin:
    async def _require_customer_conversation(self, user_id: str, conversation_id: str) -> dict:
        conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        if not self._is_customer_conversation(conversation):
            raise AppException(status_code=400, code="NOT_A_CUSTOMER_CONVERSATION", message="Only customer conversations can be assigned.")
        return conversation

    async def assign_conversation(self, user_id: str, conversation_id: str, assignee_id: str | None) -> dict:
        conversation = await self._require_customer_conversation(user_id, conversation_id)
        organization_id = await self._conversation_organization_id(conversation)
        assignee = None
        if assignee_id:
            assignee = (
                await self.db.users.find_one({"_id": ObjectId(assignee_id), "organization_id": organization_id}, {"full_name": 1, "email": 1})
                if ObjectId.is_valid(assignee_id) and organization_id
                else None
            )
            if not assignee:
                raise AppException(status_code=404, code="ASSIGNEE_NOT_FOUND", message="That teammate isn't part of this business.")
        updated = await self.db.conversations.find_one_and_update(
            {"_id": conversation["_id"]},
            {"$set": {"assigned_to": assignee_id or None, "assigned_at": utc_now(), "assigned_by": user_id}},
            return_document=ReturnDocument.AFTER,
        )
        await self._publish_to_conversation_audience(updated, extra_user_ids=[user_id])
        if assignee_id and assignee_id != user_id:
            await self.create_notification(
                user_id=assignee_id,
                notification_type="message",
                title="A conversation was assigned to you",
                body=f"{updated.get('title') or 'A customer'} ({self._platform_label(updated.get('platform'))})",
                metadata={"conversation_id": str(updated["_id"])},
            )
        return await self._serialize_conversation(updated, viewer_user_id=user_id)

    async def set_conversation_status(self, user_id: str, conversation_id: str, status: str) -> dict:
        conversation = await self._require_customer_conversation(user_id, conversation_id)
        updated = await self.db.conversations.find_one_and_update(
            {"_id": conversation["_id"]}, {"$set": {"status": status}}, return_document=ReturnDocument.AFTER
        )
        await self._publish_to_conversation_audience(updated, extra_user_ids=[user_id])
        return await self._serialize_conversation(updated, viewer_user_id=user_id)

    async def list_assignable_members(self, user_id: str) -> list[dict]:
        organization_id = (await self._get_user_document(user_id)).get("organization_id")
        if not organization_id:
            return []
        members = []
        async for member in self.db.users.find(
            {"organization_id": organization_id, "status": {"$nin": ["inactive", "suspended", "deleted"]}},
            {"full_name": 1, "email": 1, "role": 1, "avatar_url": 1},
        ).sort("full_name", 1):
            members.append({
                "id": str(member["_id"]),
                "name": member.get("full_name") or member.get("email") or "Member",
                "role": member.get("role"),
                "avatar_url": self._normalize_media_url(member.get("avatar_url")),
            })
        return members

    async def get_conversation_contact_details(self, user_id: str, conversation_id: str) -> dict:
        """The customer behind a thread plus their other threads in this business, found
        by the same phone number or email address (one row per channel stays, but they
        are linked)."""
        conversation = await self._require_customer_conversation(user_id, conversation_id)
        contact = await self.db.contacts.find_one({"_id": ObjectId(conversation["contact_id"])}) if ObjectId.is_valid(conversation["contact_id"]) else None
        if not contact:
            return {"contact": None, "related": []}
        keys = []
        if contact.get("phone"):
            keys.append({"phone": contact["phone"]})
        if contact.get("email"):
            keys.append({"email": contact["email"]})
        related: list[dict] = []
        if keys:
            team_ids = await self._resolve_team_user_ids(str(conversation.get("user_id") or user_id))
            twin_ids = [
                str(twin["_id"])
                async for twin in self.db.contacts.find({"user_id": {"$in": team_ids}, "$or": keys}, {"_id": 1})
            ]
            async for other in self.db.conversations.find(
                {"contact_id": {"$in": twin_ids}, "_id": {"$ne": conversation["_id"]}, "is_global_chat": {"$ne": True}}
            ).sort("last_message_at", -1).limit(20):
                related.append({
                    "id": str(other["_id"]),
                    "platform": other.get("platform"),
                    "platform_label": self._platform_label(other.get("platform")),
                    "title": other.get("title"),
                    "last_message_at": other.get("last_message_at") or other.get("updated_at"),
                    "archived": bool(other.get("archived")),
                })
        return {
            "contact": {
                "id": str(contact["_id"]),
                "name": contact.get("name"),
                "phone": contact.get("phone"),
                "email": contact.get("email"),
                "avatar_url": self._normalize_media_url(contact.get("avatar_url")),
                "identities": [
                    {"platform": identity.get("platform"), "handle": identity.get("handle")}
                    for identity in contact.get("identities") or []
                ],
            },
            "related": related,
        }

    async def _inbox_tab_counts(self, access: list[dict], user_id: str) -> dict:
        """Tab badges for the whole inbox, independent of the page and the tab being
        viewed: active chats per channel, plus Mine / Unassigned."""
        customer = {"platform": {"$in": sorted(self.CUSTOMER_PLATFORMS)}, "contact_id": {"$nin": [None, ""]}, "is_global_chat": {"$ne": True}}
        by_channel: dict[str, int] = {}
        archived_by_channel: dict[str, int] = {}
        async for row in self.db.conversations.aggregate([
            {"$match": {"$or": access, **customer}},
            {"$group": {"_id": {"platform": "$platform", "archived": {"$eq": ["$archived", True]}}, "count": {"$sum": 1}}},
        ]):
            key = row["_id"]["platform"] or "unknown"
            target = archived_by_channel if row["_id"]["archived"] else by_channel
            target[key] = target.get(key, 0) + row["count"]
        active = {"$or": access, "archived": {"$ne": True}, **customer}
        mine = await self.db.conversations.count_documents({**active, "assigned_to": user_id})
        unassigned = await self.db.conversations.count_documents({**active, "assigned_to": {"$in": [None, ""]}})
        return {
            "conversation_counts": by_channel,
            "archived_conversation_counts": archived_by_channel,
            "assigned_to_me_count": mine,
            "unassigned_count": unassigned,
        }

    async def archive_conversation(self, user_id: str, conversation_id: str, archived: bool) -> dict:
        conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        if conversation.get("is_global_chat"):
            raise AppException(status_code=400, code="GLOBAL_CHAT_ARCHIVE_UNSUPPORTED", message="Global chat cannot be archived individually.")
        if conversation.get("user_id") != user_id and not self._is_customer_conversation(conversation):
            raise AppException(status_code=403, code="CONVERSATION_ARCHIVE_FORBIDDEN", message="Only the conversation owner can archive this conversation.")
        updated = await self.db.conversations.find_one_and_update(
            {"_id": conversation["_id"]},
            {"$set": {"archived": archived, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        if self._is_customer_conversation(updated):
            await self._publish_to_conversation_audience(updated, extra_user_ids=[user_id])
        return await self._serialize_conversation(updated, viewer_user_id=user_id)

    async def delete_conversation(self, user_id: str, conversation_id: str) -> bool:
        conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        if conversation.get("is_global_chat"):
            raise AppException(status_code=400, code="GLOBAL_CHAT_DELETE_UNSUPPORTED", message="Global chat cannot be deleted.")
        if conversation.get("user_id") != user_id and not self._is_customer_conversation(conversation):
            raise AppException(status_code=403, code="CONVERSATION_DELETE_FORBIDDEN", message="Only the conversation owner can delete this conversation.")
        audience = set(await self._customer_inbox_audience(conversation)) if self._is_customer_conversation(conversation) else set()
        await self.db.conversations.delete_one({"_id": conversation["_id"]})
        await self.db.messages.delete_many({"conversation_id": conversation_id})
        for viewer_id in audience - {user_id}:
            await inbox_realtime_hub.publish(viewer_id, "inbox.conversation_deleted", {"conversation_id": conversation_id})
        return True

    async def mark_conversation_read(self, user_id: str, conversation_id: str) -> dict:
        conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        now = utc_now()
        if self._is_shared_member_conversation(conversation):
            await self.db.messages.update_many(
                {"conversation_id": conversation_id, "sender_user_id": {"$ne": user_id}},
                {"$addToSet": {"read_by": user_id}, "$set": {"updated_at": now}},
            )
        else:
            # Messages are stamped with the conversation owner, not the reader - a
            # teammate reading a shared-inbox thread must clear it too.
            await self.db.messages.update_many(
                {"user_id": conversation.get("user_id", user_id), "conversation_id": conversation_id, "unread_count": {"$gt": 0}},
                {"$set": {"status": "read", "unread_count": 0, "read_at": now, "delivered_at": now}},
            )
        refreshed = await self.db.conversations.find_one({"_id": conversation["_id"]})
        serialized = await self._serialize_conversation(refreshed, viewer_user_id=user_id)
        await conversation_realtime_hub.publish(conversation_id, "conversation.read", {"unread_count": 0, "read_at": now})
        if self._is_customer_conversation(conversation):
            await self._publish_to_conversation_audience(refreshed, extra_user_ids=[user_id])
        else:
            await self._publish_inbox_update(user_id, conversation_id)
        return serialized
