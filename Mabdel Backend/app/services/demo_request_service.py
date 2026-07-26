from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.services.email_service import EmailService


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "first_name": doc.get("first_name", ""),
        "last_name": doc.get("last_name", ""),
        "phone": doc.get("phone", ""),
        "email": doc.get("email", ""),
        "message": doc.get("message", ""),
        "status": doc.get("status", "new"),
        "replies": doc.get("replies", []),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


class DemoRequestService:
    def __init__(self, db: AsyncIOMotorDatabase, email_service: EmailService | None = None) -> None:
        self.db = db
        self.email_service = email_service or EmailService()

    async def create_demo_request(self, payload: dict) -> dict:
        now = _utc_now()
        document = {
            "first_name": payload["first_name"].strip(),
            "last_name": payload["last_name"].strip(),
            "phone": payload["phone"].strip(),
            "email": str(payload["email"]).strip().lower(),
            "message": payload["message"].strip(),
            "status": "new",
            "replies": [],
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.demo_requests.insert_one(document)
        document["_id"] = result.inserted_id
        await self._notify_admins(document)
        return _serialize(document)

    async def list_demo_requests(self, page: int, page_size: int, status_filter: str | None) -> dict:
        filters: dict = {}
        if status_filter and status_filter != "all":
            filters["status"] = status_filter
        total = await self.db.demo_requests.count_documents(filters)
        cursor = (
            self.db.demo_requests.find(filters)
            .sort("created_at", -1)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )
        items = [_serialize(doc) for doc in await cursor.to_list(length=page_size)]
        return {
            "items": items,
            "pagination": {"page": page, "page_size": page_size, "total": total},
            "summary": {
                "total": await self.db.demo_requests.count_documents({}),
                "new": await self.db.demo_requests.count_documents({"status": "new"}),
                "replied": await self.db.demo_requests.count_documents({"status": "replied"}),
                "closed": await self.db.demo_requests.count_documents({"status": "closed"}),
            },
        }

    async def get_demo_request(self, request_id: str) -> dict:
        return _serialize(await self._get_or_404(request_id))

    async def reply_to_demo_request(self, request_id: str, admin_id: str, admin_name: str, message: str) -> dict:
        doc = await self._get_or_404(request_id)
        now = _utc_now()
        reply = {"admin_id": admin_id, "admin_name": admin_name, "message": message.strip(), "sent_at": now}
        updated = await self.db.demo_requests.find_one_and_update(
            {"_id": doc["_id"]},
            {"$push": {"replies": reply}, "$set": {"status": "replied", "updated_at": now}},
            return_document=ReturnDocument.AFTER,
        )

        subject = "Re: Your GoCustify AI Demo Request"
        text = (
            f"Hi {doc.get('first_name', '')},\n\n{message.strip()}\n\n"
            f"— The GoCustify AI Team"
        )
        html = (
            f"<p>Hi {doc.get('first_name', '')},</p>"
            f"<p>{message.strip().replace(chr(10), '<br/>')}</p>"
            f"<p>— The GoCustify AI Team</p>"
        )
        await self.email_service.send_invoice_email(email=doc["email"], subject=subject, text=text, html=html)

        return _serialize(updated)

    async def update_status(self, request_id: str, status: str) -> dict:
        doc = await self._get_or_404(request_id)
        updated = await self.db.demo_requests.find_one_and_update(
            {"_id": doc["_id"]},
            {"$set": {"status": status, "updated_at": _utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return _serialize(updated)

    async def _get_or_404(self, request_id: str) -> dict:
        if not ObjectId.is_valid(request_id):
            raise AppException(status_code=404, code="DEMO_REQUEST_NOT_FOUND", message="Demo request was not found.")
        doc = await self.db.demo_requests.find_one({"_id": ObjectId(request_id)})
        if not doc:
            raise AppException(status_code=404, code="DEMO_REQUEST_NOT_FOUND", message="Demo request was not found.")
        return doc

    async def _notify_admins(self, doc: dict) -> None:
        admins = await self.db.users.find(
            {"role": {"$in": ["admin", "super_admin"]}}, {"_id": 1}
        ).to_list(length=200)
        if not admins:
            return
        now = _utc_now()
        name = f"{doc.get('first_name', '')} {doc.get('last_name', '')}".strip()
        notifications = [
            {
                "user_id": str(admin["_id"]),
                "type": "demo_request",
                "title": "New demo request",
                "message": f"{name or doc.get('email')} requested a demo.",
                "is_read": False,
                "created_at": now,
            }
            for admin in admins
        ]
        await self.db.notifications.insert_many(notifications)
