from __future__ import annotations

import re

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
        page_result["items"] = await self._attach_membership_flags([self._serialize_contact(item) for item in page_result["items"]])
        page_result["summary"] = await self._contact_summary(user_id)
        return page_result

    async def get_contact(self, user_id: str, contact_id: str) -> dict:
        contact = await self._get_owned_document(self.db.contacts, user_id, contact_id, "CONTACT_NOT_FOUND")
        items = await self._attach_membership_flags([self._serialize_contact(contact)])
        return items[0]

    async def create_contact(self, user_id: str, payload: dict) -> dict:
        now = utc_now()
        names = self._normalize_contact_names(payload)
        document = {
            "user_id": user_id,
            "name": names["name"],
            "first_name": names["first_name"],
            "last_name": names["last_name"],
            "email": self._normalize_email(payload.get("email")),
            "phone": self._normalize_phone(payload.get("phone")),
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
        items = await self._attach_membership_flags([self._serialize_contact(document)])
        return items[0]

    async def update_contact(self, user_id: str, contact_id: str, updates: dict) -> dict:
        contact = await self._get_owned_document(self.db.contacts, user_id, contact_id, "CONTACT_NOT_FOUND")
        clean_updates = {key: value for key, value in updates.items() if value is not None}
        if {"name", "first_name", "last_name"} & set(clean_updates):
            name_payload = {**contact, **clean_updates}
            if "name" not in clean_updates:
                name_payload["name"] = None
            names = self._normalize_contact_names(name_payload)
            clean_updates.update(names)
        if "email" in clean_updates:
            clean_updates["email"] = self._normalize_email(clean_updates.get("email"))
        if "phone" in clean_updates:
            clean_updates["phone"] = self._normalize_phone(clean_updates.get("phone"))
        if "date_of_birth" in clean_updates:
            clean_updates["date_of_birth"] = self._contact_date_to_iso(clean_updates["date_of_birth"])
        clean_updates["updated_at"] = utc_now()
        updated = await self.db.contacts.find_one_and_update(
            {"_id": contact["_id"]},
            {"$set": clean_updates},
            return_document=ReturnDocument.AFTER,
        )
        items = await self._attach_membership_flags([self._serialize_contact(updated)])
        return items[0]

    async def import_contacts(self, user_id: str, entries: list[dict]) -> dict:
        normalized_entries = []
        invalid_entries = []
        duplicate_entries = []
        imported_items = []
        now = utc_now()

        for index, entry in enumerate(entries, start=1):
            normalized = self._normalize_import_entry(entry, index=index)
            if normalized.get("invalid_reason"):
                invalid_entries.append(normalized)
                continue
            normalized_entries.append(normalized)

        candidate_emails = [entry["email"] for entry in normalized_entries if entry.get("email")]
        candidate_phones = [entry["phone"] for entry in normalized_entries if entry.get("phone")]
        existing_filters = [{"user_id": user_id}]
        or_filters = []
        if candidate_emails:
            or_filters.append({"email": {"$in": candidate_emails}})
        if candidate_phones:
            or_filters.append({"phone": {"$in": candidate_phones}})
        existing_contacts = []
        if or_filters:
            existing_contacts = await self.db.contacts.find(
                {"user_id": user_id, "$or": or_filters},
                {"email": 1, "phone": 1},
            ).to_list(length=1000)

        existing_emails = {self._normalize_email(item.get("email")) for item in existing_contacts if self._normalize_email(item.get("email"))}
        existing_phones = {self._normalize_phone(item.get("phone")) for item in existing_contacts if self._normalize_phone(item.get("phone"))}
        seen_emails: set[str] = set()
        seen_phones: set[str] = set()

        for entry in normalized_entries:
            email = entry.get("email")
            phone = entry.get("phone")
            if email and (email in existing_emails or email in seen_emails):
                duplicate_entries.append(self._import_result_entry(entry, reason="Duplicate email"))
                continue
            if phone and (phone in existing_phones or phone in seen_phones):
                duplicate_entries.append(self._import_result_entry(entry, reason="Duplicate phone"))
                continue

            seen_emails.update([email] if email else [])
            seen_phones.update([phone] if phone else [])

            document = {
                "user_id": user_id,
                "name": entry["name"],
                "first_name": entry["first_name"],
                "last_name": entry["last_name"],
                "email": email,
                "phone": phone,
                "avatar_url": None,
                "company": entry.get("company"),
                "job_title": entry.get("job_title"),
                "address": entry.get("address"),
                "date_of_birth": None,
                "notes": entry.get("notes"),
                "identities": [],
                "presence": "offline",
                "created_at": now,
                "updated_at": now,
            }
            result = await self.db.contacts.insert_one(document)
            document["_id"] = result.inserted_id
            imported_items.append(self._serialize_contact(document))

        imported_items = await self._attach_membership_flags(imported_items)
        return {
            "imported": imported_items,
            "duplicates": duplicate_entries,
            "invalid": [self._import_result_entry(item, reason=item["invalid_reason"]) for item in invalid_entries],
            "summary": {
                "received": len(entries),
                "imported": len(imported_items),
                "duplicates": len(duplicate_entries),
                "invalid": len(invalid_entries),
            },
        }

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
        items = await self._attach_membership_flags([self._serialize_contact(updated)])
        return items[0]

    async def _attach_membership_flags(self, items: list[dict]) -> list[dict]:
        if not items:
            return items

        email_map = {}
        phone_map = {}
        for item in items:
            email = str(item.get("email") or "").strip().lower()
            if email:
                email_map[email] = True

            phone_variants = self._phone_variants(item.get("phone"))
            for value in phone_variants:
                phone_map[value] = True

        if not email_map and not phone_map:
            for item in items:
                item["is_app_user"] = bool(item.get("is_app_user", False))
            return items

        user_filters: list[dict] = []
        if email_map:
            user_filters.append({"email": {"$in": list(email_map.keys())}})
        if phone_map:
            user_filters.extend(
                [
                    {"phone_number": {"$in": list(phone_map.keys())}},
                    {"phone": {"$in": list(phone_map.keys())}},
                    {"phone_no": {"$in": list(phone_map.keys())}},
                ]
            )

        users = await self.db.users.find({"$or": user_filters}, {"email": 1, "phone_number": 1, "phone": 1, "phone_no": 1}).to_list(length=500)

        known_emails = {
            str(user.get("email") or "").strip().lower()
            for user in users
            if str(user.get("email") or "").strip()
        }
        known_phones = set()
        for user in users:
            known_phones.update(self._phone_variants(user.get("phone_number")))
            known_phones.update(self._phone_variants(user.get("phone")))
            known_phones.update(self._phone_variants(user.get("phone_no")))

        for item in items:
            if isinstance(item.get("is_app_user"), bool):
                continue

            email = str(item.get("email") or "").strip().lower()
            phones = self._phone_variants(item.get("phone"))
            item["is_app_user"] = bool((email and email in known_emails) or known_phones.intersection(phones))

        return items

    @staticmethod
    def _phone_variants(value: str | None) -> set[str]:
        raw = str(value or "").strip()
        if not raw:
            return set()

        digits = re.sub(r"[^\d+]", "", raw)
        digit_only = re.sub(r"\D", "", raw)
        variants = {raw}
        if digits:
            variants.add(digits)
        if digit_only:
            variants.add(digit_only)
            if raw.startswith("+"):
                variants.add(f"+{digit_only}")
        return {variant for variant in variants if variant}

    def _normalize_import_entry(self, entry: dict, *, index: int) -> dict:
        raw = dict(entry or {})
        raw_email = raw.get("email")
        raw_phone = raw.get("phone")
        email = self._normalize_email(raw_email)
        phone = self._normalize_phone(raw_phone)
        first_name = str(raw.get("first_name") or "").strip()
        last_name = str(raw.get("last_name") or "").strip()
        name = str(raw.get("name") or "").strip()

        if not name and (first_name or last_name):
            name = " ".join(part for part in [first_name, last_name] if part).strip()
        if not first_name and name:
            parts = name.split(" ", 1)
            first_name = parts[0]
            last_name = last_name or (parts[1] if len(parts) > 1 else "")

        invalid_reason = None
        if email and not self._is_valid_email(email):
            invalid_reason = "Invalid email"
        elif str(raw_phone or "").strip() and not self._is_valid_import_phone(raw_phone):
            invalid_reason = "Invalid phone"
        elif not (name or first_name):
            invalid_reason = "Missing contact name"
        elif not (email or phone):
            invalid_reason = "Missing email or phone"

        return {
            "row_index": index,
            "name": name or first_name,
            "first_name": first_name or None,
            "last_name": last_name or None,
            "email": email,
            "phone": phone,
            "address": str(raw.get("address") or "").strip() or None,
            "notes": str(raw.get("notes") or "").strip() or None,
            "company": str(raw.get("company") or "").strip() or None,
            "job_title": str(raw.get("job_title") or "").strip() or None,
            "invalid_reason": invalid_reason,
        }

    @staticmethod
    def _import_result_entry(entry: dict, *, reason: str) -> dict:
        return {
            "row_index": entry.get("row_index"),
            "name": entry.get("name"),
            "email": entry.get("email"),
            "phone": entry.get("phone"),
            "reason": reason,
        }

    @staticmethod
    def _normalize_email(value: str | None) -> str | None:
        normalized = str(value or "").strip().lower()
        return normalized or None

    @staticmethod
    def _normalize_phone(value: str | None) -> str | None:
        raw = str(value or "").strip()
        if not raw:
            return None
        digits_only = re.sub(r"\D", "", raw)
        if not digits_only:
            return None
        if raw.strip().startswith("+"):
            return f"+{digits_only}"
        return digits_only

    @staticmethod
    def _is_valid_import_phone(value: str | None) -> bool:
        digits_only = re.sub(r"\D", "", str(value or ""))
        return 7 <= len(digits_only) <= 15
