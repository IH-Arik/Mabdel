from __future__ import annotations

import asyncio

from app.core.security import hash_password
from app.utils.helpers import utc_now


async def _seed_admin(mock_db, *, email: str = "legal-admin@example.com", password: str = "AdminPass123!") -> tuple[str, str]:
    result = await mock_db.users.insert_one(
        {
            "full_name": "Legal Admin",
            "email": email,
            "hashed_password": hash_password(password),
            "role": "admin",
            "is_verified": True,
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }
    )
    return str(result.inserted_id), password


def test_admin_can_edit_legal_content_and_public_page_stays_in_sync(client, mock_db) -> None:
    _, password = asyncio.run(_seed_admin(mock_db))

    login_response = client.post(
        "/api/v1/dashboard/admin/auth/login",
        json={"email": "legal-admin@example.com", "password": password},
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {access_token}"}

    get_response = client.get(
        "/api/v1/dashboard/admin/settings/content",
        params={"type": "privacy-policy"},
        headers=headers,
    )
    assert get_response.status_code == 200
    assert "Privacy Policy" in get_response.json()["data"]

    update_response = client.post(
        "/api/v1/dashboard/admin/settings/content",
        json={
            "type": "privacy-policy",
            "content": "Privacy Policy\n\nAdmin runtime verification paragraph.",
        },
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["data"] is True

    public_response = client.get("/api/v1/content/privacy-policy")
    assert public_response.status_code == 200
    blocks = public_response.json()["data"]["blocks"]
    assert any("Admin runtime verification paragraph." in block["body"] for block in blocks)
