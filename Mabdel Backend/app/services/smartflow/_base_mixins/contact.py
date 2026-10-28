from __future__ import annotations

from datetime import date


from app.core.exceptions import AppException


class ContactMixin:
    @staticmethod
    def _normalize_contact_names(payload: dict) -> dict:
        name = str(payload.get("name") or "").strip()
        first_name = str(payload.get("first_name") or "").strip()
        last_name = str(payload.get("last_name") or "").strip()
        if not name:
            name = " ".join(part for part in [first_name, last_name] if part).strip()
        if not first_name and name:
            parts = name.split(" ", 1)
            first_name = parts[0]
            if not last_name and len(parts) > 1:
                last_name = parts[1]
        if not name:
            raise AppException(status_code=422, code="CONTACT_NAME_REQUIRED", message="Contact name is required.")
        return {"name": name, "first_name": first_name or None, "last_name": last_name or None}

    async def _contact_summary(self, user_ids: list[str]) -> dict:
        base = {"user_id": {"$in": user_ids}}
        total = await self.db.contacts.count_documents(base)
        online = await self.db.contacts.count_documents({**base, "presence": "online"})
        with_email = await self.db.contacts.count_documents({**base, "email": {"$nin": [None, ""]}})
        with_phone = await self.db.contacts.count_documents({**base, "phone": {"$nin": [None, ""]}})
        return {
            "total_contacts": total,
            "online_contacts": online,
            "with_email": with_email,
            "with_phone": with_phone,
        }

    def _serialize_contact(self, contact: dict | None) -> dict:
        safe = self._to_public(contact)
        safe.pop("user_id", None)
        names = self._normalize_contact_names(safe)
        safe.update(names)
        safe["presence"] = safe.get("presence") or "offline"
        safe["presence_label"] = safe["presence"].replace("_", " ").title()
        safe["is_online"] = safe["presence"] == "online"
        safe["initials"] = self._contact_initials(safe.get("name"))
        safe["primary_detail"] = safe.get("email") or safe.get("phone")
        safe["avatar_url"] = self._normalize_media_url(safe.get("avatar_url"))
        safe.setdefault("avatar_url", None)
        safe.setdefault("company", None)
        safe.setdefault("job_title", None)
        safe.setdefault("address", None)
        safe.setdefault("date_of_birth", None)
        safe.setdefault("notes", None)
        safe.setdefault("identities", [])
        safe.setdefault("source", None)
        return safe

    @staticmethod
    def _contact_date_to_iso(value) -> str | None:
        if value is None or value == "":
            return None
        if isinstance(value, date):
            return value.isoformat()
        return str(value)

    @staticmethod
    def _contact_initials(name: str | None) -> str:
        if not name:
            return "NA"
        parts = [part[:1].upper() for part in name.split() if part.strip()]
        return "".join(parts[:2]) or "NA"

