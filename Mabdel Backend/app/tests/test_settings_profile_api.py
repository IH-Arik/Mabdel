from __future__ import annotations

import asyncio
from pathlib import Path

from app.core.config import settings
from app.services.smartflow_service import SmartFlowService


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(
        db.otp_codes.find_one(
            {"email": email, "purpose": purpose},
            sort=[("created_at", -1)],
        )
    )
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "settings-user@example.com") -> tuple[dict[str, str], str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "John Doe", "email": email, "password": "SecurePass2024!"},
    )
    assert register_response.status_code == 201

    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify_response = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "code": otp["code"], "purpose": "signup"},
    )
    assert verify_response.status_code == 200

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePass2024!"},
    )
    assert login_response.status_code == 200
    payload = login_response.json()["data"]
    return {"Authorization": f"Bearer {payload['access_token']}"}, payload["user"]["id"]


def test_content_pages_back_account_settings(client) -> None:
    for path, expected_slug in [
        ("/api/v1/content/about-us", "about-us"),
        ("/api/v1/content/terms-and-conditions", "terms-and-conditions"),
        ("/api/v1/content/privacy-policy", "privacy-policy"),
    ]:
        response = client.get(path)
        assert response.status_code == 200
        payload = response.json()["data"]
        assert payload["slug"] == expected_slug
        assert payload["title"]
        assert payload["blocks"]


def test_business_profile_view_update_and_logo_upload(client, mock_db, tmp_path, monkeypatch) -> None:
    headers, user_id = _auth_headers(client, mock_db, email="business-profile@example.com")
    monkeypatch.setattr(settings, "MEDIA_ROOT", str(tmp_path))

    default_response = client.get("/api/v1/smartflow/business-profile", headers=headers)
    assert default_response.status_code == 200
    assert default_response.json()["data"]["email"] == "business-profile@example.com"

    update_response = client.patch(
        "/api/v1/smartflow/business-profile",
        headers=headers,
        json={
            "business_name": "TechVanguard Solutions Ltd.",
            "email": "ops@techvanguard.io",
            "phone_number": "+1 (555) 012-3456",
            "website": "www.techvanguard.io",
            "office_address": {
                "street_address": "101 Innovation Way",
                "suite": "Suite 400",
                "city": "San Francisco",
                "state": "CA",
                "postal_code": "94105",
                "country": "United States",
            },
        },
    )
    assert update_response.status_code == 200
    profile = update_response.json()["data"]
    assert profile["business_name"] == "TechVanguard Solutions Ltd."
    assert profile["website"] == "https://www.techvanguard.io"
    assert profile["office_location_lines"] == [
        "101 Innovation Way",
        "Suite 400",
        "San Francisco, CA",
        "94105",
        "United States",
    ]
    assert profile["profile_completed"] is True

    logo_response = client.post(
        "/api/v1/smartflow/business-profile/logo",
        headers=headers,
        files={"logo_file": ("logo.png", b"\x89PNG\r\n\x1a\nlogo-bytes", "image/png")},
    )
    assert logo_response.status_code == 200
    logo_url = logo_response.json()["data"]["logo_url"]
    assert f"/media/business_logos/{user_id}/" in logo_url
    assert list((Path(tmp_path) / "business_logos" / user_id).glob("*.png"))


def test_edit_profile_screen_updates_profile_fields_and_avatar(client, mock_db, tmp_path, monkeypatch) -> None:
    headers, user_id = _auth_headers(client, mock_db, email="edit-profile@example.com")
    monkeypatch.setattr(settings, "MEDIA_ROOT", str(tmp_path))

    update_response = client.patch(
        "/api/v1/smartflow/settings",
        headers=headers,
        json={
            "full_name": "Minnie Doe",
            "email": "minnie@gmail.com",
            "date_of_birth": "2005-11-28",
            "country": "Mexico",
        },
    )
    assert update_response.status_code == 200
    profile = update_response.json()["data"]
    assert profile["full_name"] == "Minnie Doe"
    assert profile["email"] == "minnie@gmail.com"
    assert profile["date_of_birth"] == "2005-11-28"
    assert profile["country"] == "Mexico"
    assert profile["email_verification_required"] is True

    avatar_response = client.post(
        "/api/v1/smartflow/settings/avatar",
        headers=headers,
        files={"avatar_file": ("avatar.webp", b"RIFFxxxxWEBPavatar-bytes", "image/webp")},
    )
    assert avatar_response.status_code == 200
    avatar_url = avatar_response.json()["data"]["avatar_url"]
    assert f"/media/profile_avatars/{user_id}/" in avatar_url
    assert list((Path(tmp_path) / "profile_avatars" / user_id).glob("*.webp"))


def test_notification_screen_toggles_are_persisted_and_disable_push(client, mock_db) -> None:
    headers, _ = _auth_headers(client, mock_db, email="notification-settings@example.com")

    default_response = client.get("/api/v1/smartflow/settings/notifications", headers=headers)
    assert default_response.status_code == 200
    defaults = default_response.json()["data"]
    assert defaults["general_notification"] is True
    assert defaults["sound"] is True
    assert defaults["vibrate"] is True

    update_response = client.patch(
        "/api/v1/smartflow/settings/notifications",
        headers=headers,
        json={"general_notification": False, "sound": False, "vibrate": True},
    )
    assert update_response.status_code == 200
    updated = update_response.json()["data"]
    assert updated["general_notification"] is False
    assert updated["sound"] is False
    assert updated["vibrate"] is True

    push_response = client.post(
        "/api/v1/smartflow/devices/push-token",
        headers=headers,
        json={"device_id": "device-1", "token": "push-token-123", "platform": "android"},
    )
    assert push_response.status_code == 200

    user = asyncio.run(mock_db.users.find_one({"email": "notification-settings@example.com"}))
    assert user["notification_preferences"]["general_notification"] is False

    notification = asyncio.run(
        SmartFlowService(mock_db).create_notification(
            user_id=str(user["_id"]),
            notification_type="message",
            title="Muted",
            body="This should not enqueue a push job.",
        )
    )
    jobs = asyncio.run(mock_db.push_dispatch_jobs.find({"notification_id": notification["id"]}).to_list(length=10))
    assert jobs == []


