from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId


def utc_now() -> datetime:
    return datetime.now(UTC)


def generate_otp(length: int = 6) -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def to_object_id(value: str) -> ObjectId:
    return ObjectId(value)


def _with_utc_tzinfo(value: Any) -> Any:
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    if isinstance(value, dict):
        return {key: _with_utc_tzinfo(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_with_utc_tzinfo(item) for item in value]
    return value


def serialize_mongo_document(document: dict[str, Any] | None) -> dict[str, Any] | None:
    if not document:
        return None
    serialized = {key: _with_utc_tzinfo(value) for key, value in document.items()}
    if "_id" in serialized:
        serialized["_id"] = str(serialized["_id"])
    return serialized


def serialize_mongo_documents(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [serialize_mongo_document(document) or {} for document in documents]


async def resolve_team_user_ids(db, user_id: str) -> list[str]:
    """Every user_id that shares CRM data visibility with this user: every member of
    the same organization, or just themselves if they aren't scoped to one."""
    if not ObjectId.is_valid(user_id):
        return [user_id]
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"organization_id": 1})
    org_id = (user or {}).get("organization_id")
    if not org_id:
        return [user_id]
    docs = await db.users.find({"organization_id": org_id}, {"_id": 1}).to_list(None)
    ids = {str(d["_id"]) for d in docs}
    ids.add(user_id)
    return list(ids)


def mask_email(email: str) -> str:
    name, domain = email.split("@")
    if len(name) <= 2:
        masked_name = f"{name[0]}*" if len(name) == 2 else "*"
    else:
        masked_name = f"{name[:2]}***"
    return f"{masked_name}@{domain}"
