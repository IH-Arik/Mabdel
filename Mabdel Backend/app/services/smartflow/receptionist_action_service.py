"""Durable, tenant-scoped human approval for receptionist side effects."""

from __future__ import annotations

import hashlib
import json

from bson import ObjectId
from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.utils.helpers import utc_now

from ._base import SmartFlowBase


class ReceptionistActionService(SmartFlowBase):
    @staticmethod
    def serialize(row: dict) -> dict:
        return {
            **{key: value for key, value in row.items() if key != "_id"},
            "id": str(row["_id"]),
        }

    async def request(
        self,
        user_id: str,
        *,
        tool: str,
        arguments: dict,
        capabilities: list[str],
        call_id: str | None = None,
        caller_phone: str | None = None,
    ) -> dict:
        organization_id = await self._resolve_organization_id(user_id)
        if not organization_id:
            raise AppException(
                status_code=422,
                code="NO_ORGANIZATION",
                message="A business is required.",
            )
        fingerprint = hashlib.sha256(
            json.dumps(
                [organization_id, call_id, tool, arguments], sort_keys=True, default=str
            ).encode()
        ).hexdigest()
        request_key = fingerprint[:24]
        if not call_id:
            # Repeat invocations of one live call are idempotent. A fresh outbound
            # request or reminder after a prior review is a new business action.
            previous = await self.db.receptionist_actions.find_one(
                {"organization_id": organization_id, "fingerprint": fingerprint},
                sort=[("created_at", -1)],
            )
            if previous and previous["status"] == "pending":
                return self.serialize(previous)
            if previous:
                request_key = hashlib.sha256(
                    f"{fingerprint}:{previous['_id']}".encode()
                ).hexdigest()[:24]
        now = utc_now()
        row = await self.db.receptionist_actions.find_one_and_update(
            {
                "_id": ObjectId(request_key),
                "organization_id": organization_id,
                "fingerprint": fingerprint,
            },
            {
                "$setOnInsert": {
                    "user_id": user_id,
                    "tool": tool,
                    "arguments": arguments,
                    "capability": capabilities[0],
                    "capabilities": capabilities,
                    "call_id": call_id,
                    "caller_phone": caller_phone,
                    "status": "pending",
                    "created_at": now,
                    "updated_at": now,
                }
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return self.serialize(row)

    async def list_actions(self, user_id: str, status: str | None = None) -> dict:
        organization_id = await self._resolve_organization_id(user_id)
        query = (
            {"organization_id": organization_id}
            if organization_id
            else {"user_id": user_id}
        )
        if status:
            query["status"] = status
        rows = (
            await self.db.receptionist_actions.find(query)
            .sort("created_at", -1)
            .limit(100)
            .to_list(100)
        )
        return {"items": [self.serialize(row) for row in rows]}

    async def decide(
        self, user_id: str, action_id: str, *, approve: bool, executor=None
    ) -> dict:
        organization_id = await self._resolve_organization_id(user_id)
        if not organization_id or not ObjectId.is_valid(action_id):
            raise AppException(
                status_code=404, code="ACTION_NOT_FOUND", message="Request not found."
            )
        query = {"_id": ObjectId(action_id), "organization_id": organization_id}
        row = await self.db.receptionist_actions.find_one_and_update(
            {**query, "status": "pending"},
            {
                "$set": {
                    "status": "approved" if approve else "declined",
                    "reviewed_by": user_id,
                    "reviewed_at": utc_now(),
                    "updated_at": utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        if not row:
            if not await self.db.receptionist_actions.find_one(query):
                raise AppException(
                    status_code=404,
                    code="ACTION_NOT_FOUND",
                    message="Request not found.",
                )
            raise AppException(
                status_code=409,
                code="ACTION_ALREADY_REVIEWED",
                message="This request has already been reviewed.",
            )
        if not approve:
            return self.serialize(row)
        try:
            if await self._resolve_organization_id(row["user_id"]) != organization_id:
                raise AppException(
                    status_code=403,
                    code="ORGANIZATION_CHANGED",
                    message="The original requester no longer belongs to this business.",
                )
            for capability in row["capabilities"]:
                if (
                    await self.resolve_capability(organization_id, capability)
                    == "disabled"
                ):
                    raise AppException(
                        status_code=403,
                        code="PERMISSION_DENIED",
                        message="The owner has disabled this action.",
                    )
            result = await (executor(row) if executor else self.execute(row))
            failed = bool(result.get("error")) or any(
                result.get(key) is False
                for key in ("saved", "sent", "transferred", "notified")
            )
            status = "failed" if failed else "completed"
        except Exception as exc:
            result = {
                "error": getattr(
                    exc,
                    "message",
                    "The action could not be completed. Please follow up with the caller.",
                )
            }
            status = "failed"
        await self.db.receptionist_actions.update_one(
            query,
            {"$set": {"status": status, "result": result, "updated_at": utc_now()}},
        )
        return self.serialize(await self.db.receptionist_actions.find_one(query))

    async def execute(self, row: dict) -> dict:
        from app.services.realtime_receptionist import RealtimeReceptionist
        from app.services.smartflow_service import SmartFlowService

        flow = SmartFlowService(self.db)
        if row["tool"] == "send_sms" and "phone" in row["arguments"]:
            args = row["arguments"]
            return await self._send_sms(flow, row["user_id"], args)
        if row["tool"] == "create_crm_contact":
            from .appointment_notifications import AppointmentNotifier

            contact_id = await AppointmentNotifier(self.db).sms_contact_id(
                row["user_id"], **row["arguments"], approved=True
            )
            return {"saved": bool(contact_id), "contact_id": contact_id}
        if row["tool"] == "outbound_call":
            return await flow.create_outbound_call(
                row["user_id"], {**row["arguments"], "_ai_approved": True}
            )
        if row["tool"] == "answer_call":
            from app.services.call_service import CallService

            control = CallService()
            log = await self.db.call_logs.find_one(
                {"twilio_call_sid": row["call_id"], "user_id": row["user_id"]}
            )
            if not log or log.get("status") in {
                "completed",
                "failed",
                "busy",
                "no-answer",
                "cancelled",
                "canceled",
            }:
                return {
                    "error": "The caller is no longer waiting. Call them back instead."
                }
            await self.db.call_logs.update_one(
                {"twilio_call_sid": row["call_id"], "user_id": row["user_id"]},
                {"$set": {"ai_answer_approved": True}},
            )
            await control.answer_call(
                row["call_id"],
                websocket_url=control.build_media_stream_url(row["call_id"]),
            )
            return {"answered": True}
        if row["tool"] == "transfer_to_human":
            # Transfers only make sense while the caller is still connected.
            from app.api.v1.endpoints.calls import active_sessions

            agent = active_sessions.get(row.get("call_id"))
            if (
                not isinstance(agent, RealtimeReceptionist)
                or agent.closed
                or agent.user_id != row["user_id"]
            ):
                # The approval HTTP request can land on a different worker from
                # the media WebSocket. Call Control uses the persisted call ID.
                log = await self.db.call_logs.find_one({"twilio_call_sid": row.get("call_id"), "user_id": row["user_id"]})
                if not log or log.get("status") not in {"answered", "in_progress", "in-progress", "active", "connected", "ongoing"}:
                    return {"transferred": False, "error": "The call is no longer connected. Call the customer back instead."}
                agent = RealtimeReceptionist(row["call_id"], flow.ai_service, flow, call_log=log)
                agent.user_id = row["user_id"]
                agent.caller_phone = row.get("caller_phone")
                agent.is_approval_replay = True
        else:
            agent = RealtimeReceptionist(
                row.get("call_id") or str(row["_id"]), flow.ai_service, flow
            )
            agent.user_id = row["user_id"]
            agent.caller_phone = row.get("caller_phone")
            agent.is_approval_replay = True
        previous = getattr(agent, "approved_capabilities", set())
        agent.approved_capabilities = set(row["capabilities"])
        try:
            return await agent.run_tool(row["tool"], row["arguments"])
        finally:
            agent.approved_capabilities = previous

    @staticmethod
    async def _send_sms(flow, user_id: str, args: dict) -> dict:
        from .appointment_notifications import AppointmentNotifier

        notifier = AppointmentNotifier(flow.db)
        organization_id = await flow._resolve_organization_id(user_id)
        number = notifier._normalize_phone_value(args.get("phone") or "")
        if not number:
            return {"sent": False, "error": "A valid phone number is required."}
        conversation_id, contact_id = await notifier._sms_thread(
            user_id, organization_id, number, args.get("name")
        )
        message = await flow.create_message(
            user_id,
            {
                "conversation_id": conversation_id,
                "contact_id": contact_id,
                "platform": "sms",
                "direction": "outbound",
                "content": args["message"],
                "automated": True,
                "_await_delivery": True,
            },
        )
        return {
            "sent": message.get("status") != "failed",
            "message_id": message.get("id"),
            "note": "The sending service accepted the SMS." if message.get("status") != "failed" else "The SMS could not be sent. Do not claim success.",
        }
