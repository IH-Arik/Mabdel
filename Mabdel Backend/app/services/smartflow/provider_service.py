"""Providers (who a customer's appointment is with) and appointment types (how long
one takes) - what lets the AI receptionist ask "which dentist" and "which service"
instead of pooling every teammate's calendar into one undifferentiated block.

A provider is either a real team member (linked_user_id set - their own calendar is
what gets checked) or a named resource with no GoCustify login of its own (a chair, a
technician who never signs in). Both are org-wide, like contacts and groups.
"""

from __future__ import annotations

from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.utils.helpers import utc_now

from ._base import SmartFlowBase


def _serialize(document: dict | None) -> dict:
    safe = dict(document or {})
    if "_id" in safe:
        safe["id"] = str(safe.pop("_id"))
    safe.pop("user_id", None)
    return safe


class ProviderService(SmartFlowBase):
    # ------------------------------------------------------------------
    # Providers
    # ------------------------------------------------------------------
    async def list_providers(self, user_id: str, *, active_only: bool = False) -> list[dict]:
        team_ids = await self._resolve_team_user_ids(user_id)
        filters: dict = {"user_id": {"$in": team_ids}}
        if active_only:
            filters["active"] = True
        items = await self.db.providers.find(filters).sort("name", 1).to_list(length=200)
        return [_serialize(item) for item in items]

    async def create_provider(self, user_id: str, payload: dict) -> dict:
        linked_user_id = await self._validate_linked_user(user_id, payload.get("linked_user_id"))
        now = utc_now()
        document = {
            "user_id": user_id,
            "name": payload["name"].strip(),
            "role_title": (payload.get("role_title") or "").strip() or None,
            "linked_user_id": linked_user_id,
            "location_ids": await self._validate_resource_ids(user_id, self.db.business_locations, payload.get("location_ids"), "LOCATION_NOT_FOUND"),
            # Unset (None) means "always follows the business's own hours" - the
            # original, still-default behavior. Set only to restrict a specialist
            # further, e.g. a provider who only works Tue/Thu.
            "working_days": self._validate_working_days(payload.get("working_days")),
            "working_hours": payload.get("working_hours"),
            "active": True,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.providers.insert_one(document)
        document["_id"] = result.inserted_id
        return _serialize(document)

    async def update_provider(self, user_id: str, provider_id: str, updates: dict) -> dict:
        provider = await self._get_team_document(self.db.providers, user_id, provider_id, "PROVIDER_NOT_FOUND")
        clean_updates = {key: value for key, value in updates.items() if value is not None}
        if "name" in clean_updates:
            clean_updates["name"] = clean_updates["name"].strip()
        if "role_title" in clean_updates:
            clean_updates["role_title"] = clean_updates["role_title"].strip() or None
        if "linked_user_id" in updates:  # explicit None is meaningful: unlink
            clean_updates["linked_user_id"] = await self._validate_linked_user(user_id, updates["linked_user_id"])
        if "working_days" in updates:  # explicit None is meaningful: back to "follows business hours"
            clean_updates["working_days"] = self._validate_working_days(updates["working_days"])
        if "working_hours" in updates:
            clean_updates["working_hours"] = updates["working_hours"]
        if "location_ids" in updates:
            clean_updates["location_ids"] = await self._validate_resource_ids(user_id, self.db.business_locations, updates["location_ids"], "LOCATION_NOT_FOUND")
        clean_updates["updated_at"] = utc_now()
        updated = await self.db.providers.find_one_and_update(
            {"_id": provider["_id"]}, {"$set": clean_updates}, return_document=ReturnDocument.AFTER
        )
        return _serialize(updated)

    async def delete_provider(self, user_id: str, provider_id: str) -> None:
        provider = await self._get_team_document(self.db.providers, user_id, provider_id, "PROVIDER_NOT_FOUND")
        # Past and future appointments keep pointing at a provider_id that no longer
        # resolves - harmless (they already have their own time on the calendar) -
        # rather than losing the record of who an old appointment was with.
        await self.db.providers.delete_one({"_id": provider["_id"]})

    @staticmethod
    def _validate_working_days(value: list | None) -> list[int] | None:
        if not value:
            return None
        return sorted({int(day) for day in value if isinstance(day, int) and 0 <= day <= 6}) or None

    async def _validate_linked_user(self, user_id: str, linked_user_id: str | None) -> str | None:
        if not linked_user_id:
            return None
        team_ids = await self._resolve_team_user_ids(user_id)
        if linked_user_id not in team_ids:
            raise AppException(
                status_code=400, code="PROVIDER_LINK_INVALID", message="Only a colleague on your team can be linked to a provider."
            )
        return linked_user_id

    # ------------------------------------------------------------------
    # Appointment types
    # ------------------------------------------------------------------
    async def list_appointment_types(self, user_id: str, *, active_only: bool = False) -> list[dict]:
        team_ids = await self._resolve_team_user_ids(user_id)
        filters: dict = {"user_id": {"$in": team_ids}}
        if active_only:
            filters["active"] = True
        items = await self.db.appointment_types.find(filters).sort("name", 1).to_list(length=200)
        return [_serialize(item) for item in items]

    async def create_appointment_type(self, user_id: str, payload: dict) -> dict:
        now = utc_now()
        document = {
            "user_id": user_id,
            "name": payload["name"].strip(),
            "duration_minutes": int(payload["duration_minutes"]),
            # Unset (None/empty) means "any provider can perform this type" - the
            # original, still-default behavior.
            "eligible_provider_ids": await self._validate_resource_ids(user_id, self.db.providers, payload.get("eligible_provider_ids"), "PROVIDER_NOT_FOUND"),
            "eligible_location_ids": await self._validate_resource_ids(user_id, self.db.business_locations, payload.get("eligible_location_ids"), "LOCATION_NOT_FOUND"),
            "active": True,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.appointment_types.insert_one(document)
        document["_id"] = result.inserted_id
        return _serialize(document)

    async def update_appointment_type(self, user_id: str, type_id: str, updates: dict) -> dict:
        appointment_type = await self._get_team_document(self.db.appointment_types, user_id, type_id, "APPOINTMENT_TYPE_NOT_FOUND")
        clean_updates = {key: value for key, value in updates.items() if value is not None}
        if "name" in clean_updates:
            clean_updates["name"] = clean_updates["name"].strip()
        if "duration_minutes" in clean_updates:
            clean_updates["duration_minutes"] = int(clean_updates["duration_minutes"])
        if "eligible_provider_ids" in updates:  # explicit None/[] is meaningful: open to any provider again
            clean_updates["eligible_provider_ids"] = await self._validate_resource_ids(user_id, self.db.providers, updates["eligible_provider_ids"], "PROVIDER_NOT_FOUND")
        if "eligible_location_ids" in updates:
            clean_updates["eligible_location_ids"] = await self._validate_resource_ids(user_id, self.db.business_locations, updates["eligible_location_ids"], "LOCATION_NOT_FOUND")
        clean_updates["updated_at"] = utc_now()
        updated = await self.db.appointment_types.find_one_and_update(
            {"_id": appointment_type["_id"]}, {"$set": clean_updates}, return_document=ReturnDocument.AFTER
        )
        return _serialize(updated)

    async def delete_appointment_type(self, user_id: str, type_id: str) -> None:
        appointment_type = await self._get_team_document(self.db.appointment_types, user_id, type_id, "APPOINTMENT_TYPE_NOT_FOUND")
        await self.db.appointment_types.delete_one({"_id": appointment_type["_id"]})

    # ------------------------------------------------------------------
    # Name resolution (spoken by a caller, matched against what the business set up)
    # ------------------------------------------------------------------
    async def resolve_provider_by_name(self, user_id: str, name: str | None) -> dict | None:
        if not name or not name.strip():
            return None
        import re

        team_ids = await self._resolve_team_user_ids(user_id)
        document = await self.db.providers.find_one(
            {"user_id": {"$in": team_ids}, "active": True, "name": {"$regex": f"^{re.escape(name.strip())}$", "$options": "i"}}
        )
        return _serialize(document) if document else None

    async def resolve_appointment_type_by_name(self, user_id: str, name: str | None) -> dict | None:
        if not name or not name.strip():
            return None
        import re

        team_ids = await self._resolve_team_user_ids(user_id)
        document = await self.db.appointment_types.find_one(
            {"user_id": {"$in": team_ids}, "active": True, "name": {"$regex": f"^{re.escape(name.strip())}$", "$options": "i"}}
        )
        return _serialize(document) if document else None

    async def _validate_resource_ids(self, user_id, collection, ids, code):
        if not ids:
            return None
        for resource_id in ids:
            await self._get_team_document(collection, user_id, resource_id, code)
        return list(dict.fromkeys(ids))

    async def list_locations(self, user_id: str, *, active_only: bool = False) -> list[dict]:
        filters = {"user_id": {"$in": await self._resolve_team_user_ids(user_id)}}
        if active_only:
            filters["active"] = True
        return [_serialize(item) for item in await self.db.business_locations.find(filters).sort("name", 1).to_list(length=200)]

    async def create_location(self, user_id: str, payload: dict) -> dict:
        now = utc_now()
        document = {**payload, "name": payload["name"].strip(), "user_id": user_id, "active": True, "created_at": now, "updated_at": now}
        if not document["name"]:
            raise AppException(status_code=400, code="LOCATION_NAME_REQUIRED", message="Enter a location name.")
        await self._assert_unique_location_name(user_id, document["name"])
        result = await self.db.business_locations.insert_one(document)
        document["_id"] = result.inserted_id
        return _serialize(document)

    async def update_location(self, user_id: str, location_id: str, updates: dict) -> dict:
        location = await self._get_team_document(self.db.business_locations, user_id, location_id, "LOCATION_NOT_FOUND")
        if "name" in updates and updates["name"] is not None:
            updates["name"] = updates["name"].strip()
            if not updates["name"]:
                raise AppException(status_code=400, code="LOCATION_NAME_REQUIRED", message="Enter a location name.")
            await self._assert_unique_location_name(user_id, updates["name"], location_id)
        updates["updated_at"] = utc_now()
        result = await self.db.business_locations.find_one_and_update({"_id": location["_id"]}, {"$set": updates}, return_document=ReturnDocument.AFTER)
        return _serialize(result)

    async def delete_location(self, user_id: str, location_id: str) -> None:
        # Retain a resolvable reference for historical appointments.
        await self.update_location(user_id, location_id, {"active": False})

    async def resolve_location_by_name(self, user_id: str, name: str | None) -> dict | None:
        if not name or not name.strip():
            return None
        import re
        document = await self.db.business_locations.find_one({
            "user_id": {"$in": await self._resolve_team_user_ids(user_id)}, "active": True,
            "name": {"$regex": f"^{re.escape(name.strip())}$", "$options": "i"},
        })
        return _serialize(document) if document else None

    async def _assert_unique_location_name(self, user_id, name, exclude_id=None):
        import re
        from bson import ObjectId
        filters = {"user_id": {"$in": await self._resolve_team_user_ids(user_id)}, "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}
        if exclude_id:
            filters["_id"] = {"$ne": ObjectId(exclude_id)}
        if await self.db.business_locations.find_one(filters):
            raise AppException(status_code=409, code="LOCATION_NAME_EXISTS", message="A location with this name already exists. Choose a distinct location name.")
