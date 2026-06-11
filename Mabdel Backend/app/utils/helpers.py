from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId


def utc_now() -> datetime:
    return datetime.now(UTC)


def generate_otp(length: int = 4) -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def to_object_id(value: str) -> ObjectId:
    return ObjectId(value)


def serialize_mongo_document(document: dict[str, Any] | None) -> dict[str, Any] | None:
    if not document:
        return None
    serialized = {**document}
    if "_id" in serialized:
        serialized["_id"] = str(serialized["_id"])
    return serialized


def serialize_mongo_documents(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [serialize_mongo_document(document) or {} for document in documents]


def mask_email(email: str) -> str:
    name, domain = email.split("@")
    if len(name) <= 2:
        masked_name = f"{name[0]}*" if len(name) == 2 else "*"
    else:
        masked_name = f"{name[:2]}***"
    return f"{masked_name}@{domain}"
