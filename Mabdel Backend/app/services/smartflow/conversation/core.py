from __future__ import annotations

import asyncio
import base64
from bson import ObjectId
from math import ceil
from app.core.exceptions import AppException
from app.utils.helpers import utc_now


class ConversationCoreMixin:
    async def _publish_to_conversation_audience(self, conversation: dict, extra_user_ids: list[str] | None = None) -> None:
        """Refresh the sidebar of everyone who can see this thread: the whole org for a
        shared customer inbox, otherwise its owner and members."""
        if self._is_customer_conversation(conversation):
            audience = set(await self._customer_inbox_audience(conversation))
        else:
            audience = {conversation.get("user_id")} | set(conversation.get("member_ids") or [])
        audience |= set(extra_user_ids or [])
        for viewer_id in audience:
            if not viewer_id:
                continue
            try:
                await self._publish_inbox_update(viewer_id, str(conversation["_id"]), conversation=conversation)
            except Exception:
                continue

    async def _publish_global_chat_inbox_updates(self, conversation: dict) -> None:
        for member_id in conversation.get("member_ids", []):
            try:
                await self._publish_inbox_update(member_id, str(conversation["_id"]))
            except Exception:
                continue

    async def _find_global_chat_group(self, organization_id: str, owner_id: str | None = None) -> dict | None:
        queries = [
            {"organization_id": organization_id, "is_global_chat": True},
            {"owner_user_id": organization_id, "is_global_chat": True},
        ]
        if owner_id:
            queries.extend(
                [
                    {"owner_user_id": owner_id, "is_global_chat": True},
                    {"user_id": owner_id, "is_global_chat": True, "organization_id": {"$exists": False}},
                ]
            )
        for query in queries:
            group = await self.db.groups.find_one(query)
            if group:
                return group
        return None

    async def _resolve_global_chat_owner(self, organization_id: str, fallback_owner_id: str | None = None) -> dict | None:
        owner = await self.db.users.find_one(
            {
                "organization_id": organization_id,
                "$or": [{"primary_role": "owner"}, {"role": "owner"}],
            }
        )
        if owner:
            return owner
        if fallback_owner_id and ObjectId.is_valid(fallback_owner_id):
            return await self.db.users.find_one({"_id": ObjectId(fallback_owner_id)})
        return None

    async def _sync_global_chat_member_lists(self, conversation_id: str, member_ids: list[str]) -> None:
        if not ObjectId.is_valid(conversation_id):
            return
        await self.db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"member_ids": list(dict.fromkeys(member_ids)), "updated_at": utc_now()}},
        )

    async def create_conversation(self, user_id: str, payload: dict) -> dict:
        now = utc_now()
        member_ids = list(dict.fromkeys([user_id, *payload.get("member_ids", [])]))
        conversation_type = payload.get("type", "direct")
        organization_id = None
        if conversation_type == "direct":
            # Only "direct" conversations use member_ids as real platform user ids —
            # create_group (below) reuses this same method with member_ids resolved
            # from _normalize_group_member_ids, which allows contact ids too, so this
            # check would misfire there (a contact id is never a valid user id).
            organization_id = await self._assert_members_share_organization(user_id, member_ids)
        document = {
            "user_id": user_id,
            "title": payload.get("title"),
            "contact_id": payload.get("contact_id"),
            "type": conversation_type,
            "platform": payload.get("platform", "whatsapp"),
            "member_ids": member_ids,
            "archived": False,
            "created_at": now,
            "updated_at": now,
        }
        # Stamped when there are real teammates on the thread, and on every customer
        # thread (it belongs to the organization's shared inbox) - lets
        # _get_accessible_conversation check the organization later.
        if not organization_id and self._is_customer_conversation(document):
            organization_id = (await self._get_user_document(user_id)).get("organization_id")
        if organization_id:
            document["organization_id"] = organization_id
        if self._is_customer_conversation(document):
            document["assigned_to"] = None
            document["last_message_at"] = now
        result = await self.db.conversations.insert_one(document)
        document["_id"] = result.inserted_id
        return await self._serialize_conversation(document, viewer_user_id=user_id)

    async def _assert_members_share_organization(self, user_id: str, member_ids: list[str]) -> str | None:
        """Without this, member_ids taken straight from the request let any signed-up
        user message any other user on the platform by user id alone. A colleague on
        the same business account is always reachable; a user on a *different*
        business is only reachable if the caller has actually saved them as a contact
        (matched by email — the same "linked contact" convention
        _resolve_group_member_user_id already uses for groups) — e.g. Arik's staff can
        message another company's staff member only if that person is in Arik's own
        contact list, never a total stranger picked by id alone.

        Returns the shared organization_id when every other member is a same-org
        colleague, so the caller can stamp it on the conversation document for the
        _get_accessible_conversation fast path — left None when any member was reached
        via the contact-link path instead, since there is then no single organization
        boundary to enforce on later reads (the plain member_ids check already handles
        that mixed case correctly)."""
        others = [member_id for member_id in member_ids if member_id != user_id]
        if not others:
            return None
        organization_id = (await self._get_user_document(user_id)).get("organization_id")
        all_same_org = True
        for member_id in others:
            if not ObjectId.is_valid(member_id):
                raise AppException(
                    status_code=404, code="CONVERSATION_MEMBER_NOT_FOUND", message="One or more members were not found."
                )
            member = await self.db.users.find_one({"_id": ObjectId(member_id)})
            if not member:
                raise AppException(
                    status_code=404, code="CONVERSATION_MEMBER_NOT_FOUND", message="One or more members were not found."
                )
            if organization_id and member.get("organization_id") == organization_id:
                continue
            all_same_org = False
            member_email = member.get("email")
            is_saved_contact = bool(
                member_email and await self.db.contacts.find_one({"user_id": user_id, "email": member_email})
            )
            if not is_saved_contact:
                raise AppException(
                    status_code=403,
                    code="CONVERSATION_MEMBER_NOT_REACHABLE",
                    message="You can only message colleagues on your own business account, or people saved in your contacts.",
                )
        return organization_id if all_same_org else None

    async def get_conversation(self, user_id: str, conversation_id: str) -> dict:
        conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
        return await self._serialize_conversation(conversation, viewer_user_id=user_id)

    async def list_conversations(
        self,
        user_id: str,
        page: int,
        page_size: int,
        search: str | None,
        platform: str | None,
        platforms: list[str] | None,
        archived: bool | None,
        unread_only: bool = False,
        type_filter: str | None = None,
        assignee: str | None = None,
        scope: str | None = None,
    ) -> dict:
        """``scope="team"`` is the internal Messages page (team chats, groups, global chat -
        never customer threads, which would also crowd them out of a 100-item page);
        ``scope="customer"`` is the shared customer inbox; no scope returns both."""
        user = await self._get_user_document(user_id)
        access: list[dict] = [{"user_id": user_id}, {"member_ids": user_id, "is_global_chat": {"$ne": True}}]
        if user.get("organization_id") and scope != "team":
            access.append(self._org_customer_inbox_filter(user["organization_id"]))
        scope_filter: dict = {}
        if scope == "team":
            scope_filter["$nor"] = [self._customer_conversation_clause()]
        elif scope == "customer":
            scope_filter.update(self._customer_conversation_clause())
        filters: dict = {"$or": access, **scope_filter}
        if assignee == "me":
            filters["assigned_to"] = user_id
        elif assignee == "unassigned":
            filters["assigned_to"] = {"$in": [None, ""]}
        platform_values = [value for value in (platforms or []) if value]
        if platform:
            platform_values.insert(0, platform)
        platform_values = list(dict.fromkeys(platform_values))
        if len(platform_values) == 1:
            filters["platform"] = platform_values[0]
        elif platform_values:
            filters["platform"] = {"$in": platform_values}
        if platform and not platform_values:
            filters["platform"] = platform
        if archived is not None:
            filters["archived"] = archived
        if type_filter:
            filters["type"] = type_filter
        # Newest real message first; updated_at is bumped by archive/read/member edits
        # and by the moment a history import created the thread, so it can't order.
        conversations = await self.db.conversations.find(filters).sort(
            [("last_message_at", -1), ("updated_at", -1)]
        ).to_list(length=2000)

        if (
            self._user_has_global_chat_access(user)
            and user.get("organization_id")
            and assignee not in ("me", "unassigned")
            and scope != "customer"
        ):
            global_chat_filters: dict = {
                "organization_id": user.get("organization_id"),
                "is_global_chat": True,
                "member_ids": user_id,
                "is_active": {"$ne": False},
            }
            if len(platform_values) == 1:
                global_chat_filters["platform"] = platform_values[0]
            elif platform_values:
                global_chat_filters["platform"] = {"$in": platform_values}
            if archived is not None:
                global_chat_filters["archived"] = archived
            if type_filter:
                global_chat_filters["type"] = type_filter
            global_chats = await self.db.conversations.find(global_chat_filters).sort("updated_at", -1).to_list(length=20)
            existing_ids = {item["_id"] for item in conversations}
            conversations.extend([item for item in global_chats if item["_id"] not in existing_ids])

        if unread_only or search:
            # unread_only/search filter on fields that only exist after full
            # serialization (unread_count, contact_name, last_message_preview, ...),
            # so there's no way to filter before paying for it — same as before.
            items = list(await asyncio.gather(*[self._serialize_conversation(item, viewer_user_id=user_id) for item in conversations]))
            if unread_only:
                items = [item for item in items if item.get("unread_count", 0) > 0]
            if search:
                needle = search.strip().lower()
                items = [item for item in items if self._conversation_matches_search(item, needle)]
            total = len(items)
            slice_start = (page - 1) * page_size
            page_items = items[slice_start : slice_start + page_size]
            summary = self._conversation_list_summary(items)
        else:
            # Plain listing (the common case on every page load): fully serializing
            # every fetched conversation before paginating was doing 4-6 extra remote
            # DB round-trips PER conversation for data nobody would see outside the
            # current page. Only fully serialize the page actually being returned.
            # Unread counts for the summary badges (needed for every conversation,
            # not just the current page) used to cost one aggregate query each, and
            # then _serialize_conversation paid for the same query again per page
            # item — a single batched aggregation replaces both, so a page of N
            # conversations goes from up to 2N remote round-trips to 1-2 total.
            # The per-item "latest message" lookup gets the same treatment.
            total = len(conversations)
            slice_start = (page - 1) * page_size
            page_slice = conversations[slice_start : slice_start + page_size]
            unread_counts, latest_messages = await asyncio.gather(
                self._fetch_conversation_unread_counts_batch(conversations, user_id, user_id),
                self._fetch_latest_messages_batch(page_slice),
            )
            contacts_by_key, groups_by_conv_id = await asyncio.gather(
                self._fetch_conversation_contacts_batch(page_slice, latest_messages, user_id),
                self._fetch_conversation_groups_batch(page_slice, user_id),
            )
            member_names_by_id = await self._fetch_group_member_names_batch(page_slice, groups_by_conv_id, user_id)
            page_items = list(await asyncio.gather(*[
                self._serialize_conversation(
                    item,
                    viewer_user_id=user_id,
                    precomputed_unread_count=unread_counts.get(str(item.get("_id") or item.get("id")), 0),
                    precomputed_latest_message=latest_messages.get(str(item.get("_id") or item.get("id"))),
                    has_precomputed_latest_message=True,
                    precomputed_contacts_by_key=contacts_by_key,
                    precomputed_groups_by_conv_id=groups_by_conv_id,
                    precomputed_member_names_by_id=member_names_by_id,
                )
                for item in page_slice
            ]))
            archived_count = await self.db.conversations.count_documents({"$or": access, **scope_filter, "archived": True})
            active_count = await self.db.conversations.count_documents({"$or": access, **scope_filter, "archived": {"$ne": True}})
            summary = {"total_unread": 0, "archived_count": archived_count, "active_count": active_count, "by_platform": {}}
            for conversation in conversations:
                unread_count = unread_counts.get(str(conversation.get("_id") or conversation.get("id")), 0)
                summary["total_unread"] += unread_count
                platform = conversation.get("platform", "unknown")
                summary["by_platform"][platform] = summary["by_platform"].get(platform, 0) + unread_count
        summary.update(await self._inbox_tab_counts(access, user_id))
        return {
            "items": page_items,
            "summary": summary,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": ceil(total / page_size) if page_size else 1,
            },
        }

    async def compose_reply(self, user_id: str, *, action: str, draft: str = "", conversation_id: str | None = None, language: str = "") -> dict:
        """AI writing help for the inbox composer. Unlike /ai/chat this never lands in
        the owner's AI-assistant history - it only returns text for the draft."""
        if action not in self.ai_service.COMPOSE_INSTRUCTIONS:
            raise AppException(status_code=400, code="COMPOSE_ACTION_INVALID", message="Unknown writing action.")
        if action != "draft_reply" and not draft.strip():
            raise AppException(status_code=400, code="COMPOSE_DRAFT_REQUIRED", message="Write something first, then ask the AI to rework it.")
        transcript, channel, customer = "", "", "Customer"
        if conversation_id:
            conversation = await self._get_accessible_conversation(user_id, conversation_id, "CONVERSATION_NOT_FOUND")
            channel = conversation.get("platform") or ""
            customer = conversation.get("title") or customer
            recent = await self.db.messages.find({"conversation_id": conversation_id}).sort("timestamp", -1).limit(12).to_list(12)
            transcript = "\n".join(
                f"{'Business' if message.get('direction') == 'outbound' else customer}: {message.get('content')}"
                for message in reversed(recent)
                if message.get("content")
            )
        if action == "draft_reply" and not transcript:
            raise AppException(status_code=400, code="COMPOSE_NO_CONTEXT", message="There is no conversation to reply to yet.")
        user = await self._get_user_document(user_id)
        text = await asyncio.to_thread(
            self.ai_service.compose_message,
            action,
            draft=draft[:4000],
            transcript=transcript[-6000:],
            channel=channel,
            business_name=user.get("business_name") or "",
            language=language,
        )
        if not text:
            raise AppException(status_code=503, code="AI_UNAVAILABLE", message="The AI writer is not available right now. Try again in a moment.")
        return {"text": text}

    async def transcribe_dictation(self, *, audio_bytes: bytes, mime_type: str, filename: str) -> dict:
        """Speech to text only - for dictating a message. No chat, no workflows."""
        if not audio_bytes:
            raise AppException(status_code=400, code="VOICE_TRANSCRIPTION_FAILED", message="The recording was empty.")
        result = await asyncio.to_thread(
            self.ai_service.transcribe_voice,
            audio_base64=base64.b64encode(audio_bytes).decode("utf-8"),
            audio_mime_type=mime_type or "audio/webm",
            audio_filename=filename or "voice.webm",
        )
        return {"transcript": result["transcript"]}
