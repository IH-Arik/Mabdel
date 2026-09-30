from __future__ import annotations

import asyncio

from app.tests.test_ai_call_scheduling import _owner_with_org


def _provider(client, headers, name, role_title=None):
    return client.post("/api/v1/smartflow/providers", headers=headers, json={"name": name, "role_title": role_title}).json()["data"]["id"]


def _appointment_type(client, headers, name, minutes):
    return client.post("/api/v1/smartflow/appointment-types", headers=headers, json={"name": name, "duration_minutes": minutes}).json()["data"]["id"]


def _event(client, headers, **overrides):
    body = {"title": "Meeting", "starts_at": "2099-10-24T10:00:00", "ends_at": "2099-10-24T11:00:00", **overrides}
    return client.post("/api/v1/smartflow/calendar/events", headers=headers, json=body)


def test_a_manually_booked_event_can_name_a_provider_and_type(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "manual-prov@example.com")
    provider_id = _provider(client, headers, "Dr. Smith", "Dentist")
    type_id = _appointment_type(client, headers, "Cleaning", 45)

    created = _event(client, headers, provider_id=provider_id, appointment_type_id=type_id).json()["data"]
    assert created["provider_id"] == provider_id and created["provider_name"] == "Dr. Smith"
    assert created["appointment_type_id"] == type_id and created["appointment_type_name"] == "Cleaning"

    fetched = client.get(f"/api/v1/smartflow/calendar/events/{created['id']}", headers=headers).json()["data"]
    assert fetched["provider_name"] == "Dr. Smith" and fetched["appointment_type_name"] == "Cleaning"


def test_two_different_providers_can_be_manually_booked_for_the_same_time(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "manual-parallel@example.com")
    smith_id = _provider(client, headers, "Dr. Smith")
    jane_id = _provider(client, headers, "Hygienist Jane")

    assert _event(client, headers, provider_id=smith_id).status_code == 201
    assert _event(client, headers, provider_id=jane_id).status_code == 201  # same time, different provider: no clash


def test_the_same_provider_cannot_be_double_booked(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "manual-clash@example.com")
    smith_id = _provider(client, headers, "Dr. Smith")
    assert _event(client, headers, provider_id=smith_id).status_code == 201
    clash = _event(client, headers, provider_id=smith_id, starts_at="2099-10-24T10:30:00", ends_at="2099-10-24T11:30:00")
    assert clash.status_code == 409


def test_editing_an_event_to_add_a_provider_is_checked_against_that_provider(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "manual-edit@example.com")
    smith_id = _provider(client, headers, "Dr. Smith")
    busy = _event(client, headers, provider_id=smith_id).json()["data"]
    free_slot = _event(client, headers, starts_at="2099-10-24T14:00:00", ends_at="2099-10-24T15:00:00").json()["data"]

    # moving the un-provider'd event onto Dr. Smith's busy time is fine until a provider is named
    clash = client.patch(
        f"/api/v1/smartflow/calendar/events/{free_slot['id']}", headers=headers,
        json={"starts_at": "2099-10-24T10:30:00", "ends_at": "2099-10-24T11:30:00", "provider_id": smith_id},
    )
    assert clash.status_code == 409
    assert busy["id"]  # sanity


def test_an_unrecognised_provider_id_is_stored_but_names_nothing(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "manual-badid@example.com")
    created = _event(client, headers, provider_id="000000000000000000000000").json()["data"]
    assert created["provider_id"] == "000000000000000000000000" and created["provider_name"] is None
