from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.utils.helpers import utc_now


class TokenRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.refresh_tokens

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
