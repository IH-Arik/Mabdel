"""Serialize a business's booking mutations across workers, with bounded leases."""

from __future__ import annotations

import asyncio
import inspect
import time
import uuid
from contextvars import ContextVar
from datetime import timedelta
from functools import wraps

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.exceptions import AppException
from app.utils.helpers import utc_now

_held = ContextVar("booking_lock", default=None)


def serialized_booking(method):
    signature = inspect.signature(method)

    @wraps(method)
    async def locked(self, *args, **kwargs):
        arguments = signature.bind(self, *args, **kwargs).arguments
        user_id = arguments.get("user_id") or arguments.get("owner_id")
        organization_id = arguments.get(
            "organization_id"
        ) or await self._resolve_organization_id(user_id)
        key = f"booking:{organization_id or user_id}"
        task = asyncio.current_task()
        identity = (id(self.db), key, id(task))
        if _held.get() == identity:
            return await method(self, *args, **kwargs)
        token = uuid.uuid4().hex
        deadline = time.monotonic() + 5
        while True:
            now = utc_now()
            try:
                lease = await self.db.booking_leases.find_one_and_update(
                    {"_id": key, "expires_at": {"$lte": now}},
                    {
                        "$set": {
                            "token": token,
                            "expires_at": now + timedelta(seconds=90),
                        }
                    },
                    upsert=True,
                    return_document=ReturnDocument.AFTER,
                )
                if lease and lease.get("token") == token:
                    break
            except DuplicateKeyError:
                pass
            if time.monotonic() >= deadline:
                raise AppException(
                    status_code=409,
                    code="BOOKING_BUSY",
                    message="Another booking is being processed. Please check availability and try again.",
                )
            await asyncio.sleep(0.05)
        context_token = _held.set(identity)
        try:
            # The operation expires before the lease can be acquired by another worker.
            async with asyncio.timeout(60):
                return await method(self, *args, **kwargs)
        finally:
            _held.reset(context_token)
            await self.db.booking_leases.delete_one({"_id": key, "token": token})

    return locked
