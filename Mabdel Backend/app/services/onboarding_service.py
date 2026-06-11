from __future__ import annotations

from datetime import UTC, datetime

from starlette import status

from app.core.exceptions import AppException
from app.repositories.onboarding_repository import OnboardingRepository
from app.schemas.onboarding import (
    OnboardingActionRequest,
    OnboardingProgressResponse,
    OnboardingProgressUpsertRequest,
    OnboardingSlideResponse,
)


class OnboardingService:
    def __init__(self, onboarding_repository: OnboardingRepository) -> None:
        self.onboarding_repository = onboarding_repository

    async def get_slides(self) -> list[OnboardingSlideResponse]:
        slides = await self.onboarding_repository.get_active_slides()
        return [
            OnboardingSlideResponse(
                id=slide["id"],
                title=slide["title"],
                subtitle=slide.get("subtitle"),
                description=slide.get("description"),
                image_url=slide.get("image_url"),
                sort_order=slide["sort_order"],
            )
            for slide in slides
        ]

    async def get_progress(self, user_id: str | None, device_id: str | None) -> OnboardingProgressResponse:
        self._validate_identifier(user_id=user_id, device_id=device_id)

        progress = await self.onboarding_repository.get_progress(user_id=user_id, device_id=device_id)
        if not progress:
            return OnboardingProgressResponse(user_id=user_id, device_id=device_id, current_step=0)
        return self._to_schema(progress)

    async def upsert_progress(self, payload: OnboardingProgressUpsertRequest) -> OnboardingProgressResponse:
        progress = await self._get_or_create_progress(
            user_id=payload.user_id,
            device_id=payload.device_id,
            current_step=payload.current_step,
        )

        progress["current_step"] = payload.current_step
        progress["last_seen_at"] = datetime.now(UTC)
        progress = await self.onboarding_repository.save_progress(progress)
        return self._to_schema(progress)

    async def mark_skipped(self, payload: OnboardingActionRequest) -> OnboardingProgressResponse:
        progress = await self._get_or_create_progress(
            user_id=payload.user_id,
            device_id=payload.device_id,
            current_step=payload.current_step,
        )

        if progress.get("is_completed"):
            raise AppException(
                status_code=status.HTTP_409_CONFLICT,
                code="ONBOARDING_ALREADY_COMPLETED",
                message="Completed onboarding cannot be marked as skipped.",
            )

        if not progress.get("is_skipped"):
            progress["is_skipped"] = True
            progress["skipped_at"] = datetime.now(UTC)
        progress["current_step"] = payload.current_step
        progress["last_seen_at"] = datetime.now(UTC)

        progress = await self.onboarding_repository.save_progress(progress)
        return self._to_schema(progress)

    async def mark_completed(self, payload: OnboardingActionRequest) -> OnboardingProgressResponse:
        progress = await self._get_or_create_progress(
            user_id=payload.user_id,
            device_id=payload.device_id,
            current_step=payload.current_step,
        )

        if progress.get("is_completed"):
            raise AppException(
                status_code=status.HTTP_409_CONFLICT,
                code="ONBOARDING_ALREADY_COMPLETED",
                message="Onboarding is already completed. Reset it before completing again.",
            )

        progress["current_step"] = payload.current_step
        progress["is_completed"] = True
        progress["is_skipped"] = False
        progress["completed_at"] = datetime.now(UTC)
        progress["skipped_at"] = None
        progress["last_seen_at"] = datetime.now(UTC)

        progress = await self.onboarding_repository.save_progress(progress)
        return self._to_schema(progress)

    async def reset_progress(self, payload: OnboardingActionRequest) -> OnboardingProgressResponse:
        progress = await self._get_or_create_progress(
            user_id=payload.user_id,
            device_id=payload.device_id,
            current_step=0,
        )
        progress["current_step"] = 0
        progress["is_completed"] = False
        progress["is_skipped"] = False
        progress["completed_at"] = None
        progress["skipped_at"] = None
        progress["last_seen_at"] = datetime.now(UTC)

        progress = await self.onboarding_repository.save_progress(progress)
        return self._to_schema(progress)

    async def _get_or_create_progress(
        self,
        user_id: str | None,
        device_id: str | None,
        current_step: int,
    ) -> dict:
        self._validate_identifier(user_id=user_id, device_id=device_id)

        progress = await self.onboarding_repository.get_progress(user_id=user_id, device_id=device_id)
        if progress:
            if user_id and not progress.get("user_id"):
                progress["user_id"] = user_id
            if device_id and not progress.get("device_id"):
                progress["device_id"] = device_id
            return progress

        return await self.onboarding_repository.create_progress(user_id=user_id, device_id=device_id, current_step=current_step)

    @staticmethod
    def _validate_identifier(user_id: str | None, device_id: str | None) -> None:
        if not user_id and not device_id:
            raise AppException(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="INVALID_IDENTIFIER",
                message="Either user_id or device_id must be provided.",
            )

    @staticmethod
    def _to_schema(progress: dict) -> OnboardingProgressResponse:
        return OnboardingProgressResponse(
            id=progress.get("id"),
            user_id=progress.get("user_id"),
            device_id=progress.get("device_id"),
            current_step=progress.get("current_step", 0),
            is_completed=bool(progress.get("is_completed", False)),
            is_skipped=bool(progress.get("is_skipped", False)),
            completed_at=progress.get("completed_at"),
            skipped_at=progress.get("skipped_at"),
            last_seen_at=progress.get("last_seen_at"),
            created_at=progress.get("created_at"),
            updated_at=progress.get("updated_at"),
        )
