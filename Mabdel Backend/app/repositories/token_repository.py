from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.utils.helpers import utc_now


class TokenRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.refresh_tokens
        self.used_reset_tokens = db.password_reset_used_tokens

    async def is_password_reset_token_used(self, jti: str) -> bool:
        return await self.used_reset_tokens.find_one({"jti": jti}) is not None

    async def mark_password_reset_token_used(self, jti: str, expires_at: datetime) -> None:
        # Regression: reset tokens were stateless JWTs, valid (and replayable)
        # as many times as wanted until their own expiry - a leaked link (logs,
        # referrers, a shared inbox) let anyone reset the password repeatedly
        # within that window. expires_at matches the token's own "exp" claim,
        # via the TTL index on this field, so the record is cleaned up the
        # moment the token would have expired anyway.
        await self.used_reset_tokens.update_one(
            {"jti": jti},
            {"$setOnInsert": {"jti": jti, "expires_at": expires_at, "used_at": utc_now()}},
            upsert=True,
        )

    async def create_refresh_token(self, user_id: str, token_hash: str, expires_at: datetime) -> dict:
        token = {
            "user_id": user_id,
            "token": token_hash,
            "expires_at": expires_at,
            "is_revoked": False,
            "created_at": utc_now(),
        }
        result = await self.collection.insert_one(token)
        token["_id"] = result.inserted_id
        return token

    async def get_valid_refresh_token(self, token_hash: str) -> dict | None:
        return await self.collection.find_one(
            {
                "token": token_hash,
                "is_revoked": False,
                "expires_at": {"$gt": utc_now()},
            }
        )

    async def revoke_refresh_token(self, token_id: str) -> None:
        if not ObjectId.is_valid(token_id):
            return
        await self.collection.update_one(
            {"_id": ObjectId(token_id)},
            {"$set": {"is_revoked": True}},
        )

    async def revoke_all_user_tokens(self, user_id: str) -> None:
        await self.collection.update_many(
            {"user_id": user_id, "is_revoked": False},
            {"$set": {"is_revoked": True}},
        )
