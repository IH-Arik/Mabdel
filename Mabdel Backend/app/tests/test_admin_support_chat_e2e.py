from __future__ import annotations

from app.tests.conftest import grant_role
from app.tests.test_team_direct_messaging import _signup

# End-to-end coverage for the support chat loop (FEAT-CHAT-08): a user's
# message via /smartflow/support/messages must actually reach the
# madbel-dashboard "Inbox" screen (/dashboard/admin/chats), and an admin's
# reply from there must flow back to the user's /smartflow/support/messages
# feed. Both sides already shared the support_sessions/support_messages
# collections before this test was added - this proves that wiring works
# rather than just asserting it from reading the code.


def test_a_users_support_message_reaches_the_admin_inbox_and_the_reply_reaches_the_user(client, mock_db):
    user_headers, _ = _signup(client, mock_db, "support-chat-user@example.com", "User")
    admin_headers, _ = _signup(client, mock_db, "support-chat-admin@example.com", "Admin")
    grant_role(mock_db, "support-chat-admin@example.com", "super_admin")

    message_response = client.post(
        "/api/v1/smartflow/support/messages",
        headers=user_headers,
        json={"topic": "billing", "content": "Why was I charged twice this month?"},
    )
    assert message_response.status_code == 201
    session_id = message_response.json()["data"]["session_id"]

    inbox_response = client.get("/api/v1/dashboard/admin/chats", headers=admin_headers)
    assert inbox_response.status_code == 200
    sessions = inbox_response.json()["data"]
    assert any(s["id"] == session_id and s["last_message"] == "Why was I charged twice this month?" for s in sessions)

    reply_response = client.post(
        f"/api/v1/dashboard/admin/chats/{session_id}/messages",
        headers=admin_headers,
        params={"text": "Looking into it now, one sec."},
    )
    assert reply_response.status_code == 200

    user_feed = client.get(
        f"/api/v1/smartflow/support/messages?session_id={session_id}",
        headers=user_headers,
    )
    assert user_feed.status_code == 200
    contents = [(m["sender_type"], m["content"]) for m in user_feed.json()["data"]["items"]]
    assert ("support", "Looking into it now, one sec.") in contents
