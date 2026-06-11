from __future__ import annotations

from datetime import UTC, datetime

from motor.motor_asyncio import AsyncIOMotorDatabase


class OnboardingRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def get_active_slides(self) -> list[dict]:
        await self.ensure_default_slides()
        return await self.db.onboarding_slides.find({"is_active": True}).sort([("sort_order", 1), ("id", 1)]).to_list(length=50)

    async def has_active_slides(self) -> bool:
        slides = await self.get_active_slides()
        return len(slides) > 0

    async def get_progress(self, user_id: str | None = None, device_id: str | None = None) -> dict | None:
        if user_id and device_id:
            return await self.db.onboarding_progress.find_one(
                {"$or": [{"user_id": user_id}, {"device_id": device_id}]},
                sort=[("updated_at", -1), ("created_at", -1)],
            )
        if user_id:
            return await self.db.onboarding_progress.find_one(
                {"user_id": user_id},
                sort=[("updated_at", -1), ("created_at", -1)],
            )
        if device_id:
            return await self.db.onboarding_progress.find_one(
                {"device_id": device_id},
                sort=[("updated_at", -1), ("created_at", -1)],
            )
        return None

    async def save_progress(self, progress: dict) -> dict:
        now = datetime.now(UTC)
        if "_id" in progress:
            progress["updated_at"] = now
            await self.db.onboarding_progress.replace_one({"_id": progress["_id"]}, progress)
            return progress

        progress.setdefault("created_at", now)
        progress["updated_at"] = now
        result = await self.db.onboarding_progress.insert_one(progress)
        progress["_id"] = result.inserted_id
        return progress

    async def create_progress(
        self,
        user_id: str | None = None,
        device_id: str | None = None,
        current_step: int = 0,
    ) -> dict:
        now = datetime.now(UTC)
        progress = {
            "id": await self._next_progress_id(),
            "current_step": current_step,
            "is_completed": False,
            "is_skipped": False,
            "completed_at": None,
            "skipped_at": None,
            "last_seen_at": now,
            "created_at": now,
            "updated_at": now,
        }
        if user_id is not None:
            progress["user_id"] = user_id
        if device_id is not None:
            progress["device_id"] = device_id
        return await self.save_progress(progress)

    async def ensure_default_slides(self) -> None:
        count = await self.db.onboarding_slides.count_documents({})
        if count:
            return

        default_slides = [
            {
                "id": 1,
                "title": "Your Complete AI Business Assistant",
                "subtitle": "Run your business with AI",
                "description": "Run your business with AI-powered help across calls, invoices, email, and chat.",
                "image_url": "https://cdn.example.com/onboarding/slide-1.png",
                "sort_order": 1,
                "is_active": True,
            },
            {
                "id": 2,
                "title": "Smart Invoicing",
                "subtitle": "Create, send, and track invoices effortlessly",
                "description": "Create, send, and track invoices effortlessly with AI-powered data entry.",
                "image_url": "https://cdn.example.com/onboarding/slide-2.png",
                "sort_order": 2,
                "is_active": True,
            },
            {
                "id": 3,
                "title": "Secure Payment",
                "subtitle": "Integrated Stripe, Apple Pay, and Google Pay",
                "description": "Fast and secure transactions with modern payment integrations.",
                "image_url": "https://cdn.example.com/onboarding/slide-3.png",
                "sort_order": 3,
                "is_active": True,
            },
        ]
        await self.db.onboarding_slides.insert_many(default_slides)

    async def _next_progress_id(self) -> int:
        latest = await self.db.onboarding_progress.find_one(sort=[("id", -1)])
        return int(latest.get("id", 0) + 1) if latest else 1
