from __future__ import annotations


def test_get_permissions_returns_defaults(client) -> None:
    response = client.get("/api/v1/app/permissions", params={"device_id": "device_perm_001"})

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["device_id"] == "device_perm_001"
    permissions = {item["key"]: item["enabled"] for item in payload["permissions"]}
    assert permissions == {"microphone": True, "notifications": True, "contacts": False}


def test_update_permissions_persists_preferences(client) -> None:
    response = client.put(
        "/api/v1/app/permissions",
        json={
            "device_id": "device_perm_002",
            "microphone_enabled": False,
            "notifications_enabled": True,
            "contacts_enabled": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    permissions = {item["key"]: item["enabled"] for item in payload["permissions"]}
    assert permissions["microphone"] is False
    assert permissions["contacts"] is True

    fetch_response = client.get("/api/v1/app/permissions", params={"device_id": "device_perm_002"})
    assert fetch_response.status_code == 200
    fetched = {item["key"]: item["enabled"] for item in fetch_response.json()["data"]["permissions"]}
    assert fetched == permissions


def test_accept_all_permissions_enables_everything(client) -> None:
    response = client.post("/api/v1/app/permissions/accept-all", json={"device_id": "device_perm_003"})

    assert response.status_code == 200
    permissions = {item["key"]: item["enabled"] for item in response.json()["data"]["permissions"]}
    assert permissions == {"microphone": True, "notifications": True, "contacts": True}
