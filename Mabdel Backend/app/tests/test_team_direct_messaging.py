from __future__ import annotations

import asyncio

from app.tests.conftest import grant_owner_role


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _signup(client, mock_db, email: str, name: str) -> tuple[dict[str, str], str]:
    assert client.post(
        "/api/v1/auth/register",
        json={"full_name": name, "email": email, "password": "SecurePass2024!"},
    ).status_code == 201
    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    assert client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "code": otp["code"], "purpose": "signup"},
    ).status_code == 200
    grant_owner_role(mock_db, email)
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login.status_code == 200

    user = asyncio.run(mock_db.users.find_one({"email": email}))
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}, str(user["_id"])


def _same_org(mock_db, *user_ids: str) -> None:
    """Colleagues on one business account — how the product actually pairs users."""
    from bson import ObjectId

    async def _apply() -> None:
        for uid in user_ids:
            await mock_db.users.update_one(
                {"_id": ObjectId(uid)}, {"$set": {"organization_id": user_ids[0]}}
            )

    asyncio.run(_apply())


def test_colleague_receives_a_direct_message(client, mock_db) -> None:
    """A sends B a message; B must see both the conversation and the message."""
    a_headers, a_id = _signup(client, mock_db, "dm-sender@example.com", "User A")
    b_headers, b_id = _signup(client, mock_db, "dm-recipient@example.com", "User B")
    _same_org(mock_db, a_id, b_id)

    created = client.post(
        "/api/v1/smartflow/conversations",
        headers=a_headers,
        json={"title": "User B", "type": "direct", "platform": "ai", "member_ids": [b_id]},
    )
    assert created.status_code == 201, created.text
    conversation_id = created.json()["data"]["id"]

    sent = client.post(
        "/api/v1/smartflow/messages",
        headers=a_headers,
        json={
            "conversation_id": conversation_id,
            "platform": "ai",
            "direction": "outbound",
            "content": "bolen",
        },
    )
    assert sent.status_code == 201, sent.text

    # B's sidebar must list the conversation.
    b_list = client.get("/api/v1/smartflow/conversations", headers=b_headers, params={"page": 1, "page_size": 50})
    assert b_list.status_code == 200, b_list.text
    b_conversations = {item["id"]: item for item in b_list.json()["data"]["items"]}
    assert conversation_id in b_conversations, "recipient cannot see the conversation at all"

    # ...and it must not read as an empty thread ("No messages" in the sidebar).
    preview = b_conversations[conversation_id].get("last_message_preview")
    assert preview and "bolen" in preview, f"recipient's sidebar shows no message preview: {preview!r}"

    # B must be able to open it and read A's message.
    b_messages = client.get(
        f"/api/v1/smartflow/conversations/{conversation_id}/messages",
        headers=b_headers,
        params={"page": 1, "page_size": 50},
    )
    assert b_messages.status_code == 200, b_messages.text
    contents = [m["content"] for m in b_messages.json()["data"]["items"]]
    assert "bolen" in contents, f"recipient cannot read the message; got {contents}"


def test_recipient_gets_a_realtime_inbox_push_with_the_preview(client, mock_db, monkeypatch) -> None:
    """The Messenger-style behaviour: B's sidebar updates without a refresh, and the
    pushed conversation carries the message preview rather than an empty thread."""
    from app.core.realtime import inbox_realtime_hub

    a_headers, a_id = _signup(client, mock_db, "rt-sender@example.com", "RT A")
    _, b_id = _signup(client, mock_db, "rt-recipient@example.com", "RT B")
    _same_org(mock_db, a_id, b_id)

    conversation_id = client.post(
        "/api/v1/smartflow/conversations",
        headers=a_headers,
        json={"title": "RT B", "type": "direct", "platform": "ai", "member_ids": [b_id]},
    ).json()["data"]["id"]

    published: list[tuple[str, str, dict]] = []

    async def fake_publish(channel: str, event: str, data: dict) -> None:
        published.append((channel, event, data))

    monkeypatch.setattr(inbox_realtime_hub, "publish", fake_publish)

    assert client.post(
        "/api/v1/smartflow/messages",
        headers=a_headers,
        json={"conversation_id": conversation_id, "platform": "ai", "direction": "outbound", "content": "ping"},
    ).status_code == 201

    to_recipient = [d for channel, event, d in published if channel == b_id and event == "inbox.updated"]
    assert to_recipient, f"no inbox push reached the recipient; channels seen: {[c for c, _, _ in published]}"

    preview = (to_recipient[-1].get("conversation") or {}).get("last_message_preview")
    assert preview and "ping" in preview, f"recipient's realtime push carried no preview: {preview!r}"


def _unread_for(client, headers: dict[str, str], conversation_id: str) -> int:
    items = client.get(
        "/api/v1/smartflow/conversations", headers=headers, params={"page": 1, "page_size": 50}
    ).json()["data"]["items"]
    return next(item["unread_count"] for item in items if item["id"] == conversation_id)


