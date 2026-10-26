from __future__ import annotations

import asyncio


def test_get_onboarding_slides_returns_active_sorted(client_sql, mock_db) -> None:
    slide = asyncio.run(mock_db.onboarding_slides.find_one({"sort_order": 2}))
    assert slide is not None
    asyncio.run(mock_db.onboarding_slides.update_one({"_id": slide["_id"]}, {"$set": {"is_active": False}}))

    response = client_sql.get("/api/v1/onboarding/slides")
    assert response.status_code == 200
    slides = response.json()["data"]
    assert len(slides) == 2
    assert [item["sort_order"] for item in slides] == [1, 3]


def test_onboarding_progress_create_and_fetch(client_sql) -> None:
    save_response = client_sql.post(
        "/api/v1/onboarding/progress",
        json={"device_id": "device_progress", "current_step": 1},
    )
    assert save_response.status_code == 200
    assert save_response.json()["data"]["current_step"] == 1

    fetch_response = client_sql.get("/api/v1/onboarding/progress", params={"device_id": "device_progress"})
    assert fetch_response.status_code == 200
    assert fetch_response.json()["data"]["current_step"] == 1


def test_onboarding_progress_allows_multiple_device_only_records(client_sql) -> None:
    first_response = client_sql.post(
        "/api/v1/onboarding/progress",
        json={"device_id": "device_progress_one", "current_step": 1},
    )
    assert first_response.status_code == 200

    second_response = client_sql.post(
        "/api/v1/onboarding/skip",
        json={"device_id": "device_progress_two", "current_step": 1},
    )
    assert second_response.status_code == 200
    assert second_response.json()["data"]["is_skipped"] is True


def test_onboarding_skip_complete_reset_flow(client_sql) -> None:
    skip_response = client_sql.post(
        "/api/v1/onboarding/skip",
        json={"device_id": "device_skip", "current_step": 1},
    )
    assert skip_response.status_code == 200
    assert skip_response.json()["data"]["is_skipped"] is True

    complete_response = client_sql.post(
        "/api/v1/onboarding/complete",
        json={"device_id": "device_complete", "current_step": 3},
    )
    assert complete_response.status_code == 200
    assert complete_response.json()["data"]["is_completed"] is True

    reset_response = client_sql.post(
        "/api/v1/onboarding/reset",
        json={"device_id": "device_complete"},
    )
    assert reset_response.status_code == 200
    data = reset_response.json()["data"]
    assert data["is_completed"] is False
    assert data["is_skipped"] is False
    assert data["current_step"] == 0


def test_onboarding_progress_concurrent_saves_do_not_duplicate_key_error(client_sql) -> None:
    """Two onboarding-progress saves landing at the same moment for two different
    devices used to be able to both read the same "next id" before either had
    inserted, so the second one failed with a DuplicateKeyError (E11000) instead
    of a 200. The fix makes the create path a single atomic upsert so this can't
    race."""
    import asyncio as _asyncio

    import httpx

    async def _save(device_id: str) -> httpx.Response:
        transport = httpx.ASGITransport(app=client_sql.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
            return await ac.post(
                "/api/v1/onboarding/progress",
                json={"device_id": device_id, "current_step": 1},
            )

    async def _run_all():
        return await _asyncio.gather(
            _save("device_race_one"),
            _save("device_race_two"),
            _save("device_race_three"),
        )

    responses = _asyncio.run(_run_all())
    for response in responses:
        assert response.status_code == 200, response.text
