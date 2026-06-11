from __future__ import annotations

from app.repositories.app_config_repository import AppConfigRepository
from app.repositories.onboarding_repository import OnboardingRepository
from app.schemas.app_config import AppConfigResponseData


def _version_to_tuple(version: str) -> tuple[int, ...]:
    parts: list[int] = []
    for chunk in version.split("."):
        digits = "".join(character for character in chunk if character.isdigit())
        parts.append(int(digits) if digits else 0)
    return tuple(parts)


def _is_version_lower(current_version: str, minimum_version: str) -> bool:
    current = _version_to_tuple(current_version)
    minimum = _version_to_tuple(minimum_version)
    max_size = max(len(current), len(minimum))
    current += (0,) * (max_size - len(current))
    minimum += (0,) * (max_size - len(minimum))
    return current < minimum


class AppConfigService:
    def __init__(self, config_repository: AppConfigRepository, onboarding_repository: OnboardingRepository) -> None:
        self.config_repository = config_repository
        self.onboarding_repository = onboarding_repository

    async def get_app_config(
        self,
        current_version: str | None = None,
        user_id: str | None = None,
        device_id: str | None = None,
    ) -> AppConfigResponseData:
        await self.config_repository.ensure_defaults()
        config = await self.config_repository.get_latest_config()
        if not config:
            config = await self.config_repository.create_default_config()

        active_slides = await self.onboarding_repository.get_active_slides()
        onboarding_enabled = len(active_slides) > 0
        progress = await self.onboarding_repository.get_progress(user_id=user_id, device_id=device_id)
        onboarding_required = onboarding_enabled and not bool(progress and (progress.get("is_completed") or progress.get("is_skipped")))

        force_update = bool(config.get("force_update", False))
        if current_version and _is_version_lower(current_version, config["minimum_supported_version"]):
            force_update = True

        feature_flags = {flag["key"]: bool(flag.get("is_enabled", False)) for flag in await self.config_repository.get_feature_flags()}

        return AppConfigResponseData(
            app_name=config["app_name"],
            maintenance_mode=bool(config.get("maintenance_mode", False)),
            force_update=force_update,
            minimum_supported_version=config["minimum_supported_version"],
            latest_version=config["latest_version"],
            default_language=config.get("default_language", "en"),
            onboarding_enabled=onboarding_enabled,
            onboarding_required=onboarding_required,
            feature_flags=feature_flags,
        )
