from __future__ import annotations

from app.tests.test_team_direct_messaging import _same_org, _signup


def _contact(client, headers, name, phone):
    response = client.post("/api/v1/smartflow/contacts", headers=headers, json={"name": name, "phone": phone})
    assert response.status_code == 201, response.text
    return response.json()["data"]["id"]


def _group(client, headers, name, members):
    response = client.post("/api/v1/smartflow/groups", headers=headers, json={"name": name, "member_ids": members})
    assert response.status_code == 201, response.text
    return response.json()["data"]


def test_the_group_list_has_real_pages_and_a_real_total(client, mock_db):
    headers, _ = _signup(client, mock_db, "grp-pages@example.com", "Owner")
    contact = _contact(client, headers, "Sarah", "+8801711111111")
    for index in range(7):
        _group(client, headers, f"Team {index}", [contact])

    first = client.get("/api/v1/smartflow/groups", headers=headers, params={"page": 1, "page_size": 3}).json()["data"]
    second = client.get("/api/v1/smartflow/groups", headers=headers, params={"page": 2, "page_size": 3}).json()["data"]
    third = client.get("/api/v1/smartflow/groups", headers=headers, params={"page": 3, "page_size": 3}).json()["data"]
    assert first["pagination"]["total"] == 7 and first["pagination"]["pages"] == 3
    assert [len(first["items"]), len(second["items"]), len(third["items"])] == [3, 3, 1]
    assert len({item["id"] for page in (first, second, third) for item in page["items"]}) == 7


def test_searching_groups_by_text_with_symbols_does_not_crash(client, mock_db):
    headers, _ = _signup(client, mock_db, "grp-search@example.com", "Owner")
    contact = _contact(client, headers, "Sarah", "+8801722222222")
    _group(client, headers, "Sales (EU)", [contact])
    for term in ("(", "[x", "a*", "Sales ("):
        assert client.get("/api/v1/smartflow/groups", headers=headers, params={"search": term}).status_code == 200, term
    found = client.get("/api/v1/smartflow/groups", headers=headers, params={"search": "Sales ("}).json()["data"]["items"]
    assert [item["name"] for item in found] == ["Sales (EU)"]


def test_a_teammate_can_put_the_businesss_contacts_in_a_group(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "grp-team-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "grp-team-mate@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)
    contact = _contact(client, owner_headers, "Karim", "+8801733333333")  # made by the owner

    group = _group(client, mate_headers, "Follow-ups", [contact])
    assert group["member_count"] == 1 and [member["name"] for member in group["members"]] == ["Karim"]


def test_someone_from_another_business_cannot_be_added_to_a_group(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "grp-out-owner@example.com", "Owner")
    _, stranger_id = _signup(client, mock_db, "grp-out-stranger@example.com", "Stranger")
    mate_headers, mate_id = _signup(client, mock_db, "grp-out-mate@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)
    contact = _contact(client, owner_headers, "Karim", "+8801744444444")

    denied = client.post("/api/v1/smartflow/groups", headers=owner_headers, json={"name": "Leak", "member_ids": [stranger_id]})
    assert denied.status_code == 403

    group = _group(client, owner_headers, "Inside", [contact])
    added = client.post(f"/api/v1/smartflow/groups/{group['id']}/members", headers=owner_headers, json={"member_ids": [stranger_id]})
    assert added.status_code == 403

    colleague = client.post("/api/v1/smartflow/groups/" + group["id"] + "/members", headers=owner_headers, json={"member_ids": [mate_id]})
    assert colleague.status_code == 200 and colleague.json()["data"]["member_count"] == 2
    assert "Mate" in [member["name"] for member in colleague.json()["data"]["members"]]


def test_only_the_owner_can_manage_and_a_member_can_leave_and_loses_the_chat(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "grp-leave-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "grp-leave-mate@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)
    contact = _contact(client, owner_headers, "Karim", "+8801755555555")
    group = _group(client, owner_headers, "Crew", [contact, mate_id])
    assert group["can_manage"] is True and group["can_leave"] is False

    seen = client.get(f"/api/v1/smartflow/groups/{group['id']}", headers=mate_headers).json()["data"]
    assert seen["can_manage"] is False and seen["can_leave"] is True
    listed = client.get("/api/v1/smartflow/groups", headers=mate_headers).json()["data"]["items"]
    assert [(item["can_manage"], item["can_leave"]) for item in listed] == [(False, True)]

    conversation_id = group["conversation_id"]
    assert client.get(f"/api/v1/smartflow/conversations/{conversation_id}/messages", headers=mate_headers).status_code == 200
    assert client.post(f"/api/v1/smartflow/groups/{group['id']}/leave", headers=mate_headers).status_code == 200
    assert client.get(f"/api/v1/smartflow/conversations/{conversation_id}/messages", headers=mate_headers).status_code == 404
    assert client.get(f"/api/v1/smartflow/groups/{group['id']}", headers=mate_headers).status_code == 404

    assert client.post(f"/api/v1/smartflow/groups/{group['id']}/leave", headers=owner_headers).status_code == 400
