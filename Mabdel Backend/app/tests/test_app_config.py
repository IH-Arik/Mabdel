from __future__ import annotations


def test_get_app_config_success(client_sql) -> None:
    response = client_sql.get(
        "/api/v1/app/config",
        params={"device_id": "device_001", "current_version": "1.0.0"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["app_name"] == "Mabdel AI"
    assert payload["data"]["maintenance_mode"] is False
    assert payload["data"]["feature_flags"]["voice_assistant"] is True


def test_app_config_force_update_when_client_version_is_old(client_sql) -> None:
    response = client_sql.get(
        "/api/v1/app/config",
        params={"device_id": "device_002", "current_version": "0.8.1"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["force_update"] is True


import asyncio


def test_app_config_maintenance_mode_true(client_sql, mock_db) -> None:
    config = asyncio.run(mock_db.app_configs.find_one())
    assert config is not None
    asyncio.run(mock_db.app_configs.update_one({"_id": config["_id"]}, {"$set": {"maintenance_mode": True}}))

    response = client_sql.get("/api/v1/app/config", params={"device_id": "device_003"})
    assert response.status_code == 200
    assert response.json()["data"]["maintenance_mode"] is True
