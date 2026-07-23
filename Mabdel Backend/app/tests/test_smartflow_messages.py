from __future__ import annotations

import asyncio

from app.core.realtime import conversation_realtime_hub, inbox_realtime_hub
from app.tests.conftest import grant_owner_role


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(
        db.otp_codes.find_one(
            {"email": email, "purpose": purpose},
            sort=[("created_at", -1)],
        )
    )
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "messages@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Message User", "email": email, "password": "SecurePass2024!"},
    )
    assert register_response.status_code == 201

    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify_response = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "code": otp["code"], "purpose": "signup"},
    )
    assert verify_response.status_code == 200

    grant_owner_role(mock_db, email)

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePass2024!"},
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


def _create_conversation(client, headers: dict[str, str], *, title: str, platform: str = "whatsapp") -> str:
    response = client.post(
        "/api/v1/smartflow/conversations",
        headers=headers,
        json={"title": title, "type": "direct", "platform": platform, "member_ids": []},
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def _create_contact(client, headers: dict[str, str], *, name: str, email: str, presence: str = "offline") -> str:
    response = client.post(
        "/api/v1/smartflow/contacts",
        headers=headers,
        json={"name": name, "email": email, "phone": "+8801700000000"},
    )
    assert response.status_code == 201
    contact_id = response.json()["data"]["id"]
    if presence != "offline":
        update_response = client.patch(
            f"/api/v1/smartflow/contacts/{contact_id}",
            headers=headers,
            json={"presence": presence},
        )
        assert update_response.status_code == 200
    return contact_id


def test_reply_and_forward_endpoints_include_message_context(client, mock_db):
    headers = _auth_headers(client, mock_db)
    primary_conversation_id = _create_conversation(client, headers, title="Primary")
    forwarded_conversation_id = _create_conversation(client, headers, title="Forward Target")

    message_response = client.post(
        "/api/v1/smartflow/messages",
        headers=headers,
        json={
            "conversation_id": primary_conversation_id,
            "platform": "whatsapp",
            "direction": "inbound",
            "content": "Regional sales summary is ready.",
        },
    )
    assert message_response.status_code == 201
    source_message_id = message_response.json()["data"]["id"]

    reply_response = client.post(
        f"/api/v1/smartflow/messages/{source_message_id}/reply",
        headers=headers,
        json={
            "content": "Please send me the underperforming regions.",
            "platform": "whatsapp",
        },
    )
    assert reply_response.status_code == 201
    reply_payload = reply_response.json()["data"]
    assert reply_payload["reply_to_message_id"] == source_message_id
    assert reply_payload["reply_to_message_preview"]["content"] == "Regional sales summary is ready."

    forward_response = client.post(
        f"/api/v1/smartflow/messages/{source_message_id}/forward",
        headers=headers,
        json={
            "conversation_id": forwarded_conversation_id,
            "platform": "whatsapp",
        },
    )
    assert forward_response.status_code == 201
    forward_payload = forward_response.json()["data"]
    assert forward_payload["forward_from_message_id"] == source_message_id
    assert forward_payload["forward_from_message_preview"]["content"] == "Regional sales summary is ready."
    assert forward_payload["content"] == "Regional sales summary is ready."

    list_response = client.get(
        f"/api/v1/smartflow/conversations/{forwarded_conversation_id}/messages",
        headers=headers,
    )
    assert list_response.status_code == 200
    listed_message = list_response.json()["data"]["items"][0]
    assert listed_message["forward_from_message_preview"]["content"] == "Regional sales summary is ready."


def test_typing_state_endpoint_round_trip(client, mock_db):
    headers = _auth_headers(client, mock_db, email="typing@example.com")
    conversation_id = _create_conversation(client, headers, title="Typing Conversation")

    initial_response = client.get(
        f"/api/v1/smartflow/conversations/{conversation_id}/typing",
        headers=headers,
    )
    assert initial_response.status_code == 200
    assert initial_response.json()["data"]["is_typing"] is False

    typing_response = client.post(
        f"/api/v1/smartflow/conversations/{conversation_id}/typing",
        headers=headers,
        json={"is_typing": True, "actor_name": "Mabdel AI", "actor_type": "ai"},
    )
    assert typing_response.status_code == 200
    typing_payload = typing_response.json()["data"]
    assert typing_payload["is_typing"] is True
    assert typing_payload["actor_name"] == "Mabdel AI"
    assert typing_payload["expires_at"] is not None

    fetch_response = client.get(
        f"/api/v1/smartflow/conversations/{conversation_id}/typing",
        headers=headers,
    )
    assert fetch_response.status_code == 200
    fetch_payload = fetch_response.json()["data"]
    assert fetch_payload["is_typing"] is True
    assert fetch_payload["actor_type"] == "ai"


def test_message_read_receipt_fields_are_returned(client, mock_db):
    headers = _auth_headers(client, mock_db, email="receipts@example.com")
    conversation_id = _create_conversation(client, headers, title="Receipts")

    message_response = client.post(
        "/api/v1/smartflow/messages",
        headers=headers,
        json={
            "conversation_id": conversation_id,
            "platform": "whatsapp",
            "direction": "outbound",
            "content": "I need the regional breakdown.",
        },
    )
    assert message_response.status_code == 201
    message_id = message_response.json()["data"]["id"]

    read_response = client.patch(
        f"/api/v1/smartflow/messages/{message_id}",
        headers=headers,
        json={"status": "read"},
    )
    assert read_response.status_code == 200
    payload = read_response.json()["data"]
    assert payload["status"] == "read"
    assert payload["is_read"] is True
    assert payload["delivered_at"] is not None
    assert payload["read_at"] is not None
    assert payload["read_receipt_label"].startswith("READ ")
    assert payload["status_timestamps"]["sent_at"] is not None
    assert payload["status_timestamps"]["delivered_at"] is not None
    assert payload["status_timestamps"]["read_at"] is not None


def test_conversation_list_is_enriched_for_inbox_cards(client, mock_db):
    headers = _auth_headers(client, mock_db, email="inbox@example.com")
    direct_contact_id = _create_contact(client, headers, name="David Henderson", email="david@example.com", presence="online")
    group_contact_id = _create_contact(client, headers, name="Alex Johnson", email="alex@example.com")

    direct_response = client.post(
        "/api/v1/smartflow/conversations",
        headers=headers,
        json={"contact_id": direct_contact_id, "type": "direct", "platform": "whatsapp", "member_ids": []},
    )
    assert direct_response.status_code == 201
    direct_conversation_id = direct_response.json()["data"]["id"]

    group_response = client.post(
        "/api/v1/smartflow/groups",
        headers=headers,
        json={"name": "Product Team", "member_ids": [group_contact_id]},
    )
    assert group_response.status_code == 201
    group_conversation_id = group_response.json()["data"]["conversation_id"]

    direct_message = client.post(
        "/api/v1/smartflow/messages",
        headers=headers,
        json={
            "conversation_id": direct_conversation_id,
            "contact_id": direct_contact_id,
            "platform": "whatsapp",
            "direction": "inbound",
            "content": "Did you see the final draft?",
        },
    )
    assert direct_message.status_code == 201

    group_message = client.post(
        "/api/v1/smartflow/messages",
        headers=headers,
        json={
            "conversation_id": group_conversation_id,
            "contact_id": group_contact_id,
            "platform": "ai",
            "direction": "inbound",
            "content": "The new design files are ready.",
        },
    )
    assert group_message.status_code == 201

    ai_message = client.post(
        "/api/v1/smartflow/ai/chat",
        headers=headers,
        json={"content": "Generate sales projections", "response_mode": "text"},
    )
    assert ai_message.status_code == 200

    list_response = client.get("/api/v1/smartflow/conversations", headers=headers)
    assert list_response.status_code == 200
    payload = list_response.json()["data"]
    items = payload["items"]
    assert payload["summary"]["total_unread"] >= 2
    assert payload["summary"]["by_platform"]["whatsapp"] >= 1

    ai_item = next(item for item in items if item["type"] == "ai")
    assert ai_item["is_ai_assistant"] is True
    assert ai_item["presence_label"] == "Online"
    assert ai_item["platform_label"] == "AI"

    direct_item = next(item for item in items if item["id"] == direct_conversation_id)
    assert direct_item["title"] == "David Henderson"
    assert direct_item["presence"] == "online"
    assert direct_item["unread_count"] == 1
    assert direct_item["has_unread"] is True
    assert direct_item["last_message_preview"] == "Did you see the final draft?"
    assert direct_item["platform_icon_key"] == "whatsapp"
    assert direct_item["delivery_state"] == "unread"

    group_item = next(item for item in items if item["id"] == group_conversation_id)
    assert group_item["is_group"] is True
    assert group_item["last_message_sender_name"] == "Alex Johnson"
    assert group_item["last_message_preview"].startswith("Alex Johnson:")


def test_ai_voice_invoice_command_returns_navigation_redirect(client, mock_db):
    headers = _auth_headers(client, mock_db, email="voice-invoice@example.com")

    response = client.post(
        "/api/v1/smartflow/ai/voice-chat",
        headers=headers,
        json={"transcript": "Create invoice for Sarah", "response_mode": "text"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["transcript"] == "Create invoice for Sarah"
    assert data["ai_response"] == "Invoice workflow prepared."
    assert data["workflow"]["engine"] == "langgraph"
    assert data["workflow"]["intent"] == "invoice"
    assert data["navigation"]["should_redirect"] is True
    assert data["navigation"]["route_name"] == "invoice_create"
    assert data["navigation"]["screen"] == "CreateInvoice"
    assert data["navigation"]["path"] == "/invoices/create"
    assert data["navigation"]["params"]["prefill_prompt"] == "Create invoice for Sarah"


def test_ai_chat_returns_navigation_for_business_workflow_screens(client, mock_db):
    headers = _auth_headers(client, mock_db, email="ai-navigation@example.com")
    cases = [
        ("Send bulk email to all tenants", "bulk_message", "CreateBulkMessage", "/bulk-messages/create"),
        ("Schedule meeting with Sarah tomorrow", "calendar", "CreateCalendarEvent", "/calendar/events/create"),
        ("Create lease for apartment NY", "lease", "CreateLease", "/leases/create"),
        ("Create service agreement for Apex", "agreement", "CreateAgreement", "/agreements/create"),
    ]

    for content, intent, screen, path in cases:
        response = client.post(
            "/api/v1/smartflow/ai/chat",
            headers=headers,
            json={"content": content, "response_mode": "text"},
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["workflow"]["engine"] == "langgraph"
        assert data["workflow"]["intent"] == intent
        assert data["navigation"]["should_redirect"] is True
        assert data["navigation"]["screen"] == screen
        assert data["navigation"]["path"] == path
        assert data["navigation"]["params"]["prefill_prompt"] == content


def test_ai_chat_accepts_transcript_payload_for_invoice_flow(client, mock_db):
    headers = _auth_headers(client, mock_db, email="ai-transcript-chat@example.com")

    response = client.post(
        "/api/v1/smartflow/ai/chat",
        headers=headers,
        json={
            "transcript": "Create invoice for Jamil 250",
            "prompt": "Extract invoice data from this transcript and return JSON.",
            "response_mode": "text",
        },
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["workflow"]["intent"] == "invoice"
    assert data["navigation"]["screen"] == "CreateInvoice"
    assert data["navigation"]["params"]["prefill_prompt"] == "Create invoice for Jamil 250"


def test_ai_workflow_prefill_supports_voice_form_creation_screens(client, mock_db):
    headers = _auth_headers(client, mock_db, email="ai-prefill@example.com")
    cases = [
        (
            {"workflow_intent": "invoice", "transcript": "Create invoice for Sarah worth $500"},
            "/api/v1/invoices",
            "client_name",
            "Sarah",
        ),
        (
            {"workflow_intent": "bulk_message", "transcript": "Send bulk email to alex@example.com about quarterly updates"},
            "/api/v1/smartflow/bulk-messages",
            "recipient_emails",
            ["alex@example.com"],
        ),
        (
            {"workflow_intent": "calendar", "transcript": "Schedule meeting with Sarah tomorrow online"},
            "/api/v1/smartflow/calendar/events",
            "meeting_mode",
            "online",
        ),
        (
            {"workflow_intent": "lease", "transcript": "Create lease for tenant John Doe at 221B Baker Street for $1200 per month"},
            "/api/v1/smartflow/leases/generate",
            "tenant_name",
            "John Doe",
        ),
        (
            {"workflow_intent": "agreement", "transcript": "Create service agreement for Apex Client"},
            "/api/v1/smartflow/agreements/generate",
            "client_name",
            "Apex Client",
        ),
    ]

    for request_body, endpoint, field, expected in cases:
        response = client.post("/api/v1/smartflow/ai/workflow-prefill", headers=headers, json=request_body)

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["workflow"]["engine"] == "langgraph"
        assert data["navigation"]["should_redirect"] is True
        assert data["create_endpoint"] == endpoint
        assert data["prefill"][field] == expected
        assert data["next_action"] in {"create", "review_form"}


def test_ai_workflow_prefill_resolves_contact_and_overwrites_stale_email(client, mock_db):
    headers = _auth_headers(client, mock_db, email="resolve-contacts@example.com")
    
    # 1. Create a contact in the database
    _create_contact(client, headers, name="Jamil Miah", email="jamil@example.com")
    
    # 2. Trigger AI prefill for invoice, passing stale email default in current_values
    request_body = {
        "workflow_intent": "invoice",
        "transcript": "Create invoice for Jamil of $250",
        "current_values": {
            "client_name": "",
            "client_email": "nathan.roberts@example.com"
        }
    }
    
    response = client.post("/api/v1/smartflow/ai/workflow-prefill", headers=headers, json=request_body)
    assert response.status_code == 200
    
    data = response.json()["data"]
    assert data["prefill"]["client_name"] == "Jamil Miah"
    assert data["prefill"]["client_email"] == "jamil@example.com"
    assert data["prefill"]["items"][0]["unit_price"] == 250


def test_ai_workflow_prefill_dynamic_quantity_and_date(client, mock_db):
    headers = _auth_headers(client, mock_db, email="dynamic-prefill@example.com")
    
    # Test case 1: Explicit quantity, description, unit price and due tomorrow
    request_body_1 = {
        "workflow_intent": "invoice",
        "transcript": "Create invoice for Sarah for 5 website designs for $250 each due tomorrow",
        "workflow_output": {
            "due_date": "tomorrow"
        }
    }
    response_1 = client.post("/api/v1/smartflow/ai/workflow-prefill", headers=headers, json=request_body_1)
    assert response_1.status_code == 200
    data_1 = response_1.json()["data"]["prefill"]
    assert data_1["items"][0]["quantity"] == 5
    assert data_1["items"][0]["unit_price"] == 250.0
    assert data_1["items"][0]["description"] == "website designs"
    
    from datetime import timedelta
    from app.utils.helpers import utc_now
    tomorrow_str = (utc_now() + timedelta(days=1)).date().isoformat()
    assert data_1["due_date"] == tomorrow_str
    assert data_1["payment_due_date"] == tomorrow_str

    # Test case 2: Total amount divided by quantity (no 'each' specified)
    request_body_2 = {
        "workflow_intent": "invoice",
        "transcript": "Create invoice for Jamil for 3 consultation hours worth $300",
    }
    response_2 = client.post("/api/v1/smartflow/ai/workflow-prefill", headers=headers, json=request_body_2)
    assert response_2.status_code == 200
    data_2 = response_2.json()["data"]["prefill"]
    assert data_2["items"][0]["quantity"] == 3
    assert data_2["items"][0]["unit_price"] == 100.0
    assert data_2["items"][0]["description"] == "consultation hours"


def test_ai_workflow_prefill_merges_ai_extraction_for_natural_language(client, mock_db, monkeypatch):
    from app.services.smartflow._base import SmartFlowBase

    headers = _auth_headers(client, mock_db, email="smart-ai-prefill@example.com")

    async def fake_ai_extract(self, intent, transcript, current_values):
        assert intent == "invoice"
        assert "bill sarah" in transcript.lower()
        return {
            "_recipient_name": "Sarah Ahmed",
            "client_name": "Sarah Ahmed",
            "notes": "Homepage copy package",
            "items": [{"description": "homepage copy", "quantity": 1, "unit_price": 500.0}],
        }

    # Patch the base class: the orchestrator delegates prefill to WorkflowService,
    # so patching SmartFlowService directly would not reach the executing instance.
    monkeypatch.setattr(SmartFlowBase, "_extract_workflow_prefill_with_ai", fake_ai_extract)

    response = client.post(
        "/api/v1/smartflow/ai/workflow-prefill",
        headers=headers,
        json={"workflow_intent": "invoice", "transcript": "please bill sarah five hundred for homepage copy"},
    )

    assert response.status_code == 200
    prefill = response.json()["data"]["prefill"]
    assert prefill["client_name"] == "Sarah Ahmed"
    assert prefill["notes"] == "Homepage copy package"
    assert prefill["items"] == [{"description": "homepage copy", "quantity": 1, "unit_price": 500.0}]


def test_conversation_unread_filter_search_and_mark_read(client, mock_db):
    headers = _auth_headers(client, mock_db, email="inbox-filters@example.com")
    maria_contact_id = _create_contact(client, headers, name="Maria Garcia", email="maria@example.com")

    unread_conversation_response = client.post(
        "/api/v1/smartflow/conversations",
        headers=headers,
        json={"contact_id": maria_contact_id, "type": "direct", "platform": "whatsapp", "member_ids": []},
    )
    assert unread_conversation_response.status_code == 201
    unread_conversation_id = unread_conversation_response.json()["data"]["id"]

    read_conversation_id = _create_conversation(client, headers, title="HR Department")

    unread_message = client.post(
        "/api/v1/smartflow/messages",
        headers=headers,
        json={
            "conversation_id": unread_conversation_id,
            "contact_id": maria_contact_id,
            "platform": "whatsapp",
            "direction": "inbound",
            "content": "Can we reschedule for tomorrow?",
        },
    )
    assert unread_message.status_code == 201

    read_message = client.post(
        "/api/v1/smartflow/messages",
        headers=headers,
        json={
            "conversation_id": read_conversation_id,
            "platform": "whatsapp",
            "direction": "outbound",
            "content": "Your leave request has been approved.",
        },
    )
    assert read_message.status_code == 201

    unread_response = client.get("/api/v1/smartflow/conversations?unread_only=true", headers=headers)
    assert unread_response.status_code == 200
    unread_items = unread_response.json()["data"]["items"]
    assert len(unread_items) == 1
    assert unread_items[0]["id"] == unread_conversation_id

    search_response = client.get("/api/v1/smartflow/conversations?search=reschedule", headers=headers)
    assert search_response.status_code == 200
    assert search_response.json()["data"]["items"][0]["id"] == unread_conversation_id

    mark_read_response = client.post(f"/api/v1/smartflow/conversations/{unread_conversation_id}/mark-read", headers=headers)
    assert mark_read_response.status_code == 200
    assert mark_read_response.json()["data"]["unread_count"] == 0


def test_conversation_multi_platform_filter_for_unified_inbox(client, mock_db):
    headers = _auth_headers(client, mock_db, email="inbox-platforms@example.com")
    whatsapp_id = _create_conversation(client, headers, title="WhatsApp Lead", platform="whatsapp")
    instagram_id = _create_conversation(client, headers, title="Instagram Lead", platform="instagram")
    _create_conversation(client, headers, title="SMS Lead", platform="sms")

    response = client.get(
        "/api/v1/smartflow/conversations?platforms=whatsapp,instagram",
        headers=headers,
    )

    assert response.status_code == 200
    items = response.json()["data"]["items"]
    assert {item["id"] for item in items} == {whatsapp_id, instagram_id}
    assert {item["platform"] for item in items} == {"whatsapp", "instagram"}


def test_conversation_detail_and_rich_typing_state_for_chat_screen(client, mock_db):
    headers = _auth_headers(client, mock_db, email="chat-detail@example.com")
    contact_id = _create_contact(client, headers, name="Sarah Jenkins", email="sarah@example.com", presence="online")

    conversation_response = client.post(
        "/api/v1/smartflow/conversations",
        headers=headers,
        json={"contact_id": contact_id, "type": "direct", "platform": "whatsapp", "member_ids": []},
    )
    assert conversation_response.status_code == 201
    conversation_id = conversation_response.json()["data"]["id"]

    detail_response = client.get(f"/api/v1/smartflow/conversations/{conversation_id}", headers=headers)
    assert detail_response.status_code == 200
    detail = detail_response.json()["data"]
    assert detail["title"] == "Sarah Jenkins"
    assert detail["presence_label"] == "Online"
    assert detail["contact_name"] == "Sarah Jenkins"

    typing_response = client.post(
        f"/api/v1/smartflow/conversations/{conversation_id}/typing",
        headers=headers,
        json={
            "is_typing": True,
            "actor_name": "Mabdel AI",
            "actor_type": "ai",
            "preview_text": "Processing those files now...",
            "state_label": "Active Now",
        },
    )
    assert typing_response.status_code == 200
    typing_payload = typing_response.json()["data"]
    assert typing_payload["preview_text"] == "Processing those files now..."
    assert typing_payload["state_label"] == "Active Now"

    fetch_response = client.get(
        f"/api/v1/smartflow/conversations/{conversation_id}/typing",
        headers=headers,
    )
    assert fetch_response.status_code == 200
    fetched = fetch_response.json()["data"]
    assert fetched["preview_text"] == "Processing those files now..."
    assert fetched["state_label"] == "Active Now"


def test_conversation_websocket_stream_connects_and_service_publishes_events(client, mock_db, monkeypatch):
    headers = _auth_headers(client, mock_db, email="chat-realtime@example.com")
    token = headers["Authorization"].split(" ", 1)[1]
    contact_id = _create_contact(client, headers, name="Sarah Jenkins", email="sarah@example.com")

    conversation_response = client.post(
        "/api/v1/smartflow/conversations",
        headers=headers,
        json={"contact_id": contact_id, "type": "direct", "platform": "whatsapp", "member_ids": []},
    )
    assert conversation_response.status_code == 201
    conversation_id = conversation_response.json()["data"]["id"]

    published_events = []

    async def fake_publish(conversation_id_arg: str, event: str, data: dict) -> None:
        published_events.append((conversation_id_arg, event, data))

    monkeypatch.setattr(conversation_realtime_hub, "publish", fake_publish)

    with client.websocket_connect(f"/api/v1/smartflow/ws/conversations/{conversation_id}?token={token}") as websocket:
        connected = websocket.receive_json()
        assert connected["event"] == "connected"

    message_response = client.post(
        "/api/v1/smartflow/messages",
        headers=headers,
        json={
            "conversation_id": conversation_id,
            "contact_id": contact_id,
            "platform": "whatsapp",
            "direction": "inbound",
            "content": "Realtime message arrived.",
        },
    )
    assert message_response.status_code == 201
    assert published_events[-1][1] == "message.created"

    typing_response = client.post(
        f"/api/v1/smartflow/conversations/{conversation_id}/typing",
        headers=headers,
        json={"is_typing": True, "actor_name": "Mabdel AI", "actor_type": "ai", "preview_text": "Thinking..."},
    )
    assert typing_response.status_code == 200
    assert published_events[-1][1] == "typing.updated"

    read_response = client.post(
        f"/api/v1/smartflow/conversations/{conversation_id}/mark-read",
        headers=headers,
    )
    assert read_response.status_code == 200
    assert published_events[-1][1] == "conversation.read"


def test_inbox_publish_and_stream_contract_for_unified_conversations(client, mock_db, monkeypatch):
    headers = _auth_headers(client, mock_db, email="unified-inbox@example.com")
    token = headers["Authorization"].split(" ", 1)[1]
    contact_id = _create_contact(client, headers, name="Alex Rivera", email="alex@example.com")

    conversation_response = client.post(
        "/api/v1/smartflow/conversations",
        headers=headers,
        json={"contact_id": contact_id, "type": "direct", "platform": "facebook_messenger", "member_ids": []},
    )
    assert conversation_response.status_code == 201
    conversation_id = conversation_response.json()["data"]["id"]

    published_events = []

    async def fake_publish(channel: str, event: str, data: dict) -> None:
        published_events.append((channel, event, data))

    monkeypatch.setattr(inbox_realtime_hub, "publish", fake_publish)

    with client.websocket_connect(f"/api/v1/smartflow/ws/inbox?token={token}") as websocket:
        connected = websocket.receive_json()
        assert connected["event"] == "connected"
        assert connected["channel"] == "inbox"
        assert "summary" in connected["data"]

    message_response = client.post(
        "/api/v1/smartflow/messages",
        headers=headers,
        json={
            "conversation_id": conversation_id,
            "contact_id": contact_id,
            "platform": "facebook_messenger",
            "direction": "inbound",
            "content": "Can we jump on a quick call today?",
        },
    )
    assert message_response.status_code == 201
    assert published_events[-1][0]
    assert published_events[-1][1] == "inbox.updated"
    assert published_events[-1][2]["conversation"]["platform_label"] == "Facebook"


def test_group_management_endpoints_support_settings_screen(client, mock_db):
    headers = _auth_headers(client, mock_db, email="group-settings@example.com")
    sarah_id = _create_contact(client, headers, name="Sarah Jenkins", email="sarah@example.com", presence="online")
    david_id = _create_contact(client, headers, name="David Thompson", email="david@example.com")
    emily_id = _create_contact(client, headers, name="Emily Carter", email="emily@example.com")

    create_response = client.post(
        "/api/v1/smartflow/groups",
        headers=headers,
        json={
            "name": "Marketing Team",
            "avatar_url": "https://cdn.example.com/groups/marketing.png",
            "description": "Brand and campaign collaborators",
            "member_ids": [sarah_id, david_id],
            "admin_ids": [sarah_id],
        },
    )
    assert create_response.status_code == 201
    group = create_response.json()["data"]
    group_id = group["id"]
    assert group["member_count"] == 2
    assert group["avatar_url"] == "https://cdn.example.com/groups/marketing.png"
    assert group["members"][0]["role"] in {"admin", "member"}

    detail_response = client.get(f"/api/v1/smartflow/groups/{group_id}", headers=headers)
    assert detail_response.status_code == 200
    detail = detail_response.json()["data"]
    assert detail["member_count"] == 2
    assert detail["pending_invite_count"] == 0
    assert any(member["name"] == "Sarah Jenkins" and member["role"] == "admin" for member in detail["members"])

    add_member_response = client.post(
        f"/api/v1/smartflow/groups/{group_id}/members",
        headers=headers,
        json={"member_ids": [emily_id]},
    )
    assert add_member_response.status_code == 200
    added_group = add_member_response.json()["data"]
    assert added_group["member_count"] == 3
    assert any(member["name"] == "Emily Carter" for member in added_group["members"])

    role_response = client.patch(
        f"/api/v1/smartflow/groups/{group_id}/members/{emily_id}",
        headers=headers,
        json={"role": "admin"},
    )
    assert role_response.status_code == 200
    role_payload = role_response.json()["data"]
    assert any(member["id"] == emily_id and member["role"] == "admin" for member in role_payload["members"])

    invite_response = client.post(
        f"/api/v1/smartflow/groups/{group_id}/invites",
        headers=headers,
        json={"phone": "+13478902211", "name": "Pending Invite"},
    )
    assert invite_response.status_code == 200
    invite_payload = invite_response.json()["data"]
    assert invite_payload["pending_invite_count"] == 1
    invite_id = invite_payload["pending_invites"][0]["id"]

    cancel_invite_response = client.delete(
        f"/api/v1/smartflow/groups/{group_id}/invites/{invite_id}",
        headers=headers,
    )
    assert cancel_invite_response.status_code == 200
    assert cancel_invite_response.json()["data"]["pending_invite_count"] == 0

    remove_member_response = client.delete(
        f"/api/v1/smartflow/groups/{group_id}/members/{david_id}",
        headers=headers,
    )
    assert remove_member_response.status_code == 200
    removed_payload = remove_member_response.json()["data"]
    assert removed_payload["member_count"] == 2
    assert all(member["id"] != david_id for member in removed_payload["members"])


def test_group_chat_messages_include_attachments_mentions_and_sender_metadata(client, mock_db):
    headers = _auth_headers(client, mock_db, email="group-chat@example.com")
    sarah_id = _create_contact(client, headers, name="Sarah Jenkins", email="sarah@example.com", presence="online")
    alex_id = _create_contact(client, headers, name="Alex Rivera", email="alex@example.com", presence="busy")

    group_response = client.post(
        "/api/v1/smartflow/groups",
        headers=headers,
        json={"name": "Marketing Team", "member_ids": [sarah_id, alex_id], "admin_ids": [sarah_id]},
    )
    assert group_response.status_code == 201
    conversation_id = group_response.json()["data"]["conversation_id"]

    message_response = client.post(
        "/api/v1/smartflow/messages",
        headers=headers,
        json={
            "conversation_id": conversation_id,
            "contact_id": sarah_id,
            "platform": "ai",
            "direction": "inbound",
            "content": "Here is the moodboard and brief.",
            "attachments": [
                {
                    "type": "image",
                    "url": "https://cdn.example.com/uploads/moodboard.png",
                    "thumbnail_url": "https://cdn.example.com/uploads/moodboard-thumb.png",
                },
                {
                    "type": "document",
                    "url": "https://cdn.example.com/uploads/project-brief-q1.pdf",
                    "file_name": "Project_Brief_Q1.pdf",
                    "mime_type": "application/pdf",
                    "file_size_bytes": 2400000,
                },
            ],
            "mentions": [alex_id],
        },
    )
    assert message_response.status_code == 201
    payload = message_response.json()["data"]
    assert payload["attachment_count"] == 2
    assert payload["has_attachments"] is True
    assert payload["sender_name"] == "Sarah Jenkins"
    assert payload["sender_presence"] == "online"
    assert payload["mentions"][0]["name"] == "Alex Rivera"
    assert payload["attachments"][1]["file_name"] == "Project_Brief_Q1.pdf"

    list_response = client.get(
        f"/api/v1/smartflow/conversations/{conversation_id}/messages",
        headers=headers,
    )
    assert list_response.status_code == 200
    listed_message = list_response.json()["data"]["items"][0]
    assert listed_message["attachments"][0]["type"] == "image"
    assert listed_message["mentions"][0]["contact_id"] == alex_id


def test_leave_and_delete_group_endpoints_behave_for_group_lifecycle(client, mock_db):
    headers = _auth_headers(client, mock_db, email="group-lifecycle@example.com")
    member_id = _create_contact(client, headers, name="Jordan Smith", email="jordan@example.com")

    leave_group_response = client.post(
        "/api/v1/smartflow/groups",
        headers=headers,
        json={"name": "Archive Me", "member_ids": [member_id]},
    )
    assert leave_group_response.status_code == 201
    leave_group_id = leave_group_response.json()["data"]["id"]

    # The group owner is blocked from leaving; they must delete the group instead.
    leave_response = client.post(f"/api/v1/smartflow/groups/{leave_group_id}/leave", headers=headers)
    assert leave_response.status_code == 400
    assert leave_response.json()["error"]["code"] == "GROUP_OWNER_CANNOT_LEAVE"
    list_after_leave = client.get("/api/v1/smartflow/groups", headers=headers)
    assert list_after_leave.status_code == 200
    assert any(item["id"] == leave_group_id for item in list_after_leave.json()["data"]["items"])

    delete_group_response = client.post(
        "/api/v1/smartflow/groups",
        headers=headers,
        json={"name": "Delete Me", "member_ids": [member_id]},
    )
    assert delete_group_response.status_code == 201
    delete_group_id = delete_group_response.json()["data"]["id"]

    delete_response = client.delete(f"/api/v1/smartflow/groups/{delete_group_id}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted"] is True


def test_smart_navigation_scoring_and_context_matching(client, mock_db):
    headers = _auth_headers(client, mock_db, email="smart-nav-test@example.com")

    # Case 1: List vs Create matching for Invoices
    # "show my invoices" should match InvoiceList (list)
    response_list = client.post(
        "/api/v1/smartflow/ai/chat",
        headers=headers,
        json={"content": "show my invoices", "response_mode": "text"},
    )
    assert response_list.status_code == 200
    nav_list = response_list.json()["data"]["navigation"]
    assert nav_list["should_redirect"] is True
    assert nav_list["screen"] == "InvoiceList"
    assert nav_list["path"] == "/invoices"
    assert nav_list["confidence"] >= 0.70

    # "create invoice for Alex" should match CreateInvoice (create)
    response_create = client.post(
        "/api/v1/smartflow/ai/chat",
        headers=headers,
        json={"content": "create invoice for Alex", "response_mode": "text"},
    )
    assert response_create.status_code == 200
    nav_create = response_create.json()["data"]["navigation"]
    assert nav_create["should_redirect"] is True
    assert nav_create["screen"] == "CreateInvoice"
    assert nav_create["path"] == "/invoices/create"

    # Case 2: Profile routes
    # "open business settings profile" should match ProfileBusiness
    response_biz = client.post(
        "/api/v1/smartflow/ai/chat",
        headers=headers,
        json={"content": "open business settings profile", "response_mode": "text"},
    )
    assert response_biz.status_code == 200
    nav_biz = response_biz.json()["data"]["navigation"]
    assert nav_biz["should_redirect"] is True
    assert nav_biz["screen"] == "ProfileBusiness"
    assert nav_biz["path"] == "/profile/business"

    # "change my account settings profile" should match ProfileEdit
    response_edit = client.post(
        "/api/v1/smartflow/ai/chat",
        headers=headers,
        json={"content": "change my account settings profile", "response_mode": "text"},
    )
    assert response_edit.status_code == 200
    nav_edit = response_edit.json()["data"]["navigation"]
    assert nav_edit["should_redirect"] is True
    assert nav_edit["screen"] == "ProfileEdit"
    assert nav_edit["path"] == "/profile/edit"

    # Case 3: Ambiguous or generic queries redirect to AI chatbot
    response_ambiguous = client.post(
        "/api/v1/smartflow/ai/chat",
        headers=headers,
        json={"content": "what is the meaning of life?", "response_mode": "text"},
    )
    assert response_ambiguous.status_code == 200
    nav_ambiguous = response_ambiguous.json()["data"]["navigation"]
    assert nav_ambiguous["should_redirect"] is True
    assert nav_ambiguous["screen"] == "MicConversation"
    assert nav_ambiguous["path"] == "/ai/chat"
    assert nav_ambiguous["confidence"] < 0.70
    assert nav_ambiguous["params"]["chatbot_fallback"] is True


def test_generate_ai_image(client, mock_db):
    headers = _auth_headers(client, mock_db, email="imagegen@example.com")
    response = client.post(
        "/api/v1/smartflow/ai/generate-image",
        headers=headers,
        json={"prompt": "web design post banner"},
    )
    assert response.status_code == 200
    res_data = response.json()
    assert "data" in res_data
    assert "image_url" in res_data["data"]
    assert res_data["data"]["image_url"].startswith("https://")
