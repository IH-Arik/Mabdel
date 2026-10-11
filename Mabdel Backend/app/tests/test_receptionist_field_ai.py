from __future__ import annotations

from app.services.gocustify_ai_service import GoCustifyAIService
from app.tests.test_team_direct_messaging import _signup

ENDPOINT = "/api/v1/smartflow/ai/receptionist-fields"


def _fake_compose(responses=None):
    seen = []

    def fake(self, field, *, action, business_type="", business_name="", current_text=""):
        seen.append(
            {"field": field, "action": action, "business_type": business_type, "business_name": business_name, "current_text": current_text}
        )
        if responses is not None:
            return responses.get(field)
        return f"{action}:{field}:{business_type}"

    return fake, seen


def test_a_single_field_draft_includes_the_business_type_and_name(client, mock_db, monkeypatch):
    import asyncio

    headers, owner_id = _signup(client, mock_db, "recep-field-single@example.com", "Owner")
    asyncio.run(mock_db.business_profiles.insert_one({"user_id": owner_id, "business_name": "Bright Dental"}))
    fake, seen = _fake_compose()
    monkeypatch.setattr(GoCustifyAIService, "compose_receptionist_field", fake)

    response = client.post(
        ENDPOINT, headers=headers, json={"fields": ["greeting_inbound"], "action": "draft", "business_type": "Dental Clinic"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["data"] == {"greeting_inbound": "draft:greeting_inbound:Dental Clinic"}
    assert seen[0]["business_type"] == "Dental Clinic"
    assert seen[0]["business_name"] == "Bright Dental"


def test_batch_generates_every_field_at_once(client, mock_db, monkeypatch):
    headers, owner_id = _signup(client, mock_db, "recep-field-batch@example.com", "Owner")
    fake, seen = _fake_compose()
    monkeypatch.setattr(GoCustifyAIService, "compose_receptionist_field", fake)
    all_fields = [
        "greeting_inbound", "greeting_outbound", "closing_message", "custom_instructions",
        "knowledge_base", "cancellation_policy", "sms_booked", "sms_pending", "sms_rescheduled",
        "sms_cancelled", "sms_declined", "sms_cancellation_declined", "sms_reminder",
    ]

    response = client.post(ENDPOINT, headers=headers, json={"fields": all_fields, "action": "draft", "business_type": "Restaurant"})

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert set(data.keys()) == set(all_fields)
    assert {item["field"] for item in seen} == set(all_fields)


def test_improve_passes_through_the_current_text(client, mock_db, monkeypatch):
    headers, owner_id = _signup(client, mock_db, "recep-field-improve@example.com", "Owner")
    fake, seen = _fake_compose()
    monkeypatch.setattr(GoCustifyAIService, "compose_receptionist_field", fake)

    response = client.post(
        ENDPOINT,
        headers=headers,
        json={"fields": ["closing_message"], "action": "improve", "current_texts": {"closing_message": "thanks bye"}},
    )

    assert response.status_code == 200, response.text
    assert seen[0]["action"] == "improve" and seen[0]["current_text"] == "thanks bye"


def test_one_field_failing_does_not_fail_the_whole_batch(client, mock_db, monkeypatch):
    headers, owner_id = _signup(client, mock_db, "recep-field-partial@example.com", "Owner")
    fake, _ = _fake_compose(responses={"greeting_inbound": "Hi there!", "closing_message": None})
    monkeypatch.setattr(GoCustifyAIService, "compose_receptionist_field", fake)

    response = client.post(
        ENDPOINT, headers=headers, json={"fields": ["greeting_inbound", "closing_message"], "action": "draft"}
    )

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["greeting_inbound"] == "Hi there!"
    assert data["closing_message"] is None


def test_an_unknown_field_is_rejected(client, mock_db, monkeypatch):
    headers, owner_id = _signup(client, mock_db, "recep-field-unknown@example.com", "Owner")

    response = client.post(ENDPOINT, headers=headers, json={"fields": ["not_a_real_field"], "action": "draft"})

    assert response.status_code == 400


def test_compose_receptionist_field_truncates_to_the_fields_max_length(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENAI_API_KEY", "fake-key-for-test")

    class FakeChoice:
        def __init__(self, text):
            self.message = type("M", (), {"content": text})()

    class FakeResponse:
        def __init__(self, text):
            self.choices = [FakeChoice(text)]

    class FakeClient:
        class chat:
            class completions:
                @staticmethod
                def create(**kwargs):
                    return FakeResponse("x" * 1000)

    monkeypatch.setattr("app.services.gocustify_ai_service._get_sync_openai_client", lambda: FakeClient())

    service = GoCustifyAIService()
    text = service.compose_receptionist_field("sms_booked", action="draft", business_type="Dental Clinic", business_name="Bright Dental")

    assert text is not None and len(text) == 300  # sms_booked's max_chars


def test_compose_receptionist_field_improve_requires_existing_text():
    service = GoCustifyAIService()
    assert service.compose_receptionist_field("closing_message", action="improve", current_text="   ") is None
    assert service.compose_receptionist_field("not_a_field", action="draft") is None
    assert service.compose_receptionist_field("closing_message", action="not_an_action") is None