def test_unread_badge_tracks_each_member_separately(client, mock_db) -> None:
    """A colleague's message has to count as unread *for the recipient only*.

    Unread was stamped per message from its direction (inbound == from a customer ==
    unread), which fits an external channel but not an internal thread: A messaging B
    is "outbound", so it was written as 0 unread and B's sidebar never lit up.
    """
    a_headers, a_id = _signup(client, mock_db, "unread-a@example.com", "Unread A")
    b_headers, b_id = _signup(client, mock_db, "unread-b@example.com", "Unread B")
    _same_org(mock_db, a_id, b_id)

    conversation_id = client.post(
        "/api/v1/smartflow/conversations",
        headers=a_headers,
        json={"title": "Unread B", "type": "direct", "platform": "ai", "member_ids": [b_id]},
    ).json()["data"]["id"]

    assert client.post(
        "/api/v1/smartflow/messages",
        headers=a_headers,
        json={"conversation_id": conversation_id, "platform": "ai", "direction": "outbound", "content": "ping"},
    ).status_code == 201

    assert _unread_for(client, b_headers, conversation_id) == 1, "recipient's badge never lit up"
    assert _unread_for(client, a_headers, conversation_id) == 0, "sender must not be unread on their own message"

    # The header/nav total has to agree with the per-conversation badge.
    summary = client.get("/api/v1/smartflow/messages/unread-summary", headers=b_headers)
    assert summary.status_code == 200, summary.text
    assert summary.json()["data"]["total_unread"] >= 1, "recipient's overall unread total stayed at zero"

    # Opening the thread clears it for B, and only for B.
    assert client.post(
        f"/api/v1/smartflow/conversations/{conversation_id}/mark-read", headers=b_headers
    ).status_code == 200
    assert _unread_for(client, b_headers, conversation_id) == 0, "opening the thread did not clear the badge"

    # B answers: now A is the one with an unread message.
    assert client.post(
        "/api/v1/smartflow/messages",
        headers=b_headers,
        json={"conversation_id": conversation_id, "platform": "ai", "direction": "outbound", "content": "pong"},
    ).status_code == 201

    assert _unread_for(client, a_headers, conversation_id) == 1, "owner's badge never lit up for the reply"
    assert _unread_for(client, b_headers, conversation_id) == 0, "replier must not be unread on their own message"


def test_reply_is_visible_to_the_conversation_owner(client, mock_db) -> None:
    """The reply direction: B answers, and A (who owns the conversation) must see it."""
    a_headers, a_id = _signup(client, mock_db, "dm-owner@example.com", "Owner A")
    b_headers, b_id = _signup(client, mock_db, "dm-member@example.com", "Member B")
    _same_org(mock_db, a_id, b_id)

    conversation_id = client.post(
        "/api/v1/smartflow/conversations",
        headers=a_headers,
        json={"title": "Member B", "type": "direct", "platform": "ai", "member_ids": [b_id]},
    ).json()["data"]["id"]

    assert client.post(
        "/api/v1/smartflow/messages",
        headers=a_headers,
        json={"conversation_id": conversation_id, "platform": "ai", "direction": "outbound", "content": "hi B"},
    ).status_code == 201

    reply = client.post(
        "/api/v1/smartflow/messages",
        headers=b_headers,
        json={"conversation_id": conversation_id, "platform": "ai", "direction": "outbound", "content": "hi back A"},
    )
    assert reply.status_code == 201, reply.text

    owner_view = client.get(
        f"/api/v1/smartflow/conversations/{conversation_id}/messages",
        headers=a_headers,
        params={"page": 1, "page_size": 50},
    )
    assert owner_view.status_code == 200, owner_view.text
    contents = [m["content"] for m in owner_view.json()["data"]["items"]]
    assert "hi back A" in contents, f"owner cannot see the colleague's reply; got {contents}"


# ── Cross-organization isolation ────────────────────────────────────────


def test_stranger_from_a_different_business_cannot_start_a_conversation(client, mock_db) -> None:
    """A and B are on two unrelated businesses (different organization_id, never
    linked via _same_org). Team direct messaging is for colleagues on one business
    account — A must not be able to open a conversation with B just by knowing B's
    user id."""
    a_headers, _ = _signup(client, mock_db, "xorg-a@example.com", "Business A Owner")
    _, b_id = _signup(client, mock_db, "xorg-b@example.com", "Business B Owner")

    created = client.post(
        "/api/v1/smartflow/conversations",
        headers=a_headers,
        json={"title": "Business B Owner", "type": "direct", "platform": "ai", "member_ids": [b_id]},
    )
    assert created.status_code == 403, created.text
    assert created.json()["error"]["code"] == "CONVERSATION_MEMBER_NOT_IN_ORGANIZATION"


def test_stranger_listed_in_member_ids_still_blocked_when_organization_id_is_stamped(client, mock_db) -> None:
    """Defense in depth on the read/send side: even if member_ids somehow ends up
    containing a stranger's id (a bug elsewhere, data corruption, a future write path
    that forgets the organization check), a conversation that has an organization_id
    stamped on it must still reject anyone outside that organization — the access
    check does not simply trust member_ids the way it did before this fix."""
    a_headers, a_id = _signup(client, mock_db, "xorg-e@example.com", "Business E Owner")
    stranger_headers, stranger_id = _signup(client, mock_db, "xorg-f@example.com", "Business F Owner")
    _same_org(mock_db, a_id)  # a solo business — just needs an organization_id of its own
    a_org = a_id

    async def _insert_conversation_with_org_stamped() -> str:
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        result = await mock_db.conversations.insert_one(
            {
                "user_id": a_id,
                "title": "Stamped",
                "contact_id": None,
                "type": "direct",
                "platform": "ai",
                "member_ids": [a_id, stranger_id],  # stranger should never have landed here
                "organization_id": a_org,
                "archived": False,
                "created_at": now,
                "updated_at": now,
            }
        )
        return str(result.inserted_id)

    conversation_id = asyncio.run(_insert_conversation_with_org_stamped())

    response = client.get(f"/api/v1/smartflow/conversations/{conversation_id}", headers=stranger_headers)
    assert response.status_code == 404, response.text

    # The rightful owner (same org, correctly listed) is unaffected.
    owner_response = client.get(f"/api/v1/smartflow/conversations/{conversation_id}", headers=a_headers)
    assert owner_response.status_code == 200, owner_response.text
