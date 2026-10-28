from __future__ import annotations

from datetime import date, datetime


from app.utils.helpers import utc_now


class NotificationMixin:
    async def _notification_summary(self, user_id: str) -> dict:
        total = await self.db.notifications.count_documents({"user_id": user_id})
        unread = await self.db.notifications.count_documents({"user_id": user_id, "read": False})
        today_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_unread = await self.db.notifications.count_documents(
            {"user_id": user_id, "read": False, "created_at": {"$gte": today_start}}
        )
        return {
            "total": total,
            "unread_count": unread,
            "new_count": unread,
            "today_unread_count": today_unread,
            "has_unread": unread > 0,
        }

    def _serialize_notification(self, notification: dict | None) -> dict:
        safe = self._to_public(notification)
        safe.pop("user_id", None)
        notification_type = safe.get("type") or "message"
        created_at = safe.get("created_at") or utc_now()
        read = bool(safe.get("read", False))
        safe["type"] = notification_type
        safe["title"] = safe.get("title") or self._notification_type_label(notification_type)
        safe["body"] = safe.get("body") or ""
        safe["read"] = read
        safe["unread"] = not read
        safe["icon_key"] = safe.get("icon_key") or self._notification_icon_key(notification_type)
        safe["accent_tone"] = safe.get("accent_tone") or self._notification_accent_tone(notification_type)
        safe["date_bucket"] = self._notification_date_bucket(created_at)
        safe["display_time_label"] = self._relative_time_label(created_at)
        safe["primary_action"] = safe.get("primary_action") or self._notification_primary_action(notification_type)
        safe["action_url"] = safe.get("action_url")
        safe["metadata"] = safe.get("metadata") or {}
        return safe

    def _notification_sections(self, items: list[dict]) -> list[dict]:
        sections = [
            {"key": "today", "title": "TODAY", "new_count": 0, "items": []},
            {"key": "earlier", "title": "EARLIER", "new_count": 0, "items": []},
        ]
        by_key = {section["key"]: section for section in sections}
        for item in items:
            key = item.get("date_bucket") or "earlier"
            section = by_key.get(key, by_key["earlier"])
            section["items"].append(item)
            if item.get("unread"):
                section["new_count"] += 1
        return [section for section in sections if section["items"]]

    @staticmethod
    def _notification_date_bucket(created_at) -> str:
        if not isinstance(created_at, datetime):
            return "earlier"
        now = utc_now()
        if created_at.tzinfo is None:
            now = now.replace(tzinfo=None)
        return "today" if created_at.date() == now.date() else "earlier"

    @staticmethod
    def _relative_time_label(value) -> str:
        if not isinstance(value, datetime):
            return ""
        now = utc_now()
        if value.tzinfo is None:
            now = now.replace(tzinfo=None)
        delta = now - value
        seconds = max(0, int(delta.total_seconds()))
        if seconds < 60:
            return "Just now"
        minutes = seconds // 60
        if minutes < 60:
            return f"{minutes}m ago"
        hours = minutes // 60
        if hours < 24:
            return f"{hours}h ago"
        if hours < 48:
            return "Yesterday"
        days = hours // 24
        if days < 7:
            return f"{days}d ago"
        return value.strftime("%b %d")

    @staticmethod
    def _notification_icon_key(notification_type: str) -> str:
        return {
            "message": "message",
            "missed_call": "phone-missed",
            "scheduled_call": "phone-call",
            "ai_task": "sparkles",
            "ai_insight": "sparkles",
            "calendar": "calendar",
            "daily_digest": "chart-line",
            "system_update": "mail",
        }.get(notification_type, "bell")

    @staticmethod
    def _notification_accent_tone(notification_type: str) -> str:
        return {
            "message": "cyan",
            "missed_call": "red",
            "scheduled_call": "cyan",
            "ai_task": "cyan",
            "ai_insight": "cyan",
            "calendar": "cyan",
            "daily_digest": "indigo",
            "system_update": "indigo",
        }.get(notification_type, "neutral")

    @staticmethod
    def _notification_type_label(notification_type: str) -> str:
        return notification_type.replace("_", " ").title()

    @staticmethod
    def _notification_primary_action(notification_type: str) -> str | None:
        return {
            "message": "open_conversation",
            "missed_call": "open_call",
            "scheduled_call": "open_call",
            "calendar": "open_event",
            "ai_task": "open_ai_history",
            "ai_insight": "open_ai_insight",
            "daily_digest": "open_digest",
            "system_update": "open_release_notes",
        }.get(notification_type)

