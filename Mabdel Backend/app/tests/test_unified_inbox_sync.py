from __future__ import annotations

from app.core.realtime import inbox_realtime_hub
from app.tests.test_shared_inbox import _inbound
from app.tests.test_team_direct_messaging import _same_org, _signup


def _capture(monkeypatch):
    events: list[tuple[str, str, dict]] = []

    async def fake_publish(user_id, event, data):
        events.append((str(user_id), event, data))

    monkeypatch.setattr(inbox_realtime_hub, "publish", fake_publish)
    return events


def _thread(client, mock_db):
    _, owner_id = _signup(client, mock_db, "sync-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "sync-mate@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)
    message = _inbound(mock_db, owner_id, "whatsapp", "8801733333333@s.whatsapp.net", "hi", name="Karim")
    return owner_id, mate_id, mate_headers, message["conversation_id"]


def test_reading_a_customer_thread_clears_the_badge_on_every_teammates_screen(client, mock_db, monkeypatch):
    owner_id, mate_id, mate_headers, conversation_id = _thread(client, mock_db)
    events = _capture(monkeypatch)

    assert client.post(f"/api/v1/smartflow/conversations/{conversation_id}/mark-read", headers=mate_headers).status_code == 200

    told = {user: data["conversation"]["unread_count"] for user, event, data in events if event == "inbox.updated"}
    assert told.get(owner_id) == 0 and told.get(mate_id) == 0


def test_archiving_a_customer_thread_updates_every_teammates_list(client, mock_db, monkeypatch):
    owner_id, mate_id, mate_headers, conversation_id = _thread(client, mock_db)
    events = _capture(monkeypatch)

    response = client.patch(f"/api/v1/smartflow/conversations/{conversation_id}/archive", headers=mate_headers, params={"archived": True})
    assert response.status_code == 200, response.text

    told = {user: data["conversation"]["archived"] for user, event, data in events if event == "inbox.updated"}
    assert told.get(owner_id) is True and told.get(mate_id) is True


def test_deleting_a_customer_thread_removes_it_from_the_other_teammates_screens(client, mock_db, monkeypatch):
    owner_id, mate_id, mate_headers, conversation_id = _thread(client, mock_db)
    events = _capture(monkeypatch)

    assert client.delete(f"/api/v1/smartflow/conversations/{conversation_id}", headers=mate_headers).status_code in (200, 204)

    removed = [user for user, event, data in events if event == "inbox.conversation_deleted" and data["conversation_id"] == conversation_id]
    assert removed == [owner_id]  # the deleter's own screen already knows
