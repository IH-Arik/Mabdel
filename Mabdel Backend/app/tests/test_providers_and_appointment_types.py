from __future__ import annotations

from app.tests.test_team_direct_messaging import _same_org, _signup


def test_a_provider_can_be_a_named_resource_or_a_linked_colleague(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "prov-basic-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "prov-basic-mate@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)

    named = client.post("/api/v1/smartflow/providers", headers=owner_headers, json={"name": "Dr. Smith", "role_title": "Dentist"})
    assert named.status_code == 201, named.text
    assert named.json()["data"]["linked_user_id"] is None

    linked = client.post("/api/v1/smartflow/providers", headers=owner_headers, json={"name": "Mate", "linked_user_id": mate_id})
    assert linked.status_code == 201, linked.text
    assert linked.json()["data"]["linked_user_id"] == mate_id

    # a teammate sees both, org-wide
    listed = client.get("/api/v1/smartflow/providers", headers=mate_headers).json()["data"]
    assert {item["name"] for item in listed} == {"Dr. Smith", "Mate"}


def test_a_provider_cannot_be_linked_to_someone_outside_the_business(client, mock_db):
    headers, _ = _signup(client, mock_db, "prov-outside@example.com", "Owner")
    _, stranger_id = _signup(client, mock_db, "prov-outside-stranger@example.com", "Stranger")
    response = client.post("/api/v1/smartflow/providers", headers=headers, json={"name": "X", "linked_user_id": stranger_id})
    assert response.status_code == 400


def test_provider_update_and_delete(client, mock_db):
    headers, _ = _signup(client, mock_db, "prov-crud@example.com", "Owner")
    provider = client.post("/api/v1/smartflow/providers", headers=headers, json={"name": "Dr. Lee"}).json()["data"]

    updated = client.patch(f"/api/v1/smartflow/providers/{provider['id']}", headers=headers, json={"active": False}).json()["data"]
    assert updated["active"] is False and updated["name"] == "Dr. Lee"

    assert client.delete(f"/api/v1/smartflow/providers/{provider['id']}", headers=headers).status_code == 200
    assert client.get("/api/v1/smartflow/providers", headers=headers).json()["data"] == []


def test_appointment_type_crud_and_duration_bounds(client, mock_db):
    headers, _ = _signup(client, mock_db, "atype-crud@example.com", "Owner")
    created = client.post("/api/v1/smartflow/appointment-types", headers=headers, json={"name": "Cleaning", "duration_minutes": 45})
    assert created.status_code == 201
    type_id = created.json()["data"]["id"]

    too_long = client.post("/api/v1/smartflow/appointment-types", headers=headers, json={"name": "X", "duration_minutes": 1000})
    assert too_long.status_code == 422

    updated = client.patch(f"/api/v1/smartflow/appointment-types/{type_id}", headers=headers, json={"duration_minutes": 60}).json()["data"]
    assert updated["duration_minutes"] == 60

    assert client.delete(f"/api/v1/smartflow/appointment-types/{type_id}", headers=headers).status_code == 200
    assert client.get("/api/v1/smartflow/appointment-types", headers=headers).json()["data"] == []


def test_a_stranger_cannot_see_or_edit_another_businesss_providers(client, mock_db):
    owner_headers, _ = _signup(client, mock_db, "prov-priv-owner@example.com", "Owner")
    stranger_headers, _ = _signup(client, mock_db, "prov-priv-stranger@example.com", "Stranger")
    provider = client.post("/api/v1/smartflow/providers", headers=owner_headers, json={"name": "Dr. Kim"}).json()["data"]

    assert client.get("/api/v1/smartflow/providers", headers=stranger_headers).json()["data"] == []
    assert client.patch(f"/api/v1/smartflow/providers/{provider['id']}", headers=stranger_headers, json={"active": False}).status_code == 404
    assert client.delete(f"/api/v1/smartflow/providers/{provider['id']}", headers=stranger_headers).status_code == 404
