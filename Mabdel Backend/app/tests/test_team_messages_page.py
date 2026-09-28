from __future__ import annotations

import asyncio

from app.tests.test_shared_inbox import _inbound, _list
from app.tests.test_team_direct_messaging import _same_org, _signup


def _team_chat(client, headers, member_id, title="Team chat"):
    created = client.post(
        "/api/v1/smartflow/conversations",
        headers=headers,
        json={"title": title, "type": "direct", "platform": "ai", "member_ids": [member_id]},
    )
    assert created.status_code == 201, created.text
    return created.json()["data"]["id"]


def test_the_messages_page_lists_only_team_chats_even_when_customers_are_busier(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "team-page-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "team-page-mate@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)
    team_id = _team_chat(client, owner_headers, mate_id)
    # 120 customer threads, all newer than the team chat: a plain 100-item page used to
    # be filled entirely by them, so the team chat vanished from Messages.
    for index in range(120):
        _inbound(mock_db, owner_id, "whatsapp", f"88017000{index:05d}@s.whatsapp.net", f"hello {index}")
    _inbound(mock_db, owner_id, "telegram", "tg-1", "hi from telegram")

    for headers in (owner_headers, mate_headers):
        team = _list(client, headers, scope="team", page_size=100)
        assert [item["id"] for item in team["items"]] == [team_id]
        assert team["items"][0]["is_customer_conversation"] is False
        assert team["summary"]["active_count"] == 1

    customer = _list(client, mate_headers, scope="customer", page_size=100)
    assert len(customer["items"]) == 100 and all(item["is_customer_conversation"] for item in customer["items"])
    assert customer["pagination"]["total"] == 121  # 120 WhatsApp + 1 Telegram
    assert team_id not in {item["id"] for item in customer["items"]}


def test_only_the_person_who_started_a_team_chat_can_archive_it(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "manage-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "manage-mate@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)
    team_id = _team_chat(client, owner_headers, mate_id)
    customer = _inbound(mock_db, owner_id, "whatsapp", "8801711111111@s.whatsapp.net", "hi")

    def flags(headers, **params):
        return {item["id"]: item["can_manage"] for item in _list(client, headers, **params)["items"]}

    assert flags(owner_headers)[team_id] is True
    assert flags(mate_headers)[team_id] is False  # the UI greys the button instead of failing with a 403
    assert flags(mate_headers)[customer["conversation_id"]] is True  # customer threads are the whole team's
    assert client.patch(f"/api/v1/smartflow/conversations/{team_id}/archive", headers=mate_headers).status_code == 403


def test_a_long_thread_can_be_paged_back_to_its_start(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "pages-owner@example.com", "Owner")
    _, mate_id = _signup(client, mock_db, "pages-mate@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)
    team_id = _team_chat(client, owner_headers, mate_id)
    for index in range(45):
        assert client.post(
            "/api/v1/smartflow/messages",
            headers=owner_headers,
            json={"conversation_id": team_id, "platform": "ai", "direction": "outbound", "content": f"message {index:02d}"},
        ).status_code == 201

    first = client.get(f"/api/v1/smartflow/conversations/{team_id}/messages", headers=owner_headers, params={"page": 1, "page_size": 40}).json()["data"]
    older = client.get(f"/api/v1/smartflow/conversations/{team_id}/messages", headers=owner_headers, params={"page": 2, "page_size": 40}).json()["data"]
    assert first["pagination"]["pages"] == 2
    assert first["items"][0]["content"] == "message 44"  # newest first, so page 1 is the latest chat
    assert older["items"][-1]["content"] == "message 00"  # and page 2 reaches the very first message
    assert len(first["items"]) + len(older["items"]) == 45


def test_each_teammate_sees_their_own_messages_as_theirs(client, mock_db):
    """The stored direction is the sender's; the API must say it from the viewer's side."""
    a_headers, a_id = _signup(client, mock_db, "sides-alpha@example.com", "User Alpha")
    b_headers, b_id = _signup(client, mock_db, "sides-bravo@example.com", "User Bravo")
    _same_org(mock_db, a_id, b_id)
    conv = _team_chat(client, a_headers, b_id)
    for headers, text in ((a_headers, "from A"), (b_headers, "from B")):
        assert client.post(
            "/api/v1/smartflow/messages", headers=headers,
            json={"conversation_id": conv, "platform": "ai", "direction": "outbound", "content": text},
        ).status_code == 201

    def sides(headers):
        items = client.get(f"/api/v1/smartflow/conversations/{conv}/messages", headers=headers).json()["data"]["items"]
        return {m["content"]: m["direction"] for m in items}

    assert sides(a_headers) == {"from A": "outbound", "from B": "inbound"}
    assert sides(b_headers) == {"from A": "inbound", "from B": "outbound"}


def test_customer_threads_and_ai_chats_keep_their_stored_direction(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "sides-owner@example.com", "User Owner")
    mate_headers, mate_id = _signup(client, mock_db, "sides-mate@example.com", "User Mate")
    _same_org(mock_db, owner_id, mate_id)
    customer = _inbound(mock_db, owner_id, "whatsapp", "8801722222222@s.whatsapp.net", "hello from the customer")
    reply = client.post(
        "/api/v1/smartflow/messages", headers=mate_headers,
        json={"conversation_id": customer["conversation_id"], "contact_id": customer["contact_id"], "platform": "whatsapp", "direction": "outbound", "content": "reply from a teammate"},
    )
    assert reply.status_code == 201, reply.text

    for headers in (owner_headers, mate_headers):
        items = client.get(f"/api/v1/smartflow/conversations/{customer['conversation_id']}/messages", headers=headers).json()["data"]["items"]
        assert {m["content"]: m["direction"] for m in items} == {"hello from the customer": "inbound", "reply from a teammate": "outbound"}
