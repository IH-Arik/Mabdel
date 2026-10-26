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
        # Reading "latest id" and inserting are two separate steps, so two concurrent
        # onboarding-progress saves for the same device (a double-tap, a retried
        # request) can both compute the same next id and race on the unique index,
        # one of them failing with DuplicateKeyError. An atomic upsert keyed on the
        # caller's own identifier removes the race: whichever request actually wins
        # the insert owns that id, and the loser just updates the row that now
        # exists instead of trying to insert a second one.
        now = datetime.now(UTC)
        if user_id and device_id:
            filter_query: dict = {"$or": [{"user_id": user_id}, {"device_id": device_id}]}
        elif user_id:
            filter_query = {"user_id": user_id}
        else:
            filter_query = {"device_id": device_id}

        next_id = await self._next_progress_id()
        set_on_insert = {
            "id": next_id,
            "is_completed": False,
            "is_skipped": False,
            "completed_at": None,
            "skipped_at": None,
            "created_at": now,
        }
        if user_id is not None:
            set_on_insert["user_id"] = user_id
        if device_id is not None:
            set_on_insert["device_id"] = device_id

        await self.db.onboarding_progress.update_one(
            filter_query,
            {
                "$setOnInsert": set_on_insert,
                "$set": {"current_step": current_step, "last_seen_at": now, "updated_at": now},
            },
            upsert=True,
        )
        return await self.db.onboarding_progress.find_one(filter_query, sort=[("updated_at", -1)])

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
