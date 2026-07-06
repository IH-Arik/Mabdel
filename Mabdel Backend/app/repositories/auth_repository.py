from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.utils.helpers import utc_now


class AuthRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.users

    async def get_user_by_email(self, email: str) -> dict | None:
        email_clean = email.lower().strip()
        return await self.collection.find_one({
            "$or": [
                {"email": email_clean},
                {"original_email": email_clean}
            ]
        })

    async def get_user_by_id(self, user_id: str) -> dict | None:
        if not ObjectId.is_valid(user_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(user_id)})

    async def create_user(self, full_name: str, email: str, password_hash: str) -> dict:
        now = utc_now()
        user = {
            "full_name": full_name.strip(),
            "email": email.lower().strip(),
            "password_hash": password_hash,
            "is_verified": False,
            "auth_provider": "email",
            "avatar_url": None,
            "date_of_birth": None,
            "country": None,
            "language_preference": "EN",
            # Self-signup no longer grants owner role; owner accounts are created exclusively via admin/superadmin
            "role": "user",
            "primary_role": "user",
            "subscription_status": "active",
            "onboarding_complete": True,
            "organization_id": None,
            "notification_preferences": {
                "general_notification": True,
                "sound": True,
                "vibrate": True,
                "new_messages": True,
                "missed_calls": True,
                "scheduled_calls": True,
                "ai_tasks": True,
                "calendar_reminders": True,
            },
            "device_tokens": [],
            "created_at": now,
            "updated_at": now,
        }
        result = await self.collection.insert_one(user)
        user["_id"] = result.inserted_id
        return user

    async def create_oauth_user(
        self,
        *,
        full_name: str,
        email: str,
        provider: str,
        provider_user_id: str,
        avatar_url: str | None = None,
    ) -> dict:
        now = utc_now()
        user = {
            "full_name": full_name.strip() or email.split("@", 1)[0],
            "email": email.lower().strip(),
            "password_hash": "",
            "is_verified": True,
            "auth_provider": provider,
            "provider_user_id": provider_user_id,
            "avatar_url": avatar_url,
            "date_of_birth": None,
            "country": None,
            "language_preference": "EN",
            # Self-signup no longer grants owner role; owner accounts are created exclusively via admin/superadmin
            "role": "user",
            "primary_role": "user",
            "subscription_status": "active",
            "onboarding_complete": True,
            "organization_id": None,
            "notification_preferences": {
                "general_notification": True,
                "sound": True,
                "vibrate": True,
                "new_messages": True,
                "missed_calls": True,
                "scheduled_calls": True,
                "ai_tasks": True,
                "calendar_reminders": True,
            },
            "device_tokens": [],
            "created_at": now,
            "updated_at": now,
        }
        result = await self.collection.insert_one(user)
        user["_id"] = result.inserted_id
        return user

    async def link_oauth_provider(
        self,
        *,
        email: str,
        provider: str,
        provider_user_id: str,
        avatar_url: str | None = None,
    ) -> dict | None:
        updates = {
            "auth_provider": provider,
            "provider_user_id": provider_user_id,
            "is_verified": True,
            "updated_at": utc_now(),
        }
        if avatar_url:
            updates["avatar_url"] = avatar_url
        return await self.collection.find_one_and_update(
            {"email": email.lower().strip()},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )

    async def mark_user_verified(self, email: str) -> None:
        await self.collection.update_one(
            {"email": email.lower().strip()},
            {"$set": {"is_verified": True, "updated_at": utc_now()}},
        )

    async def update_user_password(self, email: str, password_hash: str) -> None:
        await self.collection.update_one(
            {"email": email.lower().strip()},
            {"$set": {"password_hash": password_hash, "updated_at": utc_now()}},
        )

    async def touch_user(self, user_id: str, updates: dict[str, datetime | str | bool]) -> None:
        if not ObjectId.is_valid(user_id):
            return
        updates["updated_at"] = utc_now()
        await self.collection.update_one({"_id": ObjectId(user_id)}, {"$set": updates})

    async def search_users(
        self,
        *,
        query: str = "",
        organization_id: str | None = None,
        exclude_user_id: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        filter_: dict = {}
        if organization_id:
            filter_["organization_id"] = organization_id
        if exclude_user_id and ObjectId.is_valid(exclude_user_id):
            filter_["_id"] = {"$ne": ObjectId(exclude_user_id)}
        if query.strip():
            pattern = {"$regex": query.strip(), "$options": "i"}
            filter_["$or"] = [{"full_name": pattern}, {"email": pattern}]
        projection = {"full_name": 1, "email": 1, "avatar_url": 1}
        skip = (page - 1) * page_size
        total = await self.collection.count_documents(filter_)
        cursor = self.collection.find(filter_, projection).skip(skip).limit(page_size)
        items = []
        async for doc in cursor:
            full_name = doc.get("full_name") or ""
            parts = full_name.split()
            initials = "".join(p[0].upper() for p in parts[:2]) if parts else "?"
            items.append({
                "id": str(doc["_id"]),
                "name": full_name,
                "email": doc.get("email") or "",
                "avatar_url": doc.get("avatar_url"),
                "initials": initials,
            })
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    async def upsert_device_token(self, user_id: str, device_id: str, token: str, platform: str) -> None:
        if not ObjectId.is_valid(user_id):
            return
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$pull": {"device_tokens": {"device_id": device_id}},
            },
        )
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$push": {
                    "device_tokens": {
                        "device_id": device_id,
                        "token": token,
                        "platform": platform,
                        "updated_at": utc_now(),
                    }
                },
                "$set": {"updated_at": utc_now()},
            },
        )