def test_live_support_chat_session_and_messages(client, mock_db) -> None:
    headers, _ = _auth_headers(client, mock_db, email="live-support@example.com")

    session_response = client.get("/api/v1/smartflow/support/session", headers=headers)
    assert session_response.status_code == 200
    session = session_response.json()["data"]
    assert session["agent"]["name"] == "Live Support"
    assert session["agent"]["presence"] == "online"
    assert any(reply["label"] == "Billing Issue" for reply in session["quick_replies"])
    assert session["latest_messages"][0]["sender_type"] == "support"

    message_response = client.post(
        "/api/v1/smartflow/support/messages",
        headers=headers,
        json={
            "topic": "billing",
            "content": "My automated billing rules do not trigger for new clients.",
        },
    )
    assert message_response.status_code == 201
    sent = message_response.json()["data"]
    assert sent["support_typing"] is True
    assert sent["message"]["sender_type"] == "user"

    list_response = client.get(
        f"/api/v1/smartflow/support/messages?session_id={session['id']}",
        headers=headers,
    )
    assert list_response.status_code == 200
    messages = list_response.json()["data"]["items"]
    assert [message["sender_type"] for message in messages] == ["support", "user"]


def test_change_password_accepts_confirmation(client, mock_db) -> None:
    headers, _ = _auth_headers(client, mock_db, email="change-password@example.com")

    mismatch_response = client.post(
        "/api/v1/smartflow/settings/change-password",
        headers=headers,
        json={
            "current_password": "SecurePass2024!",
            "new_password": "NewSecurePass2025!",
            "confirm_password": "AnotherSecurePass2025!",
        },
    )
    assert mismatch_response.status_code == 422

    change_response = client.post(
        "/api/v1/smartflow/settings/change-password",
        headers=headers,
        json={
            "current_password": "SecurePass2024!",
            "new_password": "NewSecurePass2025!",
            "confirm_password": "NewSecurePass2025!",
        },
    )
    assert change_response.status_code == 200
    assert change_response.json()["data"]["changed"] is True

    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": "change-password@example.com", "password": "SecurePass2024!"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "change-password@example.com", "password": "NewSecurePass2025!"},
    )
    assert new_login.status_code == 200


def test_account_delete_revokes_access_to_profile_data(client, mock_db) -> None:
    headers, user_id = _auth_headers(client, mock_db, email="delete-account@example.com")
    contact_response = client.post(
        "/api/v1/smartflow/contacts",
        headers=headers,
        json={"name": "Sarah Cruz", "email": "sarah@example.com"},
    )
    assert contact_response.status_code == 201

    business_response = client.patch(
        "/api/v1/smartflow/business-profile",
        headers=headers,
        json={"business_name": "SmartFlow Innovations", "email": "sara.cruz@example.com"},
    )
    assert business_response.status_code == 200

    delete_response = client.delete("/api/v1/smartflow/account", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted"] is True

    assert asyncio.run(mock_db.users.find_one({"email": "delete-account@example.com"})) is None
    assert asyncio.run(mock_db.contacts.count_documents({"user_id": user_id})) == 0
    assert asyncio.run(mock_db.business_profiles.count_documents({"user_id": user_id})) == 0

    blocked_response = client.get("/api/v1/smartflow/settings", headers=headers)
    assert blocked_response.status_code == 401


def test_subscription_report_and_support_endpoints_cover_settings_menu(client, mock_db) -> None:
    headers, _ = _auth_headers(client, mock_db, email="settings-menu@example.com")

    plans_response = client.get("/api/v1/smartflow/subscription/plans", headers=headers)
    assert plans_response.status_code == 200
    assert {plan["code"] for plan in plans_response.json()["data"]["items"]} >= {"free", "pro", "business"}

    current_response = client.get("/api/v1/smartflow/subscription/current", headers=headers)
    assert current_response.status_code == 200
    assert current_response.json()["data"]["status"] == "free"

    categories_response = client.get("/api/v1/smartflow/reports/categories", headers=headers)
    assert categories_response.status_code == 200
    assert any(item["key"] == "bug" for item in categories_response.json()["data"]["items"])

    report_response = client.post(
        "/api/v1/smartflow/reports",
        headers=headers,
        json={
            "category": "bug",
            "subject": "Business profile issue",
            "description": "The business profile screen did not refresh after saving.",
            "screen": "Business Profile",
        },
    )
    assert report_response.status_code == 201
    assert report_response.json()["data"]["status"] == "open"

    support_response = client.post(
        "/api/v1/smartflow/support/tickets",
        headers=headers,
        json={
            "topic": "technical",
            "subject": "Need upload help",
            "message": "Please help me understand why my logo upload failed.",
        },
    )
    assert support_response.status_code == 201
    assert support_response.json()["data"]["status"] == "open"
