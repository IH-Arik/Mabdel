from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.core.config import settings
from app.services.meeting_request_service import MeetingRequestService


def test_proposal_email_links_to_the_frontend_confirmation_page_not_the_raw_api(mock_db, monkeypatch):
    """The confirm link the recipient clicks used to point straight at the backend
    API (GET /api/v1/public/meeting-requests/confirm/{token}) -- a bare JSON
    response with no way to actually confirm from it. It must point at the
    frontend's ConfirmMeeting page instead."""
    monkeypatch.setattr(settings, "PUBLIC_FRONTEND_URL", "https://gocustify.com")

    async def _run():
        service = MeetingRequestService(mock_db)
        result = await mock_db.meeting_requests.insert_one(
            {
                "first_name": "Alex",
                "last_name": "Rivera",
                "email": "alex@example.com",
                "phone": "+15551234567",
                "notes": "",
                "status": "pending",
                "requested_start": datetime.now(timezone.utc) + timedelta(days=1),
                "requested_end": datetime.now(timezone.utc) + timedelta(days=1, hours=1),
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        request_id = str(result.inserted_id)

        captured: dict = {}

        async def fake_send_invoice_email(*, email, subject, text, html):
            captured["email"] = email
            captured["subject"] = subject
            captured["text"] = text
            captured["html"] = html

        monkeypatch.setattr(service.email_service, "send_invoice_email", fake_send_invoice_email)

        updated = await service.propose_new_time(
            request_id,
            admin_id=str(ObjectId()),
            admin_name="Jordan Smith",
            proposed_start=datetime.now(timezone.utc) + timedelta(days=2),
            proposed_end=datetime.now(timezone.utc) + timedelta(days=2, hours=1),
            note="Does this work better?",
        )
        return updated, captured

    updated, captured = asyncio.run(_run())

    token = updated["proposal"]["token"]
    expected_url = f"https://gocustify.com/confirm-meeting/{token}"

    assert expected_url in captured["text"]
    assert expected_url in captured["html"]
    assert "/api/v1/public/meeting-requests/confirm/" not in captured["text"]
    assert "/api/v1/public/meeting-requests/confirm/" not in captured["html"]
