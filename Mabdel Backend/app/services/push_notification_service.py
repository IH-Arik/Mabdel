from __future__ import annotations

import time
from typing import Any

import httpx
from jose import jwt
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.config import settings
from app.utils.helpers import utc_now


class PushNotificationService:
    preference_map = {
        "message": "new_messages",
        "missed_call": "missed_calls",
        "scheduled_call": "scheduled_calls",
        "ai_task": "ai_tasks",
        "calendar": "calendar_reminders",
    }

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def enqueue_notification(self, user_id: str, notification: dict[str, Any]) -> list[dict[str, Any]]:
        user = await self.db.users.find_one({"_id": notification.get("user_object_id")} if notification.get("user_object_id") else {"_id": None})
        if not user:
            from bson import ObjectId

            user = await self.db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return []

        preference_key = self.preference_map.get(notification["type"])
        preferences = user.get("notification_preferences", {})
        if preferences.get("general_notification") is False:
            return []
        if preference_key and preferences.get(preference_key) is False:
            return []

        device_tokens = user.get("device_tokens", [])
        jobs: list[dict[str, Any]] = []
        unread_count = await self.db.notifications.count_documents({"user_id": user_id, "read": False})
        for device in device_tokens:
            document = {
                "user_id": user_id,
                "notification_id": notification["id"],
                "device_id": device["device_id"],
                "token": device["token"],
                "platform": device["platform"],
                "title": notification["title"],
                "body": notification["body"],
                "badge": unread_count,
                "sound": "default" if preferences.get("sound", True) else None,
                "vibrate": bool(preferences.get("vibrate", True)),
                "status": "queued",
                "attempts": 0,
                "created_at": utc_now(),
                "updated_at": utc_now(),
            }
            try:
                result = await self.db.push_dispatch_jobs.insert_one(document)
                document["_id"] = result.inserted_id
                jobs.append(document)
            except Exception:
                existing = await self.db.push_dispatch_jobs.find_one(
                    {"notification_id": notification["id"], "device_id": device["device_id"]}
                )
                if existing:
                    jobs.append(existing)

        if settings.PUSH_DELIVERY_SYNC and jobs:
            return await self.dispatch_jobs([job["_id"] for job in jobs])
        return [self._public_job(job) for job in jobs]

    async def dispatch_jobs(self, job_ids: list[Any] | None = None, limit: int = 50) -> list[dict[str, Any]]:
        filters: dict[str, Any] = {"status": "queued"}
        if job_ids:
            filters["_id"] = {"$in": job_ids}
        jobs = await self.db.push_dispatch_jobs.find(filters).sort("created_at", 1).limit(limit).to_list(length=limit)
        results: list[dict[str, Any]] = []
        for job in jobs:
            result = await self._dispatch_job(job)
            results.append(self._public_job(result))
        return results

    async def _dispatch_job(self, job: dict[str, Any]) -> dict[str, Any]:
        attempts = int(job.get("attempts", 0)) + 1
        update: dict[str, Any] = {"attempts": attempts, "updated_at": utc_now(), "last_attempt_at": utc_now()}

        platform = job.get("platform")
        if platform in {"android", "web"}:
            status, provider_response = await self._send_fcm(job)
        elif platform == "ios":
            status, provider_response = await self._send_apns(job)
        else:
            status, provider_response = "failed", {"reason": "unsupported_platform"}

        update["status"] = status
        update["provider_response"] = provider_response
        if status == "sent":
            update["sent_at"] = utc_now()
        updated = await self.db.push_dispatch_jobs.find_one_and_update(
            {"_id": job["_id"]},
            {"$set": update},
            return_document=ReturnDocument.AFTER,
        )
        return updated or {**job, **update}

    async def _send_fcm(self, job: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        if not settings.FCM_SERVER_KEY:
            status = "skipped" if settings.ENVIRONMENT.lower() == "development" else "failed"
            return status, {"reason": "fcm_not_configured"}
        payload = {
            "to": job["token"],
            "notification": {
                "title": job["title"],
                "body": job["body"],
            },
            "data": {
                "notification_id": job["notification_id"],
            },
            "priority": "high",
            "mutable_content": True,
            "content_available": True,
        }
        headers = {
            "Authorization": f"key={settings.FCM_SERVER_KEY}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post("https://fcm.googleapis.com/fcm/send", json=payload, headers=headers)
            if response.status_code >= 400:
                return "failed", {"status_code": response.status_code, "body": response.text[:300]}
            return "sent", response.json()
        except Exception as exc:
            return "failed", {"reason": str(exc)[:240]}

    async def _send_apns(self, job: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        missing = [
            key
            for key, value in {
                "APNS_KEY_ID": settings.APNS_KEY_ID,
                "APNS_TEAM_ID": settings.APNS_TEAM_ID,
                "APNS_BUNDLE_ID": settings.APNS_BUNDLE_ID,
                "APNS_PRIVATE_KEY": settings.APNS_PRIVATE_KEY,
            }.items()
            if not value
        ]
        if missing:
            status = "skipped" if settings.ENVIRONMENT.lower() == "development" else "failed"
            return status, {"reason": "apns_not_configured", "missing": missing}

        token = self._build_apns_jwt()
        aps: dict[str, Any] = {"badge": job.get("badge", 0)}
        if job.get("sound"):
            aps["sound"] = job["sound"]
        if job.get("title") or job.get("body"):
            aps["alert"] = {"title": job.get("title", ""), "body": job.get("body", "")}

        payload = {
            "aps": aps,
            "notification_id": job["notification_id"],
        }
        host = "api.sandbox.push.apple.com" if settings.APNS_USE_SANDBOX else "api.push.apple.com"
        url = f"https://{host}/3/device/{job['token']}"
        headers = {
            "authorization": f"bearer {token}",
            "apns-topic": settings.APNS_BUNDLE_ID or "",
            "apns-push-type": "alert",
            "apns-priority": "10",
        }
        try:
            async with httpx.AsyncClient(timeout=20.0, http2=True) as client:
                response = await client.post(url, json=payload, headers=headers)
            if response.status_code in {200, 201}:
                return "sent", {"status_code": response.status_code}
            detail: dict[str, Any] = {"status_code": response.status_code, "body": response.text[:300]}
            try:
                detail["json"] = response.json()
            except Exception:
                pass
            return "failed", detail
        except Exception as exc:
            return "failed", {"reason": str(exc)[:240]}

    @staticmethod
    def _build_apns_jwt() -> str:
        private_key = (settings.APNS_PRIVATE_KEY or "").replace("\\n", "\n")
        headers = {"alg": "ES256", "kid": settings.APNS_KEY_ID}
        claims = {"iss": settings.APNS_TEAM_ID, "iat": int(time.time())}
        return jwt.encode(claims, private_key, algorithm="ES256", headers=headers)

    @staticmethod
    def _public_job(job: dict[str, Any]) -> dict[str, Any]:
        public = {**job}
        if "_id" in public:
            public["id"] = str(public.pop("_id"))
        return public
