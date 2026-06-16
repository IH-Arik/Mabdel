from __future__ import annotations

from math import ceil

from pymongo import ReturnDocument

from app.core.config import settings
from app.core.exceptions import AppException
from app.utils.helpers import utc_now

from ._base import SmartFlowBase


class CallHistoryService(SmartFlowBase):
    async def list_call_logs(
        self,
        user_id: str,
        page: int,
        page_size: int,
        status: str | None,
        search: str | None = None,
        contact_id: str | None = None,
    ) -> dict:
        filters = {"user_id": user_id}
        if status and status != "all":
            filters["status"] = status
        if contact_id:
            filters["contact_id"] = contact_id
        if search:
            filters["$or"] = [
                {"contact_name": {"$regex": search, "$options": "i"}},
                {"phone_number": {"$regex": search, "$options": "i"}},
                {"from_number": {"$regex": search, "$options": "i"}},
            ]
            matching_contacts = await self.db.contacts.find(
                {
                    "user_id": user_id,
                    "$or": [
                        {"name": {"$regex": search, "$options": "i"}},
                        {"email": {"$regex": search, "$options": "i"}},
                        {"phone": {"$regex": search, "$options": "i"}},
                    ],
                },
                {"_id": 1},
            ).to_list(length=100)
            if matching_contacts:
                filters["$or"].append({"contact_id": {"$in": [str(item["_id"]) for item in matching_contacts]}})
        total = await self.db.call_logs.count_documents(filters)
        raw_items = await self.db.call_logs.find(filters).sort("timestamp", -1).skip((page - 1) * page_size).limit(page_size).to_list(length=page_size)
        items = [await self._serialize_call_log(item) for item in raw_items]
        all_calls = await self.db.call_logs.find({"user_id": user_id}).to_list(length=1000)
        return {
            "items": items,
            "summary": self._call_history_summary(all_calls),
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": ceil(total / page_size) if page_size else 1,
            },
        }

    async def get_call_log(self, user_id: str, call_id: str) -> dict:
        call = await self._get_owned_document(self.db.call_logs, user_id, call_id, "CALL_NOT_FOUND")
        return await self._serialize_call_log(call)

    async def create_call_log(self, user_id: str, payload: dict) -> dict:
        status = payload.get("status") or self._derive_call_status(payload)
        contact = None
        if payload.get("contact_id"):
            contact = await self._get_owned_document(self.db.contacts, user_id, payload["contact_id"], "CONTACT_NOT_FOUND")
        document = {
            "user_id": user_id,
            **payload,
            "contact_name": payload.get("contact_name") or (contact or {}).get("name"),
            "phone_number": payload.get("phone_number") or (contact or {}).get("phone"),
            "status": status,
            "timestamp": utc_now(),
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }
        result = await self.db.call_logs.insert_one(document)
        document["_id"] = result.inserted_id
        return await self._serialize_call_log(document)

    async def create_outbound_call(self, user_id: str, payload: dict) -> dict:
        phone_number = (payload.get("phone_number") or "").strip() or None
        contact_id = payload.get("contact_id")
        contact = None
        if contact_id:
            contact = await self._get_owned_document(self.db.contacts, user_id, contact_id, "CONTACT_NOT_FOUND")
            phone_number = phone_number or (contact.get("phone") or "").strip() or None
        if not phone_number:
            raise AppException(
                status_code=400,
                code="CALL_PHONE_REQUIRED",
                message="A phone number or a contact with a phone number is required to start a call.",
            )

        initial_log = await self.create_call_log(
            user_id,
            {
                "contact_id": contact_id,
                "phone_number": phone_number,
                "call_type": "outbound",
                "duration": 0,
                "ai_ready": bool(payload.get("ai_ready", True)),
                "callback_requested": False,
                "from_number": payload.get("from_number") or settings.TWILIO_PHONE_NUMBER,
                "status": "queued",
            },
        )
        twilio_result = await self.call_service.initiate_outbound_call(
            to_number=phone_number,
            from_number=payload.get("from_number"),
            user_id=user_id,
            call_log_id=initial_log["id"],
        )
        updated_log = await self.update_call_log(
            user_id,
            initial_log["id"],
            {
                "phone_number": twilio_result.get("to"),
                "from_number": twilio_result.get("from"),
                "twilio_call_sid": twilio_result.get("sid"),
                "status": self.call_service.normalize_twilio_status(twilio_result.get("status")),
            },
        )
        return {
            "call_log": updated_log,
            "twilio_call_sid": twilio_result.get("sid"),
            "twilio_status": self.call_service.normalize_twilio_status(twilio_result.get("status")),
        }

    async def update_call_log(self, user_id: str, call_id: str, updates: dict) -> dict:
        call = await self._get_owned_document(self.db.call_logs, user_id, call_id, "CALL_NOT_FOUND")
        clean_updates = {key: value for key, value in updates.items() if value is not None}
        if "status" not in clean_updates:
            clean_updates["status"] = self._derive_call_status({**call, **clean_updates})
        clean_updates["updated_at"] = utc_now()
        updated = await self.db.call_logs.find_one_and_update(
            {"_id": call["_id"]},
            {"$set": clean_updates},
            return_document=ReturnDocument.AFTER,
        )
        return await self._serialize_call_log(updated)

    async def update_call_log_from_provider_callback(
        self,
        *,
        user_id: str,
        call_log_id: str,
        twilio_call_sid: str | None,
        call_status: str | None,
        call_duration: str | None,
        from_number: str | None,
        to_number: str | None,
    ) -> dict:
        call = await self._get_owned_document(self.db.call_logs, user_id, call_log_id, "CALL_NOT_FOUND")
        clean_updates: dict = {
            "twilio_call_sid": twilio_call_sid or call.get("twilio_call_sid"),
            "status": self.call_service.normalize_twilio_status(call_status),
            "from_number": from_number or call.get("from_number"),
            "phone_number": to_number or call.get("phone_number"),
        }
        if call_duration is not None:
            try:
                clean_updates["duration"] = max(0, int(call_duration))
            except ValueError:
                pass
        if clean_updates["status"] == "completed" and not clean_updates.get("duration"):
            clean_updates["duration"] = call.get("duration", 0)
        return await self.update_call_log(user_id, call_log_id, clean_updates)

    async def get_call_summary(self, user_id: str) -> dict:
        calls = await self.db.call_logs.find({"user_id": user_id}).to_list(length=500)
        return {
            "total_calls": len(calls),
            "total_minutes_saved": sum(max(1, int(call.get("duration", 0) / 60)) for call in calls if call.get("ai_ready")),
            "callback_queue": [await self._serialize_call_log(call) for call in calls if call.get("callback_requested")],
        }

    async def get_call_transcript(self, user_id: str, call_id: str) -> dict:
        call = await self._get_owned_document(self.db.call_logs, user_id, call_id, "CALL_NOT_FOUND")
        transcript = call.get("transcript") or call.get("recording_transcript")
        return {
            "call_id": str(call["_id"]),
            "transcript": transcript,
            "speaker_segments": call.get("speaker_segments", []),
            "transcript_available": bool(transcript),
        }

    async def update_call_transcript(self, user_id: str, call_id: str, payload: dict) -> dict:
        call = await self._get_owned_document(self.db.call_logs, user_id, call_id, "CALL_NOT_FOUND")
        updated = await self.db.call_logs.find_one_and_update(
            {"_id": call["_id"]},
            {
                "$set": {
                    "transcript": payload["transcript"].strip(),
                    "speaker_segments": payload.get("speaker_segments", []),
                    "updated_at": utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return await self._serialize_call_log(updated)

    async def get_call_ai_summary(self, user_id: str, call_id: str) -> dict:
        call = await self._get_owned_document(self.db.call_logs, user_id, call_id, "CALL_NOT_FOUND")
        return {
            "call_id": str(call["_id"]),
            "ai_summary": call.get("ai_summary") or self._default_call_ai_summary(call),
            "ai_summary_available": bool(call.get("ai_summary")),
        }

    async def update_call_ai_summary(self, user_id: str, call_id: str, payload: dict) -> dict:
        call = await self._get_owned_document(self.db.call_logs, user_id, call_id, "CALL_NOT_FOUND")
        summary = {
            "purpose": payload.get("purpose") or "Call summary",
            "key_points": payload.get("key_points", []),
            "action_items": payload.get("action_items", []),
            "highlights": payload.get("highlights", []),
        }
        updated = await self.db.call_logs.find_one_and_update(
            {"_id": call["_id"]},
            {"$set": {"ai_summary": summary, "ai_ready": True, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return await self._serialize_call_log(updated)

    async def request_call_callback(self, user_id: str, call_id: str) -> dict:
        return await self.update_call_log(
            user_id,
            call_id,
            {
                "callback_requested": True,
                "status": "callback",
            },
        )

    async def get_call_recording(self, user_id: str, call_id: str) -> dict:
        call = await self._get_owned_document(self.db.call_logs, user_id, call_id, "CALL_NOT_FOUND")
        return {
            "call_id": str(call["_id"]),
            "recording_url": call.get("recording_url"),
            "recording_duration": call.get("recording_duration") or call.get("duration", 0),
            "recording_available": bool(call.get("recording_url")),
        }

    async def update_call_recording(self, user_id: str, call_id: str, payload: dict) -> dict:
        call = await self._get_owned_document(self.db.call_logs, user_id, call_id, "CALL_NOT_FOUND")
        updated = await self.db.call_logs.find_one_and_update(
            {"_id": call["_id"]},
            {
                "$set": {
                    "recording_url": payload["recording_url"],
                    "recording_duration": payload.get("recording_duration"),
                    "updated_at": utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return await self._serialize_call_log(updated)
