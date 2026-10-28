from __future__ import annotations

import asyncio

import pytest
from starlette.websockets import WebSocketDisconnect

from app.tests.test_team_direct_messaging import _signup

# Regression: blocking a user only flipped the DB status field. The shared
# get_current_user dependency and login never checked it, so an existing
# token kept working and a blocked user could still log in fresh.


def test_a_blocked_users_existing_token_is_rejected(client, mock_db):
    headers, user_id = _signup(client, mock_db, "blocked-existing-token@example.com", "User")
    assert client.get("/api/v1/smartflow/contacts", headers=headers).status_code == 200

    from bson import ObjectId
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"status": "blocked"}}))

    response = client.get("/api/v1/smartflow/contacts", headers=headers)
    assert response.status_code == 403


def test_a_blocked_user_cannot_log_in(client, mock_db):
    email = "blocked-login@example.com"
    headers, user_id = _signup(client, mock_db, email, "User")

    from bson import ObjectId
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"status": "blocked"}}))

    response = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert response.status_code == 403


def test_a_blocked_users_still_valid_token_is_rejected_by_the_inbox_websocket(client, mock_db):
    """Regression for R08: the inbox/conversation websockets authenticated the
    token/user separately from get_current_user and never checked blocked
    status - a blocked account's still-valid access token kept working here
    even though the matching REST routes correctly rejected it with 403."""
    email = "blocked-ws-inbox@example.com"
    headers, user_id = _signup(client, mock_db, email, "User")
    token = headers["Authorization"].split(" ", 1)[1]

    from bson import ObjectId
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"status": "blocked"}}))

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(f"/api/v1/smartflow/ws/inbox?token={token}"):
            pass
    assert exc_info.value.code == 1008


def test_a_blocked_users_still_valid_token_is_rejected_by_the_conversation_websocket(client, mock_db):
    email = "blocked-ws-conv@example.com"
    headers, user_id = _signup(client, mock_db, email, "User")
    token = headers["Authorization"].split(" ", 1)[1]

    contact_response = client.post(
        "/api/v1/smartflow/contacts",
        headers=headers,
        json={"name": "Alex Rivera", "email": "alex-blocked-ws@example.com"},
    )
    assert contact_response.status_code == 201
    conversation_response = client.post(
        "/api/v1/smartflow/conversations",
        headers=headers,
        json={"contact_id": contact_response.json()["data"]["id"], "type": "direct", "platform": "facebook_messenger", "member_ids": []},
    )
    assert conversation_response.status_code == 201
    conversation_id = conversation_response.json()["data"]["id"]

    from bson import ObjectId
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"status": "blocked"}}))

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(f"/api/v1/smartflow/ws/conversations/{conversation_id}?token={token}"):
            pass
    assert exc_info.value.code == 1008
