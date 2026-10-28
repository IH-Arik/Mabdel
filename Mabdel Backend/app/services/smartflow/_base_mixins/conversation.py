from __future__ import annotations

import asyncio
import logging
import re
from datetime import date, datetime, timedelta
from urllib.parse import quote_plus

from bson import ObjectId

from app.core.exceptions import AppException
from app.core.realtime import inbox_realtime_hub
from app.models.rbac_models import ROLE_HIERARCHY
from app.utils.helpers import utc_now

logger = logging.getLogger(__name__)


class ConversationMixin:
    @staticmethod
    def _is_shared_member_conversation(conversation: dict) -> bool:
        """Is this a thread between colleagues rather than an external-channel inbox?

        Unread state on an external channel is a property of the *message* (an inbound
        WhatsApp/SMS is unread until the business reads it), but in a thread with two
        or more members it is a property of the *viewer* — A's message is unread for B
        and already read for A. Those need the per-viewer ``read_by`` model that global
        chat has always used; ``member_ids`` holds every human in the thread, so more
        than one means it is shared.
        """
        if bool(conversation.get("is_global_chat")):
            return True
        return len(conversation.get("member_ids") or []) > 1

    async def _fetch_conversation_unread_count(self, conversation: dict, viewer_id: str | None) -> int:
        """Just the unread-count query, no latest-message/contact/group lookups —
        used for the conversation-list summary badges, which need this number for
        every conversation (not just the current page), so it must stay cheap.
        Mirrors the unread branch inside _serialize_conversation exactly."""
        conversation_id = str(conversation.get("_id") or conversation.get("id"))
        if self._is_shared_member_conversation(conversation) and viewer_id:
            return await self.db.messages.count_documents(
                {
                    "conversation_id": conversation_id,
                    "sender_user_id": {"$ne": viewer_id},
                    "read_by": {"$ne": viewer_id},
                }
            )
        unread_count = await self.db.messages.aggregate(
            [
                {"$match": {"conversation_id": conversation_id, "user_id": conversation.get("user_id")}},
                {"$group": {"_id": None, "total": {"$sum": "$unread_count"}}},
            ]
        ).to_list(length=1)
        return unread_count[0]["total"] if unread_count else 0

    @staticmethod
    def _messages_match_by_owner(conversations: list[dict], conversation_ids: list[str]) -> dict:
        """A $match selecting every message in ``conversation_ids``, scoped to each
        conversation's *own* owner.

        Messages are stamped with the conversation owner's ``user_id`` (see
        ConversationService.create_message), never the sender's. Matching against the
        viewer instead silently returned nothing whenever someone opened a colleague's
        conversation — which is every conversation they were added to as a member —
        so the sidebar showed "No messages" and a zero unread badge on threads that
        were not empty at all.
        """
        wanted = set(conversation_ids)
        ids_by_owner: dict[str, list[str]] = {}
        for conversation in conversations:
            conversation_id = str(conversation.get("_id") or conversation.get("id"))
            if conversation_id in wanted:
                ids_by_owner.setdefault(conversation.get("user_id"), []).append(conversation_id)
        return {
            "$or": [
                {"conversation_id": {"$in": ids}, "user_id": owner_id}
                for owner_id, ids in ids_by_owner.items()
            ]
        }

    async def _fetch_conversation_unread_counts_batch(
        self, conversations: list[dict], owner_user_id: str, viewer_id: str | None
    ) -> dict[str, int]:
        """Batched form of _fetch_conversation_unread_count — one aggregation per
        branch (global vs normal) instead of one remote round-trip per conversation.
        Used by list_conversations, which otherwise pays 2N round-trips just for
        unread counts (once for the summary badges, once again per page item inside
        _serialize_conversation).

        Note the conversations passed in are *not* all owned by the viewer —
        list_conversations also returns threads they are only a member of — so
        messages are matched per conversation owner, not against the viewer."""
        counts: dict[str, int] = {}
        shared_ids: list[str] = []
        normal_ids: list[str] = []
        for conversation in conversations:
            conversation_id = str(conversation.get("_id") or conversation.get("id"))
            counts[conversation_id] = 0
            if self._is_shared_member_conversation(conversation) and viewer_id:
                shared_ids.append(conversation_id)
            else:
                normal_ids.append(conversation_id)

        if shared_ids:
            async for row in self.db.messages.aggregate([
                {"$match": {
                    "conversation_id": {"$in": shared_ids},
                    "sender_user_id": {"$ne": viewer_id},
                    "read_by": {"$ne": viewer_id},
                }},
                {"$group": {"_id": "$conversation_id", "total": {"$sum": 1}}},
            ]):
                counts[row["_id"]] = row["total"]

        if normal_ids:
            async for row in self.db.messages.aggregate([
                {"$match": self._messages_match_by_owner(conversations, normal_ids)},
                {"$group": {"_id": "$conversation_id", "total": {"$sum": "$unread_count"}}},
            ]):
                counts[row["_id"]] = row["total"]

        return counts

    async def _fetch_latest_messages_batch(self, conversations: list[dict]) -> dict[str, dict | None]:
        """Batched form of the per-conversation 'latest message' lookup inside
        _serialize_conversation — one aggregation per branch instead of one
        remote round-trip per conversation. Scoped per conversation owner, not by
        viewer; see _messages_match_by_owner."""
        latest_by_id: dict[str, dict | None] = {}
        global_ids: list[str] = []
        normal_ids: list[str] = []
        for conversation in conversations:
            conversation_id = str(conversation.get("_id") or conversation.get("id"))
            latest_by_id[conversation_id] = None
            if bool(conversation.get("is_global_chat")):
                global_ids.append(conversation_id)
            else:
                normal_ids.append(conversation_id)

        if normal_ids:
            async for row in self.db.messages.aggregate([
                {"$match": self._messages_match_by_owner(conversations, normal_ids)},
                {"$sort": {"timestamp": -1}},
                {"$group": {"_id": "$conversation_id", "doc": {"$first": "$$ROOT"}}},
            ]):
                latest_by_id[row["_id"]] = row["doc"]

        if global_ids:
            async for row in self.db.messages.aggregate([
                {"$match": {"conversation_id": {"$in": global_ids}}},
                {"$sort": {"timestamp": -1}},
                {"$group": {"_id": "$conversation_id", "doc": {"$first": "$$ROOT"}}},
            ]):
                latest_by_id[row["_id"]] = row["doc"]

        return latest_by_id

    async def _serialize_conversation(
        self,
        conversation: dict,
        viewer_user_id: str | None = None,
        precomputed_unread_count: int | None = None,
        precomputed_latest_message: dict | None = None,
        has_precomputed_latest_message: bool = False,
        precomputed_contacts_by_key: dict[str, dict] | None = None,
        precomputed_groups_by_conv_id: dict[str, dict] | None = None,
        precomputed_member_names_by_id: dict[str, str] | None = None,
    ) -> dict:
        safe = self._to_public(conversation)
        viewer_id = viewer_user_id or safe.get("viewer_user_id") or safe.get("user_id")
        is_global_chat = bool(safe.get("is_global_chat"))
        latest_filters = {"conversation_id": safe["id"]}
        if not is_global_chat:
            latest_filters["user_id"] = safe["user_id"]

        async def _fetch_latest():
            return await self.db.messages.find(latest_filters).sort("timestamp", -1).limit(1).to_list(length=1)

        if has_precomputed_latest_message and precomputed_unread_count is not None:
            latest_message = precomputed_latest_message
            unread_total = precomputed_unread_count
        elif precomputed_unread_count is not None:
            latest = await _fetch_latest()
            latest_message = latest[0] if latest else None
            unread_total = precomputed_unread_count
        else:
            latest, unread_total = await asyncio.gather(_fetch_latest(), self._fetch_conversation_unread_count(safe, viewer_id))
            latest_message = latest[0] if latest else None
        latest_sender_name = await self._resolve_message_sender_name(
            viewer_id or safe.get("user_id", ""), latest_message, safe, precomputed_contacts_by_key
        )
        safe["last_message_preview"] = latest_message["content"] if latest_message else None
        safe["last_message_sender_name"] = latest_sender_name
        safe["last_message_direction"] = (latest_message or {}).get("direction")
        safe["last_message_status"] = (latest_message or {}).get("status")
        safe["last_message_delivery_error"] = (latest_message or {}).get("delivery_error")
        safe["last_message_at"] = safe.get("last_message_at") or (latest_message or {}).get("timestamp") or safe.get("updated_at")
        safe["assigned_to"] = safe.get("assigned_to")
        # New (never acted on) / Read / Completed - a lightweight workflow status
        # distinct from message-level read receipts, for the "mark complete" flow on a
        # customer thread (e.g. AI Receptionist messages). Unset on any conversation
        # created before this field existed defaults to "new" rather than requiring a
        # migration.
        safe["status"] = safe.get("status") or "new"
        safe["is_customer_conversation"] = self._is_customer_conversation(conversation)
        # Team chats belong to whoever started them; the whole team manages customer threads.
        safe["can_manage"] = (not is_global_chat) and (
            conversation.get("user_id") == viewer_id or safe["is_customer_conversation"]
        )
        safe["unread_count"] = unread_total
        safe["has_unread"] = safe["unread_count"] > 0
        safe["is_ai_assistant"] = safe.get("type") == "ai"
        safe["is_group"] = safe.get("type") == "group" or is_global_chat
        safe["is_global_chat"] = is_global_chat
        safe["member_count"] = len([member_id for member_id in safe.get("member_ids", []) if member_id != viewer_id])
        safe["display_time_label"] = self._conversation_time_label(latest_message.get("timestamp") if latest_message else safe.get("updated_at"))
        safe["delivery_state"] = self._conversation_delivery_state(latest_message, safe["has_unread"])
        safe["platform_label"] = self._platform_label(safe.get("platform"))
        safe["platform_icon_key"] = self._platform_icon_key(safe.get("platform"))
        safe["platform_badge_color"] = self._platform_badge_color(safe.get("platform"))

        if safe["is_ai_assistant"]:
            # Each AI chat now keeps its own title (auto-named from its first
            # message, see ConversationService._auto_title_from_message) so a
            # ChatGPT-style sidebar of past chats can tell them apart — no longer
            # force-overwritten with one fixed name. contact_name stays the fixed
            # assistant identity (used for the open chat's header/avatar), separate
            # from title (used for the sidebar list entry).
            safe["title"] = safe.get("title") or None
            safe["contact_name"] = "GoCustify AI Assistant"
            safe["avatar_url"] = None
            safe["presence"] = "online"
            safe["presence_label"] = "Online"
            safe["participant_preview"] = []
        elif safe["is_group"]:
            safe["presence"] = "group"
            safe["presence_label"] = "Group"
            if precomputed_groups_by_conv_id is not None:
                group = precomputed_groups_by_conv_id.get(safe["id"])
            else:
                group_filters = {"conversation_id": safe["id"], "is_active": {"$ne": False}}
                if not is_global_chat:
                    group_filters["user_id"] = safe.get("user_id")
                group = await self.db.groups.find_one(group_filters)
            group_members = (group or {}).get("member_ids", safe.get("member_ids", []))
            safe["participant_preview"] = await self._group_participant_preview(
                viewer_id or safe.get("user_id", ""),
                group_members,
                is_global_chat=is_global_chat,
                precomputed_names_by_id=precomputed_member_names_by_id,
            )
            safe["avatar_url"] = self._normalize_media_url((group or {}).get("avatar_url"))
            safe["member_count"] = len(group_members)
            safe["contact_name"] = safe.get("title")
            if latest_sender_name and safe["last_message_preview"]:
                safe["last_message_preview"] = f"{latest_sender_name}: {safe['last_message_preview']}"
        else:
            other_member_id = next(
                (member_id for member_id in safe.get("member_ids", []) if member_id != viewer_id), None
            ) if not safe.get("contact_id") and len(safe.get("member_ids", [])) > 1 else None
            if other_member_id:
                # Team-direct conversation: the display name must be the OTHER
                # member's name relative to whoever is viewing it — the stored
                # `title` is fixed once at creation time from the creator's own
                # point of view, so every other member of the same thread would
                # otherwise see their own name (or the creator's) instead of who
                # they're actually talking to.
                other_name = (precomputed_member_names_by_id or {}).get(other_member_id)
                other_user = None
                if other_name is None and ObjectId.is_valid(other_member_id):
                    other_user = await self.db.users.find_one({"_id": ObjectId(other_member_id)})
                    other_name = (other_user or {}).get("full_name") or (other_user or {}).get("email")
                safe["contact_name"] = other_name or safe.get("title")
                safe["avatar_url"] = self._normalize_media_url((other_user or {}).get("avatar_url")) if other_user else None
                safe["presence"] = "offline"
                safe["presence_label"] = self._presence_label(safe["presence"])
                safe["participant_preview"] = []
            else:
                contact = await self._get_conversation_contact(safe.get("user_id", ""), safe, precomputed_contacts_by_key)
                safe["contact_name"] = contact.get("name") if contact else safe.get("title")
                safe["title"] = safe.get("title") or (contact.get("name") if contact else None)
                safe["avatar_url"] = self._normalize_media_url(contact.get("avatar_url")) if contact else None
                safe["presence"] = (contact or {}).get("presence", "offline")
                safe["presence_label"] = self._presence_label(safe["presence"])
                safe["participant_preview"] = []
        safe.pop("user_id", None)
        safe.pop("viewer_user_id", None)
        return safe

    async def _serialize_message(self, message: dict, viewer_user_id: str | None = None) -> dict:
        safe = self._to_public(message)
        viewer_id = viewer_user_id or safe.get("viewer_user_id") or safe.get("user_id")
        is_global_chat = bool(safe.get("is_global_chat"))
        reply_id = safe.get("reply_to_message_id")
        forward_id = safe.get("forward_from_message_id")
        resolved_viewer_id = viewer_id or safe.get("user_id", "")
        reply_doc, forward_doc, sender, serialized_mentions = await asyncio.gather(
            self._get_optional_owned_message(resolved_viewer_id, reply_id),
            self._get_optional_owned_message(resolved_viewer_id, forward_id),
            self._resolve_message_sender(resolved_viewer_id, safe),
            self._serialize_message_mentions(resolved_viewer_id, safe.get("mentions", [])),
        )
        attachments = safe.get("attachments") or self._legacy_message_attachments(safe.get("media_url"))
        if viewer_id and safe.get("sender_user_id"):
            # Use sender_user_id to determine direction for all conversation types
            safe["sender_is_self"] = safe.get("sender_user_id") == viewer_id
            if is_global_chat:
                safe["direction"] = "outbound" if safe["sender_is_self"] else "inbound"
                safe["is_read"] = safe["sender_is_self"] or viewer_id in (safe.get("read_by") or [])
                safe["read_receipt_label"] = None
            else:
                safe["is_read"] = safe.get("status") == "read" or safe.get("read_at") is not None
                safe["read_receipt_label"] = self._format_read_receipt_label(safe.get("read_at")) if safe["is_read"] else None
                # A team chat is stored from its creator's side ("outbound" for whoever
                # wrote), so every teammate saw every message as their own. Say it from the
                # viewer's side instead, like global chat does. Customer threads (they have
                # a contact) and the owner's own messages keep their stored direction.
                if not safe.get("contact_id"):
                    if safe.get("user_id") != viewer_id:
                        safe["direction"] = "outbound" if safe["sender_is_self"] else "inbound"
                    elif not safe["sender_is_self"]:
                        safe["direction"] = "inbound"
        elif is_global_chat and viewer_id:
            safe["sender_is_self"] = safe.get("sender_user_id") == viewer_id
            safe["direction"] = "outbound" if safe["sender_is_self"] else "inbound"
            safe["is_read"] = safe["sender_is_self"] or viewer_id in (safe.get("read_by") or [])
            safe["read_receipt_label"] = None
        else:
            safe["is_read"] = safe.get("status") == "read" or safe.get("read_at") is not None
            safe["read_receipt_label"] = self._format_read_receipt_label(safe.get("read_at")) if safe["is_read"] else None
        safe["attachments"] = attachments
        safe["attachment_count"] = len(attachments)
        safe["has_attachments"] = bool(attachments)
        safe["mentions"] = serialized_mentions
        safe["status_timestamps"] = {
            "sent_at": safe.get("timestamp"),
            "delivered_at": safe.get("delivered_at"),
            "read_at": safe.get("read_at"),
        }
        safe["reply_to_message_preview"] = self._message_preview(reply_doc)
        safe["forward_from_message_preview"] = self._message_preview(forward_doc)
        safe["sender_name"] = sender.get("name")
        safe["sender_avatar_url"] = self._normalize_media_url(sender.get("avatar_url"))
        safe["sender_presence"] = sender.get("presence")
        safe["sender_is_self"] = sender.get("is_self", False)
        safe.pop("user_id", None)
        safe.pop("viewer_user_id", None)
        return safe

    @staticmethod
    def _conversation_matches_search(item: dict, needle: str) -> bool:
        haystacks = [
            item.get("title") or "",
            item.get("contact_name") or "",
            item.get("last_message_preview") or "",
            item.get("last_message_sender_name") or "",
            " ".join(item.get("participant_preview", [])),
        ]
        return any(needle in value.lower() for value in haystacks)

    def _conversation_list_summary(self, items: list[dict]) -> dict:
        total_unread = sum(item.get("unread_count", 0) for item in items)
        by_platform: dict[str, int] = {}
        for item in items:
            platform = item.get("platform", "unknown")
            by_platform[platform] = by_platform.get(platform, 0) + item.get("unread_count", 0)
        return {"total_unread": total_unread, "by_platform": by_platform}

    async def _get_conversation_contact(
        self, user_id: str, conversation: dict, precomputed_contacts_by_key: dict[str, dict] | None = None
    ) -> dict | None:
        contact_id = conversation.get("contact_id")
        if contact_id and ObjectId.is_valid(contact_id):
            if precomputed_contacts_by_key is not None:
                return precomputed_contacts_by_key.get(contact_id)
            return await self.db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": user_id})
        title = conversation.get("title")
        if title:
            if precomputed_contacts_by_key is not None:
                return precomputed_contacts_by_key.get(f"title:{title}")
            return await self.db.contacts.find_one({"user_id": user_id, "name": title})
        return None

    async def _fetch_conversation_contacts_batch(
        self, conversations: list[dict], latest_messages: dict[str, dict | None], owner_user_id: str
    ) -> dict[str, dict]:
        """Batched form of the contact lookups inside _get_conversation_contact and
        _resolve_message_sender_name — one query each instead of up to 2 per
        conversation. Keyed by contact _id (str), with a 'title:<name>' fallback key
        for conversations resolved by title instead of contact_id."""
        contact_ids: set[str] = set()
        titles_needed: set[str] = set()
        for conversation in conversations:
            conversation_id = str(conversation.get("_id") or conversation.get("id"))
            contact_id = conversation.get("contact_id")
            if contact_id and ObjectId.is_valid(contact_id):
                contact_ids.add(contact_id)
            elif conversation.get("title"):
                titles_needed.add(conversation["title"])
            latest = latest_messages.get(conversation_id)
            if latest:
                msg_contact_id = latest.get("contact_id")
                if msg_contact_id and ObjectId.is_valid(msg_contact_id):
                    contact_ids.add(msg_contact_id)

        contacts_by_key: dict[str, dict] = {}
        if contact_ids:
            oids = [ObjectId(cid) for cid in contact_ids]
            # By id only: these ids come from conversations the viewer can already open,
            # and a shared-inbox thread's contact belongs to whoever connected the
            # channel, not to the teammate viewing it.
            async for contact in self.db.contacts.find({"_id": {"$in": oids}}):
                contacts_by_key[str(contact["_id"])] = contact

        if titles_needed:
            async for contact in self.db.contacts.find({"user_id": owner_user_id, "name": {"$in": list(titles_needed)}}):
                contacts_by_key[f"title:{contact['name']}"] = contact

        return contacts_by_key

    async def _fetch_conversation_groups_batch(
        self, conversations: list[dict], owner_user_id: str
    ) -> dict[str, dict]:
        """Batched form of the per-conversation group-document lookup inside
        _serialize_conversation (used for avatar_url and the authoritative
        member list) — one query per branch instead of one per conversation.
        Keyed by conversation_id."""
        global_ids: list[str] = []
        normal_ids: list[str] = []
        for conversation in conversations:
            is_group = conversation.get("type") == "group" or bool(conversation.get("is_global_chat"))
            if not is_group:
                continue
            conversation_id = str(conversation.get("_id") or conversation.get("id"))
            if conversation.get("is_global_chat"):
                global_ids.append(conversation_id)
            else:
                normal_ids.append(conversation_id)

        groups_by_conv_id: dict[str, dict] = {}
        if normal_ids:
            async for group in self.db.groups.find({
                "conversation_id": {"$in": normal_ids}, "user_id": owner_user_id, "is_active": {"$ne": False}
            }):
                groups_by_conv_id[group["conversation_id"]] = group
        if global_ids:
            async for group in self.db.groups.find({
                "conversation_id": {"$in": global_ids}, "is_active": {"$ne": False}
            }):
                groups_by_conv_id[group["conversation_id"]] = group

        return groups_by_conv_id

    async def _fetch_group_member_names_batch(
        self, conversations: list[dict], groups_by_conv_id: dict[str, dict], owner_user_id: str
    ) -> dict[str, str]:
        """Batched form of the per-member lookups inside _group_participant_preview
        — one query per branch instead of up to 3 sequential round-trips PER group
        conversation (more before the old code's early-exit-at-3 kicked in).
        Keyed by member_id (str) -> display name."""
        global_member_ids: set[str] = set()
        contact_member_ids: set[str] = set()
        for conversation in conversations:
            is_group = conversation.get("type") == "group" or bool(conversation.get("is_global_chat"))
            # A team-direct conversation (two real platform users, no contact_id) also
            # needs its other member's name resolved per-viewer — the stored `title`
            # is fixed at creation time from the creator's own point of view and is
            # wrong for whichever member didn't create it. member_ids on a direct
            # conversation are always real user ids (see
            # ConversationService._assert_members_share_organization), so this reuses
            # the same real-user lookup as global-chat members below, never contacts.
            is_team_direct = (
                conversation.get("type", "direct") == "direct"
                and not conversation.get("contact_id")
                and len(conversation.get("member_ids", [])) > 1
            )
            if is_team_direct:
                for member_id in conversation.get("member_ids", []):
                    if member_id == owner_user_id or not ObjectId.is_valid(member_id):
                        continue
                    global_member_ids.add(member_id)
                continue
            if not is_group:
                continue
            conversation_id = str(conversation.get("_id") or conversation.get("id"))
            group = groups_by_conv_id.get(conversation_id)
            member_ids = (group or {}).get("member_ids", conversation.get("member_ids", []))
            is_global_chat = bool(conversation.get("is_global_chat"))
            for member_id in member_ids:
                if member_id == owner_user_id or not ObjectId.is_valid(member_id):
                    continue
                (global_member_ids if is_global_chat else contact_member_ids).add(member_id)

        names_by_id: dict[str, str] = {}
        if global_member_ids:
            oids = [ObjectId(mid) for mid in global_member_ids]
            async for user in self.db.users.find({"_id": {"$in": oids}}):
                names_by_id[str(user["_id"])] = user.get("full_name") or user.get("email") or "Member"
        if contact_member_ids:
            oids = [ObjectId(mid) for mid in contact_member_ids]
            async for contact in self.db.contacts.find({"_id": {"$in": oids}, "user_id": owner_user_id}):
                if contact.get("name"):
                    names_by_id[str(contact["_id"])] = contact["name"]

        return names_by_id

    async def _publish_inbox_update(self, user_id: str, conversation_id: str, conversation: dict | None = None) -> None:
        if conversation is None:
            try:
                conversation = await self._get_accessible_conversation(user_id, conversation_id)
            except AppException:
                return
        if not conversation:
            return
        serialized, summary = await asyncio.gather(
            self._serialize_conversation(conversation, viewer_user_id=user_id),
            self.get_unread_message_summary(user_id, None),
        )
        await inbox_realtime_hub.publish(
            user_id,
            "inbox.updated",
            {"conversation": serialized, "summary": summary},
        )

    async def get_unread_message_summary(self, user_id: str, platform: str | None) -> dict:
        grouped: list[dict] = []
        filters = {"user_id": user_id}
        if platform:
            filters["platform"] = platform
        direct_grouped = await self.db.messages.aggregate(
            [
                {"$match": filters},
                {"$group": {"_id": "$platform", "unread": {"$sum": "$unread_count"}}},
            ]
        ).to_list(length=20)
        grouped.extend(direct_grouped)

        # Threads with colleagues carry the *owner's* user_id on every message and an
        # unread_count of 0, so the aggregate above cannot see them — they are counted
        # per viewer, the same way global chat is.
        team_filters: dict = {"member_ids": user_id, "is_global_chat": {"$ne": True}}
        if platform:
            team_filters["platform"] = platform
        for chat in await self.db.conversations.find(team_filters).to_list(length=200):
            if not self._is_shared_member_conversation(chat):
                continue
            unread = await self.db.messages.count_documents(
                {
                    "conversation_id": str(chat["_id"]),
                    "sender_user_id": {"$ne": user_id},
                    "read_by": {"$ne": user_id},
                }
            )
            if unread:
                grouped.append({"_id": chat.get("platform", "ai"), "unread": unread})

        user = await self.db.users.find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
        if user and self._user_has_global_chat_access(user) and user.get("organization_id"):
            conversation_filters = {
                "organization_id": user.get("organization_id"),
                "is_global_chat": True,
                "member_ids": user_id,
                "is_active": {"$ne": False},
            }
            if platform:
                conversation_filters["platform"] = platform
            global_chats = await self.db.conversations.find(conversation_filters).to_list(length=20)
            for chat in global_chats:
                unread = await self.db.messages.count_documents(
                    {
                        "conversation_id": str(chat["_id"]),
                        "sender_user_id": {"$ne": user_id},
                        "read_by": {"$ne": user_id},
                    }
                )
                grouped.append({"_id": chat.get("platform", "ai"), "unread": unread})
        by_platform: dict[str, int] = {}
        for item in grouped:
            key = item.get("_id") or "unknown"
            by_platform[key] = by_platform.get(key, 0) + int(item.get("unread", 0))
        return {
            "total_unread": sum(item["unread"] for item in grouped),
            "by_platform": by_platform,
        }

    async def _resolve_message_sender_name(
        self,
        user_id: str,
        latest_message: dict | None,
        conversation: dict,
        precomputed_contacts_by_key: dict[str, dict] | None = None,
    ) -> str | None:
        if not latest_message:
            return None
        if conversation.get("is_global_chat"):
            sender_user_id = latest_message.get("sender_user_id") or latest_message.get("user_id")
            if sender_user_id == user_id:
                return "You"
            if sender_user_id and ObjectId.is_valid(sender_user_id):
                sender = await self.db.users.find_one({"_id": ObjectId(sender_user_id)})
                if sender:
                    return sender.get("full_name") or sender.get("email") or "Member"
        if conversation.get("type") == "ai":
            return "GoCustify AI"
        contact_id = latest_message.get("contact_id")
        if contact_id and ObjectId.is_valid(contact_id):
            if precomputed_contacts_by_key is not None:
                contact = precomputed_contacts_by_key.get(contact_id)
            else:
                contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id)})
            if contact and latest_message.get("direction") != "outbound":
                return contact.get("name")
        if latest_message.get("direction") == "outbound":
            return "You"
        if conversation.get("type") == "group":
            return "Member"
        return conversation.get("title")

    async def _group_participant_preview(
        self,
        user_id: str,
        member_ids: list[str],
        *,
        is_global_chat: bool = False,
        precomputed_names_by_id: dict[str, str] | None = None,
    ) -> list[str]:
        names: list[str] = []
        for member_id in member_ids:
            if member_id == user_id or not ObjectId.is_valid(member_id):
                continue
            if precomputed_names_by_id is not None:
                name = precomputed_names_by_id.get(member_id)
                if name:
                    names.append(name)
            elif is_global_chat:
                member = await self.db.users.find_one({"_id": ObjectId(member_id)})
                if member:
                    names.append(member.get("full_name") or member.get("email") or "Member")
            else:
                contact = await self.db.contacts.find_one({"_id": ObjectId(member_id), "user_id": user_id})
                if contact and contact.get("name"):
                    names.append(contact["name"])
            if len(names) >= 3:
                break
        return names

    @staticmethod
    def _presence_label(presence: str | None) -> str:
        mapping = {
            "online": "Online",
            "offline": "Offline",
            "busy": "Busy",
            "away": "Away",
            "group": "Group",
        }
        return mapping.get((presence or "offline").lower(), "Offline")

    @staticmethod
    def _conversation_delivery_state(latest_message: dict | None, has_unread: bool) -> str | None:
        if not latest_message:
            return None
        if has_unread:
            return "unread"
        if latest_message.get("direction") == "outbound":
            status = latest_message.get("status")
            if status == "read":
                return "read"
            if status == "delivered":
                return "delivered"
            return "sent"
        return "received"

    @staticmethod
    def _platform_label(platform: str | None) -> str:
        labels = {
            "whatsapp": "WhatsApp",
            "facebook_messenger": "Facebook",
            "instagram": "Instagram",
            "linkedin": "LinkedIn",
            "twitter_x": "X",
            "snapchat": "Snapchat",
            "telegram": "Telegram",
            "sms": "SMS",
            "email": "Email",
            "google_business": "Google Business",
            "threads": "Threads",
            "ai": "AI",
            "global_chat": "Global Chat",
        }
        return labels.get(platform or "", "Unknown")

    @staticmethod
    def _platform_icon_key(platform: str | None) -> str:
        mapping = {
            "facebook_messenger": "facebook",
            "twitter_x": "x",
            "google_business": "google",
            "snapchat": "snapchat",
        }
        return mapping.get(platform or "", platform or "unknown")

    @staticmethod
    def _platform_badge_color(platform: str | None) -> str:
        colors = {
            "whatsapp": "#25D366",
            "facebook_messenger": "#1877F2",
            "instagram": "#E4405F",
            "linkedin": "#0A66C2",
            "twitter_x": "#111111",
            "snapchat": "#FFFC00",
            "telegram": "#229ED9",
            "sms": "#3B82F6",
            "email": "#64748B",
            "google_business": "#4285F4",
            "threads": "#101010",
            "ai": "#06B6D4",
            "global_chat": "#10B981",
        }
        return colors.get(platform or "", "#64748B")

    @staticmethod
    def _conversation_time_label(value: datetime | None) -> str | None:
        if not value:
            return None
        now = utc_now()
        current = value if value.tzinfo else value.replace(tzinfo=now.tzinfo)
        delta = now - current
        if delta < timedelta(minutes=1):
            return "Now"
        if delta < timedelta(hours=1):
            return f"{max(1, int(delta.total_seconds() // 60))}m ago"
        if delta < timedelta(days=1):
            return f"{max(1, int(delta.total_seconds() // 3600))}h ago"
        if delta < timedelta(days=2):
            return "Yesterday"
        return current.strftime("%b %d")

    @staticmethod
    def _primary_attachment_url(attachments: list[dict]) -> str | None:
        if not attachments:
            return None
        return attachments[0].get("thumbnail_url") or attachments[0].get("url")

    def _legacy_message_attachments(self, media_url: str | None) -> list[dict]:
        if not media_url:
            return []
        return [{"type": self._guess_attachment_type(media_url), "url": media_url}]

    def _normalize_message_attachments(self, payload: dict) -> list[dict]:
        attachments = [dict(item) for item in payload.get("attachments", [])]
        if not attachments and payload.get("media_url"):
            attachments = self._legacy_message_attachments(payload.get("media_url"))
        for attachment in attachments:
            attachment["type"] = attachment.get("type") or self._guess_attachment_type(
                attachment.get("url"),
                attachment.get("mime_type"),
            )
        return attachments

    async def _normalize_message_mentions(self, user_id: str, mention_ids: list[str]) -> list[str]:
        normalized: list[str] = []
        for mention_id in list(dict.fromkeys(mention_ids or [])):
            if not ObjectId.is_valid(mention_id):
                continue
            contact = await self.db.contacts.find_one({"_id": ObjectId(mention_id), "user_id": user_id})
            if contact:
                normalized.append(mention_id)
        return normalized

    async def _serialize_message_mentions(self, user_id: str, mention_ids: list[str]) -> list[dict]:
        mentions: list[dict] = []
        for mention_id in mention_ids or []:
            if not ObjectId.is_valid(mention_id):
                continue
            contact = await self.db.contacts.find_one({"_id": ObjectId(mention_id), "user_id": user_id})
            if contact:
                mentions.append({"contact_id": mention_id, "name": contact.get("name")})
        return mentions

    async def _resolve_message_sender(self, user_id: str, message: dict) -> dict:
        if message.get("is_global_chat"):
            sender_user_id = message.get("sender_user_id") or message.get("user_id")
            if sender_user_id == user_id:
                return {"name": "You", "avatar_url": None, "presence": "online", "is_self": True}
            if sender_user_id and ObjectId.is_valid(sender_user_id):
                sender = await self.db.users.find_one({"_id": ObjectId(sender_user_id)})
                if sender:
                    return {
                        "name": sender.get("full_name") or sender.get("email") or "Member",
                        "avatar_url": sender.get("avatar_url"),
                        "presence": "online" if self._user_has_global_chat_access(sender) else "offline",
                        "is_self": False,
                    }
            return {"name": "Member", "avatar_url": None, "presence": "offline", "is_self": False}
        sender_user_id = message.get("sender_user_id")
        if sender_user_id and not message.get("contact_id"):
            # No contact_id means this isn't a customer conversation (those always
            # carry one — see email_domain/inbound_service.py) but a team-direct
            # thread between real platform users. Resolve is_self against the
            # *viewer*, not message["direction"], which is fixed at creation time
            # from the original sender's perspective and would otherwise show every
            # teammate's messages as "sent by me" to everyone who reads the thread.
            if sender_user_id == user_id:
                return {"name": "You", "avatar_url": None, "presence": "online", "is_self": True}
            if ObjectId.is_valid(sender_user_id):
                sender = await self.db.users.find_one({"_id": ObjectId(sender_user_id)})
                if sender:
                    return {
                        "name": sender.get("full_name") or sender.get("email") or "Member",
                        "avatar_url": sender.get("avatar_url"),
                        "presence": "offline",
                        "is_self": False,
                    }
            return {"name": "Member", "avatar_url": None, "presence": "offline", "is_self": False}
        if message.get("direction") == "outbound":
            # A customer thread is shared by the team: our side is always "self", but
            # say which teammate wrote it when it wasn't the viewer. Messages sent
            # straight from the linked phone/mailbox arrive through a webhook.
            if message.get("automated"):
                return {"name": "Automatic message", "avatar_url": None, "presence": "online", "is_self": True}
            if message.get("provider_event_id") and message.get("contact_id"):
                return {"name": "Sent outside GoCustify", "avatar_url": None, "presence": "online", "is_self": True}
            if sender_user_id and sender_user_id != user_id and ObjectId.is_valid(sender_user_id):
                sender = await self.db.users.find_one({"_id": ObjectId(sender_user_id)}, {"full_name": 1, "email": 1, "avatar_url": 1})
                if sender:
                    return {
                        "name": sender.get("full_name") or sender.get("email") or "Member",
                        "avatar_url": sender.get("avatar_url"),
                        "presence": "online",
                        "is_self": True,
                    }
            return {"name": "You", "avatar_url": None, "presence": "online", "is_self": True}
        contact_id = message.get("contact_id")
        if contact_id and ObjectId.is_valid(contact_id):
            contact = await self.db.contacts.find_one({"_id": ObjectId(contact_id)})
            if contact:
                return {
                    "name": contact.get("name"),
                    "avatar_url": contact.get("avatar_url"),
                    "presence": contact.get("presence", "offline"),
                    "is_self": False,
                }
        return {"name": "Member", "avatar_url": None, "presence": "offline", "is_self": False}

    @staticmethod
    def _guess_attachment_type(url: str | None, mime_type: str | None = None) -> str:
        hint = f"{mime_type or ''} {url or ''}".lower()
        if any(token in hint for token in ("image/", ".png", ".jpg", ".jpeg", ".gif", ".webp")):
            return "image"
        if any(token in hint for token in ("audio/", ".mp3", ".wav", ".m4a")):
            return "audio"
        if any(token in hint for token in ("video/", ".mp4", ".mov", ".webm")):
            return "video"
        if any(token in hint for token in ("application/pdf", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx")):
            return "document"
        return "file"

    async def _validate_message_links(self, user_id: str, payload: dict) -> None:
        reply_to_message_id = payload.get("reply_to_message_id")
        forward_from_message_id = payload.get("forward_from_message_id")

        if reply_to_message_id:
            reply_message = await self._get_accessible_message(user_id, reply_to_message_id, "MESSAGE_NOT_FOUND")
            if reply_message["conversation_id"] != payload["conversation_id"]:
                raise AppException(
                    status_code=400,
                    code="INVALID_REPLY_TARGET",
                    message="Reply target must belong to the same conversation.",
                )

        if forward_from_message_id:
            await self._get_accessible_message(user_id, forward_from_message_id, "MESSAGE_NOT_FOUND")

    async def _get_optional_owned_message(self, user_id: str, message_id: str | None) -> dict | None:
        if not message_id or not ObjectId.is_valid(message_id):
            return None
        message = await self.db.messages.find_one({"_id": ObjectId(message_id), "user_id": user_id})
        if message:
            return message
        try:
            return await self._get_accessible_message(user_id, message_id, "MESSAGE_NOT_FOUND")
        except AppException:
            return None

    @staticmethod
    def _message_preview(message: dict | None) -> dict | None:
        if not message:
            return None
        return {
            "id": str(message["_id"]),
            "content": message.get("content"),
            "direction": message.get("direction"),
            "timestamp": message.get("timestamp"),
            "status": message.get("status"),
        }

    @staticmethod
    def _format_read_receipt_label(read_at) -> str | None:
        if not read_at:
            return None
        return f"READ {read_at.strftime('%I:%M %p')}"

    @staticmethod
    def _is_future_timestamp(value) -> bool:
        if not value:
            return False
        now = utc_now()
        if getattr(value, "tzinfo", None) is None:
            now = now.replace(tzinfo=None)
        return value > now

    async def _serialize_group(self, group: dict, *, include_members: bool = True, viewer_user_id: str | None = None) -> dict:
        safe = self._to_public(group)
        owner_id = str(safe.get("owner_user_id") or safe.get("user_id") or "")
        member_ids = list(dict.fromkeys(safe.get("member_ids", [])))
        admin_ids = list(dict.fromkeys(safe.get("admin_ids", [])))
        is_global_chat = bool(safe.get("is_global_chat"))
        members = await self._serialize_group_members(owner_id, member_ids, admin_ids, is_global_chat=is_global_chat) if include_members else []
        pending_invites = [
            {
                "id": invite.get("id"),
                "email": invite.get("email"),
                "phone": invite.get("phone"),
                "name": invite.get("name"),
                "role": invite.get("role", "member"),
                "status": invite.get("status", "pending"),
                "invited_at": invite.get("invited_at"),
            }
            for invite in safe.get("pending_invites", [])
        ]
        safe["members"] = members
        safe["pending_invites"] = pending_invites
        safe["member_count"] = len(member_ids)
        safe["pending_invite_count"] = len(pending_invites)
        safe["admin_count"] = len(admin_ids) + 1
        # Only the owner can change a group; anyone else in it can leave it. Without a
        # viewer (internal callers) keep the old "owner view".
        is_owner = viewer_user_id is None or str(viewer_user_id) == owner_id
        safe["can_manage"] = bool(is_owner and not is_global_chat)
        safe["can_leave"] = bool(not is_owner and not is_global_chat and str(viewer_user_id) in member_ids)
        safe["is_system_managed"] = is_global_chat
        safe.pop("user_id", None)
        return safe

    async def _serialize_group_members(self, user_id: str, member_ids: list[str], admin_ids: list[str], *, is_global_chat: bool = False) -> list[dict]:
        members: list[dict] = []
        for member_id in member_ids:
            if not ObjectId.is_valid(member_id):
                continue
            if is_global_chat:
                member = await self.db.users.find_one({"_id": ObjectId(member_id)})
                if not member:
                    continue
                members.append(
                    {
                        "id": str(member["_id"]),
                        "name": member.get("full_name") or member.get("email") or "Unknown",
                        "email": member.get("email"),
                        "phone": member.get("phone_no"),
                        "avatar_url": member.get("avatar_url"),
                        "presence": "online" if self._user_has_global_chat_access(member) else "offline",
                        "role": (
                            "owner"
                            if str(member.get("primary_role") or member.get("role") or "").lower() == "owner"
                            else ("admin" if str(member["_id"]) in admin_ids else "member")
                        ),
                        "status": member.get("status", "active"),
                        "is_self": False,
                    }
                )
            else:
                team_ids = await self._resolve_team_user_ids(user_id)
                contact = await self.db.contacts.find_one({"_id": ObjectId(member_id), "user_id": {"$in": team_ids}})
                if not contact:
                    colleague = await self.db.users.find_one({"_id": ObjectId(member_id)})
                    if colleague and str(colleague["_id"]) in team_ids:
                        members.append(
                            {
                                "id": str(colleague["_id"]),
                                "name": colleague.get("full_name") or colleague.get("email") or "Unknown",
                                "email": colleague.get("email"),
                                "phone": colleague.get("phone_no") or colleague.get("phone_number"),
                                "avatar_url": colleague.get("avatar_url"),
                                "presence": colleague.get("presence", "offline"),
                                "role": "admin" if str(colleague["_id"]) in admin_ids else "member",
                                "status": colleague.get("status", "active"),
                                "is_self": False,
                            }
                        )
                    continue
                safe_contact = self._to_public(contact)
                members.append(
                    {
                        "id": safe_contact["id"],
                        "name": safe_contact.get("name") or "Unknown",
                        "email": safe_contact.get("email"),
                        "phone": safe_contact.get("phone"),
                        "avatar_url": safe_contact.get("avatar_url"),
                        "presence": safe_contact.get("presence", "offline"),
                        "role": "admin" if safe_contact["id"] in admin_ids else "member",
                        "status": "active",
                        "is_self": False,
                    }
                )
        return members

    async def _get_active_owned_group(self, user_id: str, group_id: str) -> dict:
        group = await self._get_owned_document(self.db.groups, user_id, group_id, "GROUP_NOT_FOUND")
        if group.get("is_active", True) is False:
            raise AppException(status_code=404, code="GROUP_NOT_FOUND", message="Requested resource was not found.")
        return group

    async def _get_active_group_for_admin(self, user_id: str, group_id: str) -> dict:
        if not ObjectId.is_valid(group_id):
            raise AppException(status_code=404, code="GROUP_NOT_FOUND", message="Requested resource was not found.")
        group = await self.db.groups.find_one({
            "_id": ObjectId(group_id),
            "$or": [{"owner_user_id": user_id}, {"user_id": user_id}]
        })
        if not group:
            group = await self.db.groups.find_one({"_id": ObjectId(group_id), "is_global_chat": True})
            if group:
                user = await self._get_user_document(user_id)
                if (
                    group.get("organization_id") != user.get("organization_id")
                    or str(user.get("primary_role") or user.get("role") or "").lower() != "owner"
                    or not self._user_has_global_chat_access(user)
                ):
                    group = None
        if not group or group.get("is_active", True) is False:
            raise AppException(status_code=404, code="GROUP_NOT_FOUND", message="Requested resource was not found.")
        return group

    async def _get_active_group_for_member(self, user_id: str, group_id: str) -> dict:
        if not ObjectId.is_valid(group_id):
            raise AppException(status_code=404, code="GROUP_NOT_FOUND", message="Requested resource was not found.")
        group = await self.db.groups.find_one({
            "_id": ObjectId(group_id),
            "$or": [{"owner_user_id": user_id}, {"user_id": user_id}, {"member_ids": user_id}]
        })
        if not group:
            group = await self.db.groups.find_one({"_id": ObjectId(group_id), "is_global_chat": True, "member_ids": user_id})
            if group:
                user = await self._get_user_document(user_id)
                if (
                    group.get("organization_id") != user.get("organization_id")
                    or not self._user_has_global_chat_access(user)
                ):
                    group = None
        if not group or group.get("is_active", True) is False:
            raise AppException(status_code=404, code="GROUP_NOT_FOUND", message="Requested resource was not found.")
        return group

    async def _normalize_group_member_ids(self, user_id: str, member_ids: list[str]) -> list[str]:
        normalized: list[str] = []
        team_ids = await self._resolve_team_user_ids(user_id)
        for member_id in list(dict.fromkeys(member_ids or [])):
            if not ObjectId.is_valid(member_id):
                raise AppException(status_code=400, code="GROUP_MEMBER_INVALID", message="One or more group members are invalid.")
            contact = await self.db.contacts.find_one({"_id": ObjectId(member_id), "user_id": {"$in": team_ids}})
            if not contact:
                user = await self.db.users.find_one({"_id": ObjectId(member_id)})
                if not user:
                    raise AppException(status_code=404, code="GROUP_MEMBER_NOT_FOUND", message="One or more group members were not found.")
                if member_id != user_id and member_id not in team_ids:
                    raise AppException(
                        status_code=403,
                        code="GROUP_MEMBER_OUTSIDE_ORGANIZATION",
                        message="Only your contacts and colleagues can be added to a group.",
                    )
            normalized.append(member_id)
        return normalized

    ROLE_GROUP_SLUGS = {"manager", "staff", "assistant"}

    async def _resolve_group_member_user_id(self, member_id: str) -> str | None:
        """Resolve a group member_id (which may be a contact or a user) to a real platform user id.

        Group members are usually picked from the Contacts list in the UI, so member_id is
        typically a contact _id, not a user _id. RBAC only applies to real accounts, so a
        contact is treated as "linked" when its email matches a registered user's email.
        """
        if not ObjectId.is_valid(member_id):
            return None
        direct_user = await self.db.users.find_one({"_id": ObjectId(member_id)})
        if direct_user:
            return str(direct_user["_id"])
        contact = await self.db.contacts.find_one({"_id": ObjectId(member_id)})
        contact_email = (contact or {}).get("email")
        if not contact_email:
            return None
        linked_user = await self.db.users.find_one({"email": contact_email})
        return str(linked_user["_id"]) if linked_user else None

    async def _sync_role_group_membership(
        self,
        owner_user_id: str,
        role_slug: str | None,
        added_member_ids: list[str],
        removed_member_ids: list[str],
    ) -> None:
        """Keep RBAC role assignments in sync with membership of a role-linked group.

        Groups tagged with a role_slug (manager/staff/assistant) mirror their membership
        into RBAC role assignments for any member that resolves to a registered platform
        user (contacts with no matching account are skipped - RBAC only applies to real accounts).
        """
        if not role_slug or role_slug not in self.ROLE_GROUP_SLUGS:
            return
        if not added_member_ids and not removed_member_ids:
            return

        owner = await self._get_user_document(owner_user_id)
        owner_role_slugs = await self.rbac_service.get_user_role_slugs(
            owner_user_id, (owner or {}).get("role", "user")
        )
        assigner_role = (
            max(owner_role_slugs, key=lambda slug: ROLE_HIERARCHY.get(slug, 0))
            if owner_role_slugs
            else "user"
        )

        # Without organization_id, these assignments were invisible to
        # /owner/team (its query filters by organization_id) even though the
        # member really is in the role group — team management showed way
        # fewer people than actually exist. Same fallback as the dashboard's
        # own "assign role" endpoint: use the owner's own id as their org
        # identity if they don't have one yet, and persist it so it's
        # consistent on every future lookup, not just this one.
        org_id = (owner or {}).get("organization_id")
        if not org_id:
            org_id = owner_user_id
            await self.db.users.update_one(
                {"_id": ObjectId(owner_user_id)} if ObjectId.is_valid(owner_user_id) else {"_id": owner_user_id},
                {"$set": {"organization_id": org_id}},
            )

        for member_id in dict.fromkeys(added_member_ids):
            target_user_id = await self._resolve_group_member_user_id(member_id)
            if not target_user_id:
                continue
            try:
                await self.rbac_service.assign_role_to_user(
                    user_id=target_user_id,
                    role_slug=role_slug,
                    assigned_by=owner_user_id,
                    assigned_by_role=assigner_role,
                    organization_id=org_id,
                )
                # Role-group membership implies org membership, so keep the org's
                # global chat in sync here too — otherwise members added this way
                # (rather than through the admin/rbac invite endpoints, which do
                # call this) never show up in the org-wide Global Chat group.
                await self.sync_user_global_chat_membership(target_user_id, org_id)
            except AppException as exc:
                logger.warning(
                    "Skipped RBAC role sync (assign %s -> %s): %s", target_user_id, role_slug, exc.message
                )

        for member_id in dict.fromkeys(removed_member_ids):
            target_user_id = await self._resolve_group_member_user_id(member_id)
            if not target_user_id:
                continue
            try:
                await self.rbac_service.revoke_role_from_user(
                    user_id=target_user_id,
                    role_slug=role_slug,
                    revoked_by_role=assigner_role,
                )
            except AppException as exc:
                logger.warning(
                    "Skipped RBAC role sync (revoke %s -> %s): %s", target_user_id, role_slug, exc.message
                )

    @staticmethod
    def _normalize_group_admin_ids(member_ids: list[str], admin_ids: list[str]) -> list[str]:
        valid_members = set(member_ids)
        return [member_id for member_id in list(dict.fromkeys(admin_ids or [])) if member_id in valid_members]

    async def _sync_group_conversation(self, group: dict, *, rename_only: bool = False) -> None:
        conversation_id = group.get("conversation_id")
        if not conversation_id or not ObjectId.is_valid(conversation_id):
            return
        updates = {"title": group.get("name"), "updated_at": utc_now()}
        if not rename_only:
            updates["member_ids"] = [group.get("user_id"), *group.get("member_ids", [])]
        await self.db.conversations.update_one(
            {"_id": ObjectId(conversation_id), "user_id": group.get("user_id")},
            {"$set": updates},
        )

    def _serialize_history_item(self, document: dict | None) -> dict:
        safe = self._to_public(document)
        safe["command_type_label"] = self._history_type_label(safe.get("command_type"))
        safe["status_label"] = self._history_status_label(safe.get("status"))
        safe["icon"] = self._history_icon(safe.get("command_type"))
        safe["accent_tone"] = self._history_accent_tone(safe.get("status"))
        safe["date_bucket"] = self._history_date_bucket(safe.get("timestamp"))
        return safe

    def _group_history_items_by_day(self, items: list[dict]) -> dict[str, list[dict]]:
        grouped = {"today": [], "yesterday": [], "older": []}
        for item in items:
            grouped.setdefault(item["date_bucket"], []).append(item)
        return grouped

    @staticmethod
    def _history_type_label(command_type: str | None) -> str:
        labels = {
            "invoice": "Invoices",
            "voice": "AI Voice",
            "email": "Email",
            "report": "Report",
            "message": "Message",
            "agreement": "Agreement",
            "lease": "Lease",
            "calendar": "Calendar",
            "bulk_message": "Bulk Messaging",
            "legal": "Legal",
            "document": "Document",
        }
        return labels.get(command_type or "", "Activity")

    @staticmethod
    def _history_status_label(status: str | None) -> str:
        labels = {
            "completed": "Completed",
            "archived": "Archived",
            "exported": "Exported",
            "delivered": "Delivered",
            "scheduled": "Scheduled",
            "processing": "Processing",
            "failed": "Failed",
        }
        return labels.get(status or "", "Completed")

    @staticmethod
    def _history_icon(command_type: str | None) -> str:
        icons = {
            "invoice": "invoice",
            "voice": "microphone",
            "email": "mail",
            "report": "chart",
            "message": "message",
            "agreement": "document",
            "lease": "document",
            "calendar": "calendar",
            "bulk_message": "send",
            "legal": "document",
            "document": "document",
        }
        return icons.get(command_type or "", "history")

    @staticmethod
    def _history_accent_tone(status: str | None) -> str:
        tones = {
            "completed": "success",
            "archived": "muted",
            "exported": "info",
            "delivered": "success",
            "scheduled": "warning",
            "processing": "info",
            "failed": "danger",
        }
        return tones.get(status or "", "info")

    @staticmethod
    def _history_date_bucket(value: datetime | None) -> str:
        if not value:
            return "older"
        now = utc_now()
        current = value.astimezone(now.tzinfo).date() if value.tzinfo else value.date()
        today = now.date()
        if current == today:
            return "today"
        if current == today - timedelta(days=1):
            return "yesterday"
        return "older"

    @staticmethod
    def _document_command_type(document_type: str | None) -> str:
        mapping = {
            "agreement": "agreement",
            "invoice": "invoice",
            "lease": "lease",
            "others": "document",
        }
        return mapping.get(document_type or "", "document")

    def _with_preview_url(self, document: dict) -> dict:
        if "preview_url" not in document:
            encoded = quote_plus(document.get("file_url", ""))
            document["preview_url"] = f"/api/v1/smartflow/documents/preview?file={encoded}"
        return document

