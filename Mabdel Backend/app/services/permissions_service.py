from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.permissions_repository import PermissionsRepository
from app.schemas.permissions import PermissionsResponseData, PermissionToggle


class PermissionsService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.repository = PermissionsRepository(db)

    async def get_preferences(self, user_id: str | None, device_id: str | None) -> PermissionsResponseData:
        record = await self.repository.get_preferences(user_id=user_id, device_id=device_id)

        if record is None:
            return self._build_response(
                user_id=user_id,
                device_id=device_id,
                microphone_enabled=True,
                notifications_enabled=True,
                contacts_enabled=False,
                created_at=None,
                updated_at=None,
            )

        return self._build_response(
            user_id=record.get("user_id"),
            device_id=record.get("device_id"),
            microphone_enabled=bool(record.get("microphone_enabled", True)),
            notifications_enabled=bool(record.get("notifications_enabled", True)),
            contacts_enabled=bool(record.get("contacts_enabled", False)),
            created_at=record.get("created_at"),
            updated_at=record.get("updated_at"),
        )

    async def update_preferences(
        self,
        *,
        user_id: str | None,
        device_id: str | None,
        microphone_enabled: bool,
        notifications_enabled: bool,
        contacts_enabled: bool,
    ) -> PermissionsResponseData:
        record = await self.repository.upsert_preferences(
            user_id=user_id,
            device_id=device_id,
            microphone_enabled=microphone_enabled,
            notifications_enabled=notifications_enabled,
            contacts_enabled=contacts_enabled,
        )
        return await self.get_preferences(user_id=record.get("user_id"), device_id=record.get("device_id"))

    async def accept_all(self, user_id: str | None, device_id: str | None) -> PermissionsResponseData:
        return await self.update_preferences(
            user_id=user_id,
            device_id=device_id,
            microphone_enabled=True,
            notifications_enabled=True,
            contacts_enabled=True,
        )

    @staticmethod
    def _build_response(
        *,
        user_id: str | None,
        device_id: str | None,
        microphone_enabled: bool,
        notifications_enabled: bool,
        contacts_enabled: bool,
        created_at,
        updated_at,
    ) -> PermissionsResponseData:
        permissions = [
            PermissionToggle(
                key="microphone",
                title="Microphone",
                description="Enable voice commands and AI dictation for hands-free assistance.",
                enabled=microphone_enabled,
            ),
            PermissionToggle(
                key="notifications",
                title="Notifications",
                description="Receive real-time updates on business insights and task completions.",
                enabled=notifications_enabled,
            ),
            PermissionToggle(
                key="contacts",
                title="Contacts",
                description="Allow the assistant to help schedule meetings and manage client relations.",
                enabled=contacts_enabled,
                recommended=False,
            ),
        ]
        return PermissionsResponseData(
            user_id=user_id,
            device_id=device_id,
            permissions=permissions,
            created_at=created_at,
            updated_at=updated_at,
        )
