from __future__ import annotations

import re
import secrets
from bson import ObjectId
from pymongo import ReturnDocument
from math import ceil
from app.core.exceptions import AppException
from app.utils.helpers import utc_now


class ConversationGroupsMixin:
    # ------------------------------------------------------------------
    # Group chat
    # ------------------------------------------------------------------
    async def create_group(self, user_id: str, payload: dict) -> dict:
        now = utc_now()
        member_ids = await self._normalize_group_member_ids(user_id, payload.get("member_ids", []))
        admin_ids = self._normalize_group_admin_ids(member_ids, payload.get("admin_ids", []))
        conversation = await self.create_conversation(
            user_id,
            {
                "title": payload["name"],
                "member_ids": member_ids,
                "type": "group",
                "platform": "ai",
                "contact_id": None,
            },
        )
        group = {
            "user_id": user_id,
            "owner_user_id": user_id,
            "name": payload["name"],
            "avatar_url": payload.get("avatar_url"),
            "description": payload.get("description"),
            "member_ids": member_ids,
            "admin_ids": admin_ids,
            "role_slug": payload.get("role_slug"),
            "pending_invites": [],
            "is_active": True,
            "conversation_id": conversation["id"],
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.groups.insert_one(group)
        group["_id"] = result.inserted_id
        await self._sync_role_group_membership(user_id, group.get("role_slug"), member_ids, [])
        return await self._serialize_group(group, viewer_user_id=user_id)

    async def get_group(self, user_id: str, group_id: str) -> dict:
        group = await self._get_active_group_for_member(user_id, group_id)
        return await self._serialize_group(group, viewer_user_id=user_id)

    async def list_groups(self, user_id: str, page: int, page_size: int, search: str | None) -> dict:
        filters: dict = {
            "$or": [{"user_id": user_id}, {"member_ids": user_id}],
            "is_active": {"$ne": False},
        }
        if search:
            filters["name"] = {"$regex": re.escape(search.strip()), "$options": "i"}
        cursor = self.db.groups.find(filters).sort("updated_at", -1)
        groups = await cursor.to_list(length=1000)

        user = await self._get_user_document(user_id)
        if self._user_has_global_chat_access(user) and user.get("organization_id"):
            global_filters: dict = {
                "organization_id": user.get("organization_id"),
                "is_global_chat": True,
                "member_ids": user_id,
                "is_active": {"$ne": False},
            }
            if search:
                global_filters["name"] = {"$regex": re.escape(search.strip()), "$options": "i"}
            global_groups = await self.db.groups.find(global_filters).sort("updated_at", -1).to_list(length=10)
            existing_ids = {item["_id"] for item in groups}
            groups.extend([item for item in global_groups if item["_id"] not in existing_ids])

        groups = sorted(groups, key=lambda item: item.get("updated_at") or item.get("created_at"), reverse=True)
        total = len(groups)
        slice_start = (page - 1) * page_size
        groups = groups[slice_start : slice_start + page_size]
        items = [await self._serialize_group(item, include_members=False, viewer_user_id=user_id) for item in groups]
        return {
            "items": items,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": ceil(total / page_size) if page_size else 1,
            },
        }

    async def update_group(self, user_id: str, group_id: str, updates: dict) -> dict:
        group = await self._get_active_group_for_admin(user_id, group_id)
        old_member_ids = set(group.get("member_ids", []))
        old_role_slug = group.get("role_slug")
        clean_updates = {key: value for key, value in updates.items() if value is not None}
        if "member_ids" in clean_updates:
            clean_updates["member_ids"] = await self._normalize_group_member_ids(user_id, clean_updates["member_ids"])
        else:
            clean_updates["member_ids"] = list(dict.fromkeys(group.get("member_ids", [])))
        if "admin_ids" in clean_updates:
            clean_updates["admin_ids"] = self._normalize_group_admin_ids(clean_updates["member_ids"], clean_updates["admin_ids"])
        elif "member_ids" in updates:
            clean_updates["admin_ids"] = self._normalize_group_admin_ids(clean_updates["member_ids"], group.get("admin_ids", []))
        clean_updates["updated_at"] = utc_now()
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": clean_updates},
            return_document=ReturnDocument.AFTER,
        )
        await self._sync_group_conversation(updated, rename_only=not any(key in updates for key in {"member_ids", "admin_ids"}))

        new_member_ids = set(updated.get("member_ids", []))
        new_role_slug = updated.get("role_slug")
        if old_role_slug != new_role_slug:
            if old_role_slug:
                await self._sync_role_group_membership(user_id, old_role_slug, [], list(old_member_ids))
            if new_role_slug:
                await self._sync_role_group_membership(user_id, new_role_slug, list(new_member_ids), [])
        elif new_role_slug:
            added = list(new_member_ids - old_member_ids)
            removed = list(old_member_ids - new_member_ids)
            await self._sync_role_group_membership(user_id, new_role_slug, added, removed)

        return await self._serialize_group(updated, viewer_user_id=user_id)

    async def add_group_members(self, user_id: str, group_id: str, payload: dict) -> dict:
        group = await self._get_active_group_for_admin(user_id, group_id)
        existing_member_ids = set(group.get("member_ids", []))
        member_ids = await self._normalize_group_member_ids(
            user_id,
            [*group.get("member_ids", []), *payload.get("member_ids", [])],
        )
        admin_ids = self._normalize_group_admin_ids(
            member_ids,
            [*group.get("admin_ids", []), *payload.get("admin_ids", [])],
        )
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"member_ids": member_ids, "admin_ids": admin_ids, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        await self._sync_group_conversation(updated)
        newly_added = [member_id for member_id in member_ids if member_id not in existing_member_ids]
        await self._sync_role_group_membership(user_id, group.get("role_slug"), newly_added, [])
        return await self._serialize_group(updated, viewer_user_id=user_id)

    async def update_group_member_role(self, user_id: str, group_id: str, member_id: str, role: str) -> dict:
        group = await self._get_active_group_for_admin(user_id, group_id)
        if member_id not in group.get("member_ids", []):
            raise AppException(status_code=404, code="GROUP_MEMBER_NOT_FOUND", message="Group member was not found.")
        admin_ids = set(group.get("admin_ids", []))
        if role == "admin":
            admin_ids.add(member_id)
        else:
            admin_ids.discard(member_id)
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"admin_ids": sorted(admin_ids), "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return await self._serialize_group(updated, viewer_user_id=user_id)

    async def remove_group_member(self, user_id: str, group_id: str, member_id: str) -> dict:
        group = await self._get_active_group_for_admin(user_id, group_id)
        if member_id not in group.get("member_ids", []):
            raise AppException(status_code=404, code="GROUP_MEMBER_NOT_FOUND", message="Group member was not found.")
        member_ids = [item for item in group.get("member_ids", []) if item != member_id]
        admin_ids = [item for item in group.get("admin_ids", []) if item != member_id]
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"member_ids": member_ids, "admin_ids": admin_ids, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        await self._sync_group_conversation(updated)
        await self._sync_role_group_membership(user_id, group.get("role_slug"), [], [member_id])
        return await self._serialize_group(updated, viewer_user_id=user_id)

    async def invite_group_member(self, user_id: str, group_id: str, payload: dict) -> dict:
        group = await self._get_active_group_for_admin(user_id, group_id)
        pending_invites = list(group.get("pending_invites", []))
        for invite in pending_invites:
            same_email = payload.get("email") and invite.get("email") == payload.get("email")
            same_phone = payload.get("phone") and invite.get("phone") == payload.get("phone")
            if same_email or same_phone:
                raise AppException(status_code=409, code="GROUP_INVITE_EXISTS", message="A pending invite already exists.")
        pending_invites.append(
            {
                "id": secrets.token_hex(8),
                "email": payload.get("email"),
                "phone": payload.get("phone"),
                "name": payload.get("name"),
                "role": payload.get("role", "member"),
                "status": "pending",
                "invited_at": utc_now(),
            }
        )
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"pending_invites": pending_invites, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return await self._serialize_group(updated, viewer_user_id=user_id)

    async def cancel_group_invite(self, user_id: str, group_id: str, invite_id: str) -> dict:
        group = await self._get_active_group_for_admin(user_id, group_id)
        pending_invites = [invite for invite in group.get("pending_invites", []) if invite.get("id") != invite_id]
        if len(pending_invites) == len(group.get("pending_invites", [])):
            raise AppException(status_code=404, code="GROUP_INVITE_NOT_FOUND", message="Group invite was not found.")
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"pending_invites": pending_invites, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return await self._serialize_group(updated, viewer_user_id=user_id)

    async def leave_group(self, user_id: str, group_id: str) -> dict:
        group = await self._get_active_group_for_member(user_id, group_id)
        if group.get("owner_user_id") == user_id or group.get("user_id") == user_id:
            raise AppException(
                status_code=400,
                code="GROUP_OWNER_CANNOT_LEAVE",
                message="The group owner cannot leave this group. Delete it instead.",
            )
        member_ids = [m for m in group.get("member_ids", []) if m != user_id]
        admin_ids = [m for m in group.get("admin_ids", []) if m != user_id]
        now = utc_now()
        
        updates = {"member_ids": member_ids, "admin_ids": admin_ids, "updated_at": now}
        if not member_ids:
            updates["is_active"] = False
            updates["left_at"] = now
            
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        await self._sync_group_conversation(updated)
        return {"id": str(updated["_id"]), "left": True, "left_at": now}
    async def delete_group(self, user_id: str, group_id: str) -> None:
        group = await self._get_active_group_for_admin(user_id, group_id)
        await self._sync_role_group_membership(
            user_id, group.get("role_slug"), [], list(group.get("member_ids", []))
        )
        await self.db.groups.delete_one({"_id": group["_id"]})
        conversation_id = group.get("conversation_id")
        if conversation_id and ObjectId.is_valid(conversation_id):
            await self.db.conversations.delete_one({"_id": ObjectId(conversation_id), "user_id": user_id})
            await self.db.messages.delete_many({"conversation_id": conversation_id, "user_id": user_id})
            await self.db.typing_states.delete_many({"conversation_id": conversation_id, "user_id": user_id})
