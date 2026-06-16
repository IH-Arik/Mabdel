from __future__ import annotations

from pymongo import ReturnDocument

from app.utils.helpers import utc_now

from ._base import SmartFlowBase


class ContactService(SmartFlowBase):
    async def list_contacts(self, user_id: str, page: int, page_size: int, search: str | None) -> dict:
        filters = {"user_id": user_id}
        if search:
            filters["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"first_name": {"$regex": search, "$options": "i"}},
                {"last_name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}},
                {"address": {"$regex": search, "$options": "i"}},
                {"notes": {"$regex": search, "$options": "i"}},
                {"identities.handle": {"$regex": search, "$options": "i"}},
            ]
        page_result = await self._paginate(self.db.contacts, filters, page, page_size, "updated_at")
        page_result["items"] = [self._serialize_contact(item) for item in page_result["items"]]
        page_result["summary"] = await self._contact_summary(user_id)
        return page_result

    async def get_contact(self, user_id: str, contact_id: str) -> dict:
        contact = await self._get_owned_document(self.db.contacts, user_id, contact_id, "CONTACT_NOT_FOUND")
        return self._serialize_contact(contact)

    async def create_contact(self, user_id: str, payload: dict) -> dict:
        now = utc_now()
        names = self._normalize_contact_names(payload)
        document = {
            "user_id": user_id,
            "name": names["name"],
            "first_name": names["first_name"],
            "last_name": names["last_name"],
            "email": payload.get("email"),
            "phone": payload.get("phone"),
            "avatar_url": payload.get("avatar_url"),
            "company": payload.get("company"),
            "job_title": payload.get("job_title"),
            "address": payload.get("address"),
            "date_of_birth": self._contact_date_to_iso(payload.get("date_of_birth")),
            "notes": payload.get("notes"),
            "identities": payload.get("identities", []),
            "presence": payload.get("presence") or "offline",
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.contacts.insert_one(document)
        document["_id"] = result.inserted_id
        return self._serialize_contact(document)

    async def update_contact(self, user_id: str, contact_id: str, updates: dict) -> dict:
        contact = await self._get_owned_document(self.db.contacts, user_id, contact_id, "CONTACT_NOT_FOUND")
        clean_updates = {key: value for key, value in updates.items() if value is not None}
        if {"name", "first_name", "last_name"} & set(clean_updates):
            name_payload = {**contact, **clean_updates}
            if "name" not in clean_updates:
                name_payload["name"] = None
            names = self._normalize_contact_names(name_payload)
            clean_updates.update(names)
        if "date_of_birth" in clean_updates:
            clean_updates["date_of_birth"] = self._contact_date_to_iso(clean_updates["date_of_birth"])
        clean_updates["updated_at"] = utc_now()
        updated = await self.db.contacts.find_one_and_update(
            {"_id": contact["_id"]},
            {"$set": clean_updates},
            return_document=ReturnDocument.AFTER,
        )
        return self._serialize_contact(updated)

    async def delete_contact(self, user_id: str, contact_id: str) -> None:
        contact = await self._get_owned_document(self.db.contacts, user_id, contact_id, "CONTACT_NOT_FOUND")
        await self.db.contacts.delete_one({"_id": contact["_id"]})

    async def store_contact_avatar(self, user_id: str, contact_id: str, file_bytes: bytes, content_type: str | None, filename: str | None) -> dict:
        contact = await self._get_owned_document(self.db.contacts, user_id, contact_id, "CONTACT_NOT_FOUND")
        avatar_url = self._store_image_file(
            user_id=user_id,
            folder="contact_avatars",
            file_bytes=file_bytes,
            content_type=content_type,
            filename=filename,
            label="Contact image",
        )
        updated = await self.db.contacts.find_one_and_update(
            {"_id": contact["_id"]},
            {"$set": {"avatar_url": avatar_url, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return self._serialize_contact(updated)
