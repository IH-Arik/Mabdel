from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Any


def utc_now() -> datetime:
    return datetime.now(UTC)


def generate_otp(length: int = 4) -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def serialize_mongo_document(document: dict[str, Any] | None) -> dict[str, Any] | None:
    if not document:
        return None
    serialized = {**document}
    if "_id" in serialized:
        serialized["_id"] = str(serialized["_id"])
        serialized["id"] = serialized["_id"]
    return serialized
