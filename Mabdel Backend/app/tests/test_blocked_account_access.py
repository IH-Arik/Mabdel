from __future__ import annotations

import asyncio

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
