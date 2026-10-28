from __future__ import annotations

from bson import ObjectId
from pymongo import ReturnDocument
from app.core.realtime import conversation_realtime_hub
from app.utils.helpers import utc_now


class ConversationGlobalChatMixin:
    async def ensure_global_chat(self, organization_id: str, business_name: str, owner_id: str) -> dict:
        """Ensure a global chat exists for the organization."""
        owner = await self._resolve_global_chat_owner(organization_id, owner_id)
        owner_user_id = str((owner or {}).get("_id") or owner_id or organization_id)
        display_name = business_name or (owner or {}).get("business_name") or (owner or {}).get("full_name") or "Organization"
        group = await self._find_global_chat_group(organization_id, owner_user_id)
        if group:
            group = await self.db.groups.find_one_and_update(
                {"_id": group["_id"]},
                {
                    "$set": {
                        "organization_id": organization_id,
                        "owner_user_id": owner_user_id,
                        "user_id": owner_user_id,
                        "is_global_chat": True,
                        "is_system_managed": True,
                        "is_active": True,
                        "global_chat_type": "organization",
                        "updated_at": utc_now(),
                    }
                },
                return_document=ReturnDocument.AFTER,
            )
            if group.get("conversation_id"):
                await self.db.conversations.update_one(
                    {"_id": ObjectId(group["conversation_id"])},
                    {
                        "$set": {
                            "organization_id": organization_id,
                            "is_global_chat": True,
                            "is_system_managed": True,
                            "is_active": True,
                            "global_chat_type": "organization",
                            "platform": "global_chat",
                            "title": group.get("name") or f"{display_name} Global Chat",
                        }
                    },
                )
                await self._sync_global_chat_member_lists(group["conversation_id"], group.get("member_ids", []))
            return group

        now = utc_now()
        conversation = await self.create_conversation(
            owner_user_id,
            {
                "title": f"{display_name} Global Chat",
                "member_ids": [owner_user_id],
                "type": "group",
                "platform": "global_chat",
                "contact_id": None,
            },
        )
        await self.db.conversations.update_one(
            {"_id": ObjectId(conversation["id"])},
            {
                "$set": {
                    "organization_id": organization_id,
                    "is_global_chat": True,
                    "is_system_managed": True,
                    "is_active": True,
                    "global_chat_type": "organization",
                }
            },
        )
        group_doc = {
            "user_id": owner_user_id,
            "owner_user_id": owner_user_id,
            "name": f"{display_name} Global Chat",
            "avatar_url": None,
            "description": f"Global chat for {display_name}",
            "member_ids": [owner_user_id],
            "admin_ids": [owner_user_id],
            "pending_invites": [],
            "is_active": True,
            "is_global_chat": True,
            "is_system_managed": True,
            "organization_id": organization_id,
            "global_chat_type": "organization",
            "conversation_id": conversation["id"],
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.groups.insert_one(group_doc)
        group_doc["_id"] = result.inserted_id
        return group_doc

    async def sync_user_global_chat_membership(self, user_id: str, organization_id: str | None = None) -> dict | None:
        user = await self._get_user_document(user_id)
        org_id = organization_id or user.get("organization_id")
        if not org_id:
            return None

        owner = await self._resolve_global_chat_owner(org_id, str(user["_id"]))
        business_name = (owner or {}).get("business_name") or (owner or {}).get("full_name") or "Organization"
        await self.ensure_global_chat(org_id, business_name, str((owner or {}).get("_id") or user["_id"]))
        is_eligible = self._user_has_global_chat_access(user) and user.get("organization_id") == org_id

        if is_eligible:
            return await self.add_user_to_global_chat(org_id, user_id)
        return await self.remove_user_from_global_chat(org_id, user_id)

    ROLE_GROUP_LABELS = {"manager": "Manager Group", "staff": "Staff Group", "assistant": "Assistant Group"}

    async def ensure_role_group(self, organization_id: str, owner_id: str, role_slug: str) -> dict:
        """Find or create the organization's standing team group for a role tier
        (staff/manager/assistant), mirroring ensure_global_chat's find-or-create pattern.
        The organization owner is always kept as a member so they can see every team's chat.
        """
        owner = await self._resolve_global_chat_owner(organization_id, owner_id)
        owner_user_id = str((owner or {}).get("_id") or owner_id)

        group = await self.db.groups.find_one({
            "organization_id": organization_id,
            "role_slug": role_slug,
            "is_system_managed": True,
        })
        if group:
            if owner_user_id not in group.get("member_ids", []):
                await self.add_group_members(owner_user_id, str(group["_id"]), {"member_ids": [owner_user_id]})
                group = await self.db.groups.find_one({"_id": group["_id"]})
            return group

        label = self.ROLE_GROUP_LABELS.get(role_slug, f"{role_slug.title()} Group")
        created = await self.create_group(
            owner_user_id,
            {
                "name": label,
                "description": f"Auto-managed group for every {role_slug} on the team.",
                "role_slug": role_slug,
                "member_ids": [owner_user_id],
                "admin_ids": [owner_user_id],
            },
        )
        await self.db.groups.update_one(
            {"_id": ObjectId(created["id"])},
            {"$set": {"organization_id": organization_id, "is_system_managed": True}},
        )
        return await self.db.groups.find_one({"_id": ObjectId(created["id"])})

    async def sync_user_role_group_membership(self, user_id: str, role_slug: str, organization_id: str | None = None) -> dict | None:
        if role_slug not in self.ROLE_GROUP_SLUGS:
            return None

        user = await self._get_user_document(user_id)
        org_id = organization_id or user.get("organization_id")
        if not org_id:
            return None

        owner = await self._resolve_global_chat_owner(org_id, user_id)
        owner_user_id = str((owner or {}).get("_id") or user_id)
        group = await self.ensure_role_group(org_id, owner_user_id, role_slug)

        if user_id not in group.get("member_ids", []):
            group = await self.add_group_members(owner_user_id, str(group["_id"]), {"member_ids": [user_id]})
        return group

    async def backfill_role_groups(self) -> dict:
        """One-time/rerunnable catch-up for accounts created before role-group auto-join
        existed: put every existing staff/manager/assistant into their org's role group."""
        role_users = await self.db.users.find({
            "$or": [
                {"primary_role": {"$in": list(self.ROLE_GROUP_SLUGS)}},
                {"role": {"$in": list(self.ROLE_GROUP_SLUGS)}},
            ]
        }).to_list(length=5000)

        synced_users = 0
        skipped_no_org = 0
        for user in role_users:
            user_id = str(user["_id"])
            org_id = user.get("organization_id")
            role_slug = str(user.get("primary_role") or user.get("role") or "").lower()
            if not org_id or role_slug not in self.ROLE_GROUP_SLUGS:
                skipped_no_org += 1
                continue
            await self.sync_user_role_group_membership(user_id, role_slug, org_id)
            synced_users += 1
        return {"users_synced": synced_users, "skipped_no_org": skipped_no_org}

    async def backfill_global_chats(self) -> dict:
        owners = await self.db.users.find({"$or": [{"primary_role": "owner"}, {"role": "owner"}]}).to_list(length=2000)
        created_or_checked = 0
        synced_users = 0
        for owner in owners:
            owner_id = str(owner["_id"])
            organization_id = owner.get("organization_id") or owner_id
            await self.ensure_global_chat(organization_id, owner.get("business_name") or owner.get("full_name") or "Organization", owner_id)
            created_or_checked += 1
            org_users = await self.db.users.find({"organization_id": organization_id}).to_list(length=2000)
            for org_user in org_users:
                await self.sync_user_global_chat_membership(str(org_user["_id"]), organization_id)
                synced_users += 1
        return {"organizations_processed": created_or_checked, "users_synced": synced_users}

    async def add_user_to_global_chat(self, organization_id: str, user_id: str) -> dict | None:
        """Add a user to the organization's global chat."""
        group = await self._find_global_chat_group(organization_id)
        if not group:
            return None

        member_ids = list(dict.fromkeys([*group.get("member_ids", []), user_id]))
        admin_ids = list(dict.fromkeys(group.get("admin_ids", [])))
        user = await self.db.users.find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
        role_slug = str((user or {}).get("primary_role") or (user or {}).get("role") or "user").lower()
        if role_slug in {"owner", "admin", "manager"}:
            admin_ids = list(dict.fromkeys([*admin_ids, user_id]))
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"member_ids": member_ids, "admin_ids": admin_ids, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        await self._sync_group_conversation(updated)
        await self._sync_global_chat_member_lists(updated.get("conversation_id"), member_ids)
        if updated.get("conversation_id"):
            await conversation_realtime_hub.publish(
                updated["conversation_id"],
                "global_member.added",
                {"user_id": user_id, "organization_id": organization_id},
            )
            await self._publish_global_chat_inbox_updates(
                {"_id": ObjectId(updated["conversation_id"]), "member_ids": member_ids}
            )
        return updated

    async def remove_user_from_global_chat(self, organization_id: str, user_id: str) -> dict | None:
        """Remove a user from the organization's global chat."""
        group = await self._find_global_chat_group(organization_id)
        if not group:
            return None
        user = await self.db.users.find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
        if (
            user
            and user.get("organization_id") == organization_id
            and str(user.get("primary_role") or user.get("role") or "").lower() == "owner"
        ):
            return group

        member_ids = [m for m in group.get("member_ids", []) if m != user_id]
        admin_ids = [m for m in group.get("admin_ids", []) if m != user_id]
        updated = await self.db.groups.find_one_and_update(
            {"_id": group["_id"]},
            {"$set": {"member_ids": member_ids, "admin_ids": admin_ids, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        await self._sync_group_conversation(updated)
        await self._sync_global_chat_member_lists(updated.get("conversation_id"), member_ids)
        if updated.get("conversation_id"):
            await conversation_realtime_hub.publish(
                updated["conversation_id"],
                "global_member.removed",
                {"user_id": user_id, "organization_id": organization_id},
            )
            await conversation_realtime_hub.disconnect_user(updated["conversation_id"], user_id)
            await self._publish_inbox_update(user_id, updated["conversation_id"])
            await self._publish_global_chat_inbox_updates(
                {"_id": ObjectId(updated["conversation_id"]), "member_ids": member_ids}
            )
        return updated
