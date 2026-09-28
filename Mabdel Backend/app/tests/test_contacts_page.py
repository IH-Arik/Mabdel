from __future__ import annotations

import asyncio
from datetime import timedelta

from app.tests.test_shared_inbox import _inbound
from app.tests.test_team_direct_messaging import _same_org, _signup
from app.utils.helpers import utc_now


def _new(client, headers, **body):
    return client.post("/api/v1/smartflow/contacts", headers=headers, json=body)


def test_searching_for_a_phone_number_with_a_plus_or_bracket_does_not_crash(client, mock_db):
    headers, _ = _signup(client, mock_db, "ct-search@example.com", "Owner")
    assert _new(client, headers, name="Rafi", phone="+8801711111111").status_code == 201

    for term in ("+8801711", "(", "a.b*", "[x"):
        response = client.get("/api/v1/smartflow/contacts", headers=headers, params={"search": term})
        assert response.status_code == 200, (term, response.text)
    found = client.get("/api/v1/smartflow/contacts", headers=headers, params={"search": "+8801711"}).json()["data"]["items"]
    assert [item["name"] for item in found] == ["Rafi"]
    assert client.get("/api/v1/smartflow/contacts/export", headers=headers, params={"search": "+8801711"}).status_code == 200


def test_the_same_phone_or_email_cannot_be_added_twice_by_anyone_in_the_business(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "ct-dup-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "ct-dup-mate@example.com", "Mate")
    other_headers, _ = _signup(client, mock_db, "ct-dup-other@example.com", "Other")
    _same_org(mock_db, owner_id, mate_id)
    assert _new(client, owner_headers, name="Karim", phone="+8801722222222", email="karim@example.com").status_code == 201

    same_phone = _new(client, mate_headers, name="Karim again", phone="01722222222")
    assert same_phone.status_code == 409 and "Karim" in same_phone.json()["message"]
    assert _new(client, mate_headers, name="Karim mail", email="KARIM@example.com").status_code == 409
    assert _new(client, mate_headers, name="Someone else", phone="+8801733333333").status_code == 201
    # another business is a different address book
    assert _new(client, other_headers, name="Karim", phone="+8801722222222", email="karim@example.com").status_code == 201


def test_profile_stats_come_from_real_calls_and_threads(client, mock_db):
    headers, owner_id = _signup(client, mock_db, "ct-stats@example.com", "Owner")
    contact = _new(client, headers, name="Nadia", phone="+8801744444444").json()["data"]
    quiet = _new(client, headers, name="Quiet", phone="+8801755555555").json()["data"]

    now = utc_now()
    asyncio.run(
        mock_db.call_logs.insert_many(
            [
                {"user_id": owner_id, "contact_id": contact["id"], "phone_number": "+8801744444444", "created_at": now - timedelta(days=1)},
                {"user_id": owner_id, "phone_number": "+8800000000000", "from_number": "+8801744444444", "direction": "inbound", "created_at": now - timedelta(days=9)},
                {"user_id": owner_id, "phone_number": "+8801999999999", "created_at": now},  # someone else
            ]
        )
    )
    detail = client.get(f"/api/v1/smartflow/contacts/{contact['id']}", headers=headers).json()["data"]
    assert detail["total_calls"] == 2
    assert detail["activity_chart"] == [0, 0, 0, 1, 1]  # a call last week, one this week
    assert detail["last_interaction_at"]

    empty = client.get(f"/api/v1/smartflow/contacts/{quiet['id']}", headers=headers).json()["data"]
    assert empty["total_calls"] == 0 and empty["last_interaction_at"] is None and empty["activity_chart"] == [0] * 5


def test_a_contacts_customer_threads_are_found_across_channels_and_duplicates(client, mock_db):
    headers, owner_id = _signup(client, mock_db, "ct-threads@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "ct-threads-mate@example.com", "Mate")
    stranger_headers, _ = _signup(client, mock_db, "ct-threads-stranger@example.com", "Stranger")
    _same_org(mock_db, owner_id, mate_id)

    message = _inbound(mock_db, owner_id, "whatsapp", "8801766666666@s.whatsapp.net", "hello", name="Tania")
    assert _new(client, headers, name="Tania", phone="+8801766666666").status_code == 409  # WhatsApp already made her
    # A duplicate from before this check existed: the same person, added by hand.
    inserted = asyncio.run(mock_db.contacts.insert_one({"user_id": owner_id, "name": "Tania", "phone": "+8801766666666"}))
    typed = {"id": str(inserted.inserted_id)}

    response = client.get(f"/api/v1/smartflow/contacts/{typed['id']}/conversations", headers=mate_headers)
    assert response.status_code == 200, response.text
    assert [item["id"] for item in response.json()["data"]["items"]] == [message["conversation_id"]]

    assert client.get(f"/api/v1/smartflow/contacts/{typed['id']}/conversations", headers=stranger_headers).status_code == 404
