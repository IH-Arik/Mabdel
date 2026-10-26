"""Tenant-scoped receptionist routing and durable follow-up requests."""

from __future__ import annotations

import logging

from bson import ObjectId

from app.core.exceptions import AppException
from app.utils.helpers import utc_now

logger = logging.getLogger(__name__)


class ReceptionistWorkflowService:
    def __init__(self, db):
        self.db = db

    async def resolve_route(
        self,
        organization_id,
        settings,
        *,
        playbook=None,
        department=None,
        employee_id=None,
    ):
        members = await self.db.users.find(
            {"organization_id": organization_id}
        ).to_list(None)
        member_ids = {str(row["_id"]) for row in members}
        rules = [
            rule
            for rule in settings.get("call_routing_rules", [])
            if rule.get("active", True)
        ]
        requested = str(playbook or department or "").strip().casefold()
        matches = [
            rule
            for rule in rules
            if requested
            and requested
            in {
                str(rule.get(key) or "").strip().casefold()
                for key in ("id", "name", "notify_role", "notify_target")
            }
        ]
        rule = matches[0] if len(matches) == 1 else None
        if employee_id:
            recipients = [employee_id] if employee_id in member_ids else []
        elif rule:
            recipients = [
                uid for uid in rule.get("target_user_ids", []) if uid in member_ids
            ]
            if not recipients and rule.get("notify_target"):
                name = rule["notify_target"].strip().casefold()
                named = [
                    row
                    for row in members
                    if name
                    in {
                        str(row.get("name") or "").strip().casefold(),
                        str(row.get("full_name") or "").strip().casefold(),
                        str(row.get("email") or "").strip().casefold(),
                    }
                ]
                recipients = [str(named[0]["_id"])] if len(named) == 1 else []
        else:
            recipients = []
        return {
            "recipient_ids": list(dict.fromkeys(recipients)),
            "transfer_number": rule.get("transfer_number") if rule else None,
            "route_id": rule.get("id") if rule else None,
            "matched": bool(rule or (employee_id and recipients)),
        }

    async def create_request(
        self,
        user_id,
        organization_id,
        *,
        kind,
        summary,
        caller_phone=None,
        caller_name=None,
        call_id=None,
        department=None,
        employee_id=None,
        preferred_time=None,
        playbook=None,
        settings=None,
    ):
        if kind not in {"task", "service_ticket", "quote", "callback", "workflow"}:
            raise AppException(
                400, "INVALID_REQUEST_KIND", "Unsupported receptionist request type."
            )
        summary = str(summary or "").strip()
        if not summary:
            raise AppException(
                400, "SUMMARY_REQUIRED", "A request summary is required."
            )
        if not organization_id:
            raise AppException(
                400,
                "ORGANIZATION_REQUIRED",
                "A business is required to save a request.",
            )
        route = await self.resolve_route(
            organization_id,
            settings or {},
            playbook=playbook,
            department=department,
            employee_id=employee_id,
        )
        if employee_id and not route["recipient_ids"]:
            raise AppException(
                400,
                "INVALID_ASSIGNEE",
                "The employee does not belong to this business.",
            )
        now = utc_now()
        document = {
            "organization_id": organization_id,
            "user_id": user_id,
            "kind": kind,
            "summary": summary[:4000],
            "caller_phone": caller_phone,
            "caller_name": caller_name,
            "call_id": call_id,
            "department": department,
            "preferred_time": preferred_time,
            "assignee_ids": route["recipient_ids"],
            "route_id": route["route_id"],
            "status": "open",
            "created_at": now,
            "updated_at": now,
        }
        result = await self.db.receptionist_work_items.insert_one(document)
        if kind in (settings or {}).get("request_sms_events", []) and caller_phone:
            from app.services.smartflow.appointment_notifications import (
                AppointmentNotifier,
            )
            # This is confirmation of the saved request, never a promise that a
            # quote, service visit or workflow has already been fulfilled.
            await AppointmentNotifier(self.db).notify_outbound_followup(
                user_id, phone=caller_phone, name=caller_name,
                template=f"{{business}}: we received your {kind.replace('_', ' ')} request. Our team will follow up.")
        recipients = route["recipient_ids"]
        if not recipients and not (playbook or department or employee_id):
            owner = await self.db.users.find_one(
                {"organization_id": organization_id, "role": "owner"}
            )
            recipients = [str(owner["_id"])] if owner else []
        # Persistence is primary. A push outage must not discard a caller's request
        # or cause the model to create a duplicate by retrying a saved request.
        from app.services.smartflow.notification_service import NotificationService

        notifier = NotificationService(self.db)
        notified = []
        for recipient in recipients:
            try:
                await notifier.create_notification(
                    recipient,
                    "ai_task",
                    f"Receptionist {kind.replace('_', ' ')} request",
                    summary[:300],
                    action_url="/calls",
                    metadata={
                        "work_item_id": str(result.inserted_id),
                        "call_id": call_id,
                        "kind": kind,
                    },
                )
                notified.append(recipient)
            except Exception:
                logger.warning(
                    "Could not notify receptionist work-item assignee", exc_info=True
                )
        return {
            "saved": True,
            "id": str(result.inserted_id),
            "status": "open",
            "kind": kind,
            "assignee_ids": route["recipient_ids"],
            "notified_user_ids": notified,
            "note": "Request saved for team follow-up; the requested work has not yet been performed.",
        }

    async def list_requests(self, organization_id, status=None):
        query = {"organization_id": organization_id}
        if status:
            query["status"] = status
        rows = (
            await self.db.receptionist_work_items.find(query)
            .sort("created_at", -1)
            .limit(100)
            .to_list(100)
        )
        return [
            {
                **{key: value for key, value in row.items() if key != "_id"},
                "id": str(row["_id"]),
            }
            for row in rows
        ]

    async def update_request(
        self, organization_id, item_id, *, status, assignee_id=None
    ):
        if not ObjectId.is_valid(item_id):
            raise AppException(404, "REQUEST_NOT_FOUND", "Request not found.")
        changes = {"status": status, "updated_at": utc_now()}
        if assignee_id is not None:
            route = await self.resolve_route(
                organization_id, {}, employee_id=assignee_id
            )
            if not route["recipient_ids"]:
                raise AppException(
                    400,
                    "INVALID_ASSIGNEE",
                    "The employee does not belong to this business.",
                )
            changes["assignee_ids"] = route["recipient_ids"]
        result = await self.db.receptionist_work_items.update_one(
            {"_id": ObjectId(item_id), "organization_id": organization_id},
            {"$set": changes},
        )
        if not result.matched_count:
            raise AppException(404, "REQUEST_NOT_FOUND", "Request not found.")
        return {"id": item_id, **changes}
