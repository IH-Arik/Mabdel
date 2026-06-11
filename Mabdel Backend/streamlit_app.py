from __future__ import annotations

import base64
import json
from datetime import date, datetime
from html import escape
from pathlib import Path
from typing import Any

import httpx
import streamlit as st


DEFAULT_API_BASE_URL = "http://127.0.0.1:8000"
PAGE_SIZE = 20
PLATFORMS = ["whatsapp", "facebook_messenger", "instagram", "telegram", "snapchat", "sms", "email", "linkedin", "twitter_x", "ai"]
HTTP_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"]


def inject_styles() -> None:
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        html, body, [data-testid="stAppViewContainer"] {
            font-family: 'Inter', sans-serif;
            background-color: #f6f4ef;
            color: #1f2933;
        }

        .stApp {
            background-color: #f6f4ef;
            color: #1f2933;
        }

        h1, h2, h3, h4, h5, h6,
        p, span, label,
        [data-testid="stMarkdownContainer"],
        [data-testid="stWidgetLabel"],
        [data-testid="stWidgetLabel"] p {
            color: #1f2933 !important;
        }

        [data-testid="stCaptionContainer"],
        [data-testid="stCaptionContainer"] p,
        .stCaptionContainer,
        small {
            color: #667085 !important;
        }

        [data-testid="stAppViewContainer"] > section:nth-child(2) {
            max-width: 1040px !important;
            margin: 0 auto !important;
            background-color: #f6f4ef;
        }

        .block-container {
            padding-top: 1rem;
            padding-bottom: 4rem;
        }

        .m-card {
            background: #fffdf8;
            border: 1px solid #d7d0c2;
            border-radius: 8px;
            padding: 18px;
            margin: 12px 0;
            transition: all 0.2s ease;
            cursor: pointer;
        }
        .m-card:hover {
            border-color: #0f766e;
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(24, 54, 48, 0.08);
        }
        .m-card strong { color: #1f2933; font-size: 1.02rem; }
        .m-muted { color: #667085; font-size: 0.85rem; margin-top: 4px; }
        
        .m-pill {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 999px;
            background: #e5f3ef;
            color: #0f766e;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .m-bubble-user {
            background: #0f766e;
            color: white;
            padding: 12px 16px;
            border-radius: 8px 8px 2px 8px;
            margin: 10px 0 10px auto;
            max-width: 85%;
            box-shadow: 0 2px 8px rgba(15, 118, 110, 0.18);
        }
        .m-bubble-other {
            background: #fffdf8;
            color: #1f2933;
            padding: 12px 16px;
            border-radius: 8px 8px 8px 2px;
            margin: 10px auto 10px 0;
            max-width: 85%;
            border: 1px solid #d7d0c2;
        }

        div[data-testid="stMetric"] {
            background: #fffdf8;
            border: 1px solid #d7d0c2;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
        }

        [data-testid="stSidebar"] {
            background-color: #e9e4d8;
            border-right: 1px solid #d7d0c2;
        }

        [data-testid="stSidebar"] *,
        [data-testid="stSidebar"] label,
        [data-testid="stSidebar"] p,
        [data-testid="stSidebar"] span {
            color: #26322f !important;
        }

        [data-testid="stSidebar"] h1,
        [data-testid="stSidebar"] h2,
        [data-testid="stSidebar"] h3 {
            color: #111827 !important;
        }

        [data-testid="stRadio"] label,
        [data-testid="stRadio"] label p,
        [role="radiogroup"] label,
        [role="radiogroup"] label p {
            color: #26322f !important;
            font-weight: 500;
        }

        input,
        textarea,
        [data-baseweb="input"] input,
        [data-baseweb="textarea"] textarea,
        [data-baseweb="select"] > div {
            background-color: #fffdf8 !important;
            color: #111827 !important;
            border-color: #b8afa0 !important;
            border-radius: 8px !important;
        }

        input::placeholder,
        textarea::placeholder {
            color: #7b8490 !important;
            opacity: 1 !important;
        }

        [data-testid="stTextInput"],
        [data-testid="stPasswordInput"] {
            max-width: 760px;
        }

        [data-testid="stTextArea"] {
            max-width: 980px;
        }

        [data-baseweb="tab"] {
            color: #4b5563 !important;
            font-weight: 600;
        }

        [data-baseweb="tab"][aria-selected="true"] {
            color: #0f766e !important;
        }

        [data-baseweb="tab-highlight"] {
            background-color: #0f766e !important;
        }

        .stButton>button {
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.2s;
            border: 1px solid #0f766e !important;
            background-color: #0f766e !important;
            color: #ffffff !important;
        }

        .stButton>button:hover {
            background-color: #115e59 !important;
            border-color: #115e59 !important;
            color: #ffffff !important;
        }

        button[kind="secondary"] {
            background-color: #fffdf8 !important;
            color: #0f766e !important;
            border-color: #b8afa0 !important;
        }

        button[kind="secondary"]:hover {
            background-color: #edf7f4 !important;
            color: #115e59 !important;
            border-color: #0f766e !important;
        }
        
        /* Hide default Streamlit header */
        header { visibility: hidden; }
        footer { visibility: hidden; }
        </style>
        """,
        unsafe_allow_html=True,
    )


def _json_default(value: Any) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _clean_payload(payload: dict[str, Any]) -> dict[str, Any]:
    clean: dict[str, Any] = {}
    for key, value in payload.items():
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        if isinstance(value, list) and not value:
            continue
        clean[key] = value
    return clean


def _json_from_text(value: str, fallback: Any) -> Any:
    if not value.strip():
        return fallback
    return json.loads(value)


def _line_list(value: str) -> list[str]:
    return [line.strip() for line in value.splitlines() if line.strip()]


def _iso_datetime(value: date, hour: int = 9, minute: int = 0) -> str:
    return datetime(value.year, value.month, value.day, hour, minute).isoformat()


def _api_base_url() -> str:
    return st.session_state.get("api_base_url", DEFAULT_API_BASE_URL).rstrip("/")


def _headers() -> dict[str, str]:
    token = st.session_state.get("access_token")
    return {"Authorization": f"Bearer {token}"} if token else {}


def api_request(
    method: str,
    path: str,
    *,
    json_body: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
    form_data: dict[str, Any] | None = None,
    files: dict[str, Any] | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    url = f"{_api_base_url()}{path}"
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.request(
                method,
                url,
                headers=_headers(),
                json=json_body,
                data=form_data,
                files=files,
                params=params,
            )
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            payload = response.json()
        else:
            payload = {
                "raw": response.text,
                "content_type": content_type,
                "status_code": response.status_code,
            }
        if response.status_code >= 400:
            return None, f"{response.status_code}: {payload}"
        return payload, None
    except httpx.RequestError as exc:
        return None, f"Request failed: {exc}"


def unwrap_data(payload: dict[str, Any] | None) -> Any:
    if not payload:
        return None
    return payload.get("data", payload)


def render_response(payload: Any, *, title: str = "Response") -> None:
    if payload is None:
        return
    with st.expander(title, expanded=False):
        st.json(payload)


def show_cards(items: list[dict[str, Any]], *, title_key: str, subtitle_keys: list[str] | None = None, badge_key: str | None = None) -> None:
    if not items:
        st.caption("No items yet.")
        return
    for item in items:
        title = item.get(title_key) or item.get("title") or item.get("name") or item.get("id")
        badge = item.get(badge_key) if badge_key else None
        subtitles = []
        for key in subtitle_keys or []:
            value = item.get(key)
            if value not in (None, "", []):
                subtitles.append(f"{key.replace('_', ' ').title()}: {value}")
        safe_title = escape(str(title))
        safe_badge = escape(str(badge)) if badge else ""
        safe_subtitles = escape(" | ".join(subtitles))
        badge_html = f"<span class='m-pill'>{safe_badge}</span>" if badge else ""
        st.markdown(
            f"<div class='m-card'>{badge_html}<strong>{safe_title}</strong><div class='m-muted'>{safe_subtitles}</div></div>",
            unsafe_allow_html=True,
        )


def set_page(page: str) -> None:
    st.session_state["pending_page"] = page


WORKFLOW_PAGE_MAP = {
    "invoice": "Invoices",
    "bulk_message": "Bulk Messages",
    "calendar": "Calendar",
    "lease": "Documents",
    "agreement": "Documents",
}


def _workflow_intent_from_result(data: dict[str, Any]) -> str | None:
    workflow = data.get("workflow") or {}
    navigation = data.get("navigation") or {}
    params = navigation.get("params") or {}
    return workflow.get("intent") or params.get("intent")


def _store_workflow_prefill(data: dict[str, Any]) -> str | None:
    intent = _workflow_intent_from_result(data)
    if not intent:
        return None
    prefill = data.get("prefill") or {}
    st.session_state["active_ai_workflow"] = data
    st.session_state[f"{intent}_prefill"] = prefill

    if intent == "invoice":
        item = (prefill.get("items") or [{}])[0]
        st.session_state["invoice_client"] = prefill.get("client_name", "")
        st.session_state["invoice_email"] = prefill.get("client_email", "")
        st.session_state["invoice_amount"] = float(item.get("unit_price") or 0)
        st.session_state["invoice_description"] = item.get("description") or "Professional services"
        st.session_state["invoice_notes"] = prefill.get("notes", "")
        st.session_state["invoice_currency"] = prefill.get("currency", "USD")
    elif intent == "bulk_message":
        st.session_state["bulk_channel"] = prefill.get("channel", "email")
        st.session_state["bulk_subject"] = prefill.get("subject", "")
        st.session_state["bulk_content"] = prefill.get("content", "")
        st.session_state["bulk_recipient_emails"] = "\n".join(prefill.get("recipient_emails") or [])
        st.session_state["bulk_contact_ids"] = "\n".join(prefill.get("contact_ids") or [])
        st.session_state["bulk_send_now"] = bool(prefill.get("send_now", True))
    elif intent == "calendar":
        st.session_state["calendar_title"] = prefill.get("title", "Meeting")
        st.session_state["calendar_description"] = prefill.get("description", "")
        st.session_state["calendar_mode"] = prefill.get("meeting_mode", "offline")
    elif intent == "lease":
        st.session_state["leases_prompt"] = prefill.get("prompt", "")
    elif intent == "agreement":
        st.session_state["agreements_prompt"] = prefill.get("prompt", "")
    return intent


def _route_from_ai_result(data: dict[str, Any]) -> str | None:
    intent = _store_workflow_prefill(data)
    if not intent:
        return None
    return WORKFLOW_PAGE_MAP.get(intent)


def _render_workflow_banner(intent: str) -> None:
    data = st.session_state.get("active_ai_workflow") or {}
    if _workflow_intent_from_result(data) != intent:
        return
    st.success(f"AI prepared this {intent.replace('_', ' ')} form from: {data.get('transcript', '')}")
    missing = data.get("missing_fields") or []
    if missing:
        st.warning("Please complete: " + ", ".join(missing))


def _parse_date_from_iso(value: str | None, fallback: date | None = None) -> date:
    if not value:
        return fallback or date.today()
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(value)
        except ValueError:
            return fallback or date.today()


def display_error(error: str | None) -> bool:
    if error:
        st.error(error)
        return True
    return False


def login_panel(inline: bool = False) -> None:
    if not inline:
        st.sidebar.header("Connection")
        st.sidebar.text_input("API Base", key="api_base_url", value=st.session_state.get("api_base_url", DEFAULT_API_BASE_URL))
        
        if st.sidebar.button("Check Health", use_container_width=True):
            payload, error = api_request("GET", "/health")
            if error: st.sidebar.error("Offline")
            else: st.sidebar.success("Online")
            
        if st.sidebar.button("Logout", use_container_width=True):
            if st.session_state.get("access_token"):
                api_request("POST", "/api/v1/auth/logout")
            st.session_state.clear()
            st.rerun()
            
        user = st.session_state.get("current_user")
        if user:
            st.sidebar.caption(f"Logged in as {user.get('email')}")
        return

    st.markdown("### Welcome to Mabdel")
    st.caption("Sign in to your account to continue")
    
    auth_tab, signup_tab = st.tabs(["Login", "Create Account"])
    with auth_tab:
        email = st.text_input("Email", placeholder="hello@example.com")
        password = st.text_input("Password", type="password")
        if st.button("Login", type="primary", use_container_width=True):
            payload, error = api_request("POST", "/api/v1/auth/login", json_body={"email": email, "password": password})
            if error:
                st.error(error)
                return
            data = unwrap_data(payload) or {}
            st.session_state["access_token"] = data.get("access_token")
            st.session_state["refresh_token"] = data.get("refresh_token")
            st.session_state["current_user"] = data.get("user")
            st.success("Welcome back!")
            st.rerun()
            
    with signup_tab:
        full_name = st.text_input("Full name", key="signup_name")
        s_email = st.text_input("Email", key="signup_email")
        s_pass = st.text_input("Password", type="password", key="signup_password")
        if st.button("Register", use_container_width=True):
            _, error = api_request("POST", "/api/v1/auth/register", json_body={"full_name": full_name, "email": s_email, "password": s_pass})
            if error: st.error(error)
            else: st.info("Check your email for OTP")
        
        otp = st.text_input("OTP Code", key="signup_otp")
        if st.button("Verify & Activate", use_container_width=True):
            _, error = api_request("POST", "/api/v1/auth/verify-otp", json_body={"email": s_email, "code": otp, "purpose": "signup"})
            if error: st.error(error)
            else: st.success("Activated! You can now login.")


def auth_required() -> bool:
    if st.session_state.get("access_token"):
        return True
    st.info("Login from the sidebar to use protected backend APIs.")
    return False


def render_home() -> None:
    st.subheader("Overview")
    if not auth_required():
        return
    payload, error = api_request("GET", "/api/v1/smartflow/home")
    if display_error(error):
        return
    data = unwrap_data(payload) or {}
    
    stats = data.get("stats") or data.get("summary") or {}
    if not stats:
        stats = {
            "Contacts": len((data.get("contacts") or {}).get("items", [])) if isinstance(data.get("contacts"), dict) else 0,
            "Unread": ((data.get("messages") or {}).get("summary") or {}).get("total_unread", 0) if isinstance(data.get("messages"), dict) else 0,
            "Tasks": ((data.get("notifications") or {}).get("summary") or {}).get("unread_count", 0) if isinstance(data.get("notifications"), dict) else 0,
        }
    
    cols = st.columns(len(stats))
    for i, (label, val) in enumerate(stats.items()):
        cols[i].metric(label.title(), val)

    st.markdown("---")
    st.markdown("#### Shortcuts")
    st.button("Ask Mabdel AI", type="primary", use_container_width=True, on_click=set_page, args=("AI Workflow",))
    
    c1, c2 = st.columns(2)
    if c1.button("👥 Add Contact", use_container_width=True): seed_sample_contacts()
    if c2.button("💬 Start Chat", use_container_width=True): seed_sample_conversation()
    
    render_response(data, title="Home State Debug")


def seed_sample_contacts() -> None:
    samples = [
        {"name": "Sarah Jenkins", "email": "sarah@example.com", "phone": "+15550123456", "company": "Acme Corp"},
        {"name": "Alex Rivera", "email": "alex@example.com", "phone": "+15550987654", "company": "Mabdel"},
    ]
    created = 0
    for sample in samples:
        _, error = api_request("POST", "/api/v1/smartflow/contacts", json_body=sample)
        if not error:
            created += 1
    st.success(f"{created} sample contact created.")


def seed_sample_conversation() -> None:
    contact_payload, error = api_request(
        "POST",
        "/api/v1/smartflow/contacts",
        json_body={"name": "Unified Inbox Lead", "email": "lead@example.com", "phone": "+15550001111"},
    )
    if display_error(error):
        return
    contact_id = (unwrap_data(contact_payload) or {}).get("id")
    conversation_payload, error = api_request(
        "POST",
        "/api/v1/smartflow/conversations",
        json_body={"contact_id": contact_id, "type": "direct", "platform": "whatsapp", "member_ids": []},
    )
    if display_error(error):
        return
    conversation_id = (unwrap_data(conversation_payload) or {}).get("id")
    _, error = api_request(
        "POST",
        "/api/v1/smartflow/messages",
        json_body={
            "conversation_id": conversation_id,
            "contact_id": contact_id,
            "platform": "whatsapp",
            "direction": "inbound",
            "content": "Hi, I want to discuss pricing and schedule a call.",
        },
    )
    st.error(error) if error else st.success("Sample WhatsApp-style conversation created.")


def render_contacts() -> None:
    st.subheader("Contacts")
    if not auth_required():
        return
    search = st.text_input("Search contacts")
    payload, error = api_request("GET", "/api/v1/smartflow/contacts", params={"page": 1, "page_size": PAGE_SIZE, "search": search})
    if not display_error(error):
        data = unwrap_data(payload) or {}
        items = data.get("items", [])
        show_cards(items, title_key="name", subtitle_keys=["email", "phone", "company", "presence"], badge_key="presence")
        render_response(data, title="Contacts debug JSON")

    with st.form("create_contact_form", clear_on_submit=True):
        st.markdown("#### Add Contact")
        name = st.text_input("Name", key="contact_name")
        email = st.text_input("Email", key="contact_email")
        phone = st.text_input("Phone", key="contact_phone")
        company = st.text_input("Company", key="contact_company")
        submitted = st.form_submit_button("Create Contact", type="primary")
        if submitted:
            body = _clean_payload({"name": name, "email": email, "phone": phone, "company": company})
            payload, error = api_request("POST", "/api/v1/smartflow/contacts", json_body=body)
            st.error(error) if error else st.success("Contact created")
            render_response(payload, title="Create contact debug")


def render_conversations() -> None:
    st.subheader("Messages")
    if not auth_required():
        return

    selected_id = st.session_state.get("selected_conversation_id")
    
    if not selected_id:
        # Inbox View
        platforms = st.multiselect("Filter Platforms", PLATFORMS, default=[])
        search = st.text_input("Search messages...", placeholder="Name or content")
        
        params = {"page": 1, "page_size": PAGE_SIZE, "search": search}
        if platforms:
            params["platforms"] = ",".join(platforms)
            
        payload, error = api_request("GET", "/api/v1/smartflow/conversations", params=params)
        if display_error(error):
            return
            
        data = unwrap_data(payload) or {}
        items = data.get("items", [])
        
        unread = (data.get("summary") or {}).get("total_unread", 0)
        if unread > 0:
            st.warning(f"You have {unread} unread messages")
            
        for item in items:
            label = f"{item.get('contact_name') or item.get('title') or 'Conversation'}"
            platform = item.get('platform_label', item.get('platform', 'ai')).upper()
            preview = item.get("last_message_preview") or "No messages yet"
            unread_count = item.get("unread_count", 0)
            
            card_html = f"""
            <div style='border-bottom: 1px solid #1e293b; padding: 12px 0;'>
                <div style='display: flex; justify-content: space-between;'>
                    <span style='font-weight: 600;'>{label}</span>
                    <span style='font-size: 0.7rem; color: #38bdf8;'>{platform}</span>
                </div>
                <div style='color: #94a3b8; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'>
                    {preview}
                </div>
                {f"<div style='background: #0ea5e9; width: 8px; height: 8px; border-radius: 50%; margin-top: 4px;'></div>" if unread_count > 0 else ""}
            </div>
            """
            if st.button(label, key=f"btn_conv_{item['id']}", use_container_width=True, help=preview):
                st.session_state["selected_conversation_id"] = item["id"]
                st.session_state["selected_conversation"] = item
                st.rerun()
        
        render_response(data, title="Inbox debug JSON")
    else:
        # Chat View
        selected = st.session_state.get("selected_conversation") or {}
        
        # Header with Back Button
        c1, c2 = st.columns([1, 5])
        if c1.button("←", key="back_to_inbox"):
            st.session_state.pop("selected_conversation_id", None)
            st.session_state.pop("selected_conversation", None)
            st.rerun()
        c2.markdown(f"**{selected.get('contact_name') or selected.get('title') or 'Chat'}**")
        
        messages_payload, error = api_request("GET", f"/api/v1/smartflow/conversations/{selected_id}/messages", params={"page": 1, "page_size": 50})
        if not display_error(error):
            messages = (unwrap_data(messages_payload) or {}).get("items", [])
            for message in reversed(messages):
                is_user = message.get("direction") == "outbound"
                css = "m-bubble-user" if is_user else "m-bubble-other"
                sender = "You" if is_user else message.get("sender_name", "Contact")
                time_label = message.get("display_time_label") or message.get("timestamp") or ""
                
                st.markdown(
                    f"<div class='{css}'><strong>{sender}</strong><br>{message.get('content', '')}<div class='m-muted' style='font-size: 0.65rem; margin-top: 4px; text-align: right;'>{time_label}</div></div>",
                    unsafe_allow_html=True,
                )
            
            reply = st.chat_input("Message...")
            if reply:
                payload, error = api_request(
                    "POST",
                    "/api/v1/smartflow/messages",
                    json_body={
                        "conversation_id": selected_id,
                        "contact_id": selected.get("contact_id"),
                        "platform": selected.get("platform", "whatsapp"),
                        "direction": "outbound",
                        "content": reply,
                    },
                )
                if not error:
                    st.rerun()
                else:
                    st.error(error)


def render_integrations() -> None:
    st.subheader("Social Integrations")
    if not auth_required():
        return
    payload, error = api_request("GET", "/api/v1/smartflow/integrations/status")
    if display_error(error):
        return
    data = unwrap_data(payload) or {}
    summary = data.get("summary") or {}
    c1, c2, c3 = st.columns(3)
    c1.metric("Connected", summary.get("connected_count", 0))
    c2.metric("Needs Attention", summary.get("needs_attention_count", 0))
    c3.metric("Message Sync Enabled", summary.get("message_sync_enabled_count", 0))
    for item in data.get("items", []):
        st.markdown(
            f"<div class='m-card'><span class='m-pill'>{item.get('status')}</span><strong>{item.get('platform_label')}</strong>"
            f"<div class='m-muted'>{item.get('description')} | sync: {item.get('sync_status')} | webhook: {item.get('webhook_status')}</div></div>",
            unsafe_allow_html=True,
        )
    render_response(data, title="Integration debug JSON")

    with st.expander("Start OAuth"):
        platform = st.selectbox("Platform", ["instagram", "facebook_messenger", "whatsapp", "snapchat", "linkedin", "twitter_x"])
        if st.button("Get OAuth URL"):
            payload, error = api_request("GET", f"/api/v1/smartflow/integrations/{platform}/oauth/start")
            if error:
                st.error(error)
            else:
                data = unwrap_data(payload) or {}
                st.link_button("Open Provider OAuth", data.get("auth_url", "#"))
                st.json(data)

    with st.expander("Manual token connect / sync"):
        platform = st.selectbox("Connect platform", ["instagram", "facebook_messenger", "whatsapp", "snapchat", "linkedin", "twitter_x"], key="manual_platform")
        access_token = st.text_input("Access token", type="password")
        external_account_id = st.text_input("External account ID")
        external_account_name = st.text_input("External account name")
        if st.button("Connect Token"):
            body = _clean_payload(
                {
                    "platform": platform,
                    "access_token": access_token,
                    "external_account_id": external_account_id,
                    "external_account_name": external_account_name,
                }
            )
            payload, error = api_request("POST", "/api/v1/smartflow/integrations", json_body=body)
            st.error(error) if error else st.success("Connected")
            render_response(payload)
        if st.button("Run Sync"):
            payload, error = api_request("POST", f"/api/v1/smartflow/integrations/{platform}/sync")
            st.error(error) if error else st.json(unwrap_data(payload))


def render_invoices() -> None:
    st.subheader("Invoices")
    if not auth_required():
        return
    _render_workflow_banner("invoice")
    payload, error = api_request("GET", "/api/v1/invoices", params={"page": 1, "page_size": PAGE_SIZE})
    if not display_error(error):
        data = unwrap_data(payload) or {}
        summary = data.get("summary") or {}
        cols = st.columns(3)
        cols[0].metric("Invoices", summary.get("total_invoices", len(data.get("items", []))))
        cols[1].metric("Outstanding", summary.get("total_outstanding", 0))
        cols[2].metric("Paid", summary.get("paid_invoices", 0))
        show_cards(data.get("items", []), title_key="client_name", subtitle_keys=["invoice_number", "status", "total_amount", "due_date"], badge_key="status")
        render_response(data, title="Invoices debug JSON")

    with st.form("create_invoice_form", clear_on_submit=False):
        st.markdown("#### Create Invoice")
        prefill = st.session_state.get("invoice_prefill") or {}
        default_item = (prefill.get("items") or [{}])[0]
        client_name = st.text_input("Client name", value=prefill.get("client_name", ""), key="invoice_client")
        client_email = st.text_input("Client email", value=prefill.get("client_email", ""), key="invoice_email")
        amount = st.number_input(
            "Amount",
            min_value=0.0,
            step=50.0,
            value=float(default_item.get("unit_price") or st.session_state.get("invoice_amount", 0.0)),
            key="invoice_amount",
        )
        due_date = st.date_input("Due date", value=_parse_date_from_iso(prefill.get("due_date"), date.today()), key="invoice_due_date")
        description = st.text_area(
            "Description",
            value=default_item.get("description") or st.session_state.get("invoice_description", "Professional services"),
            key="invoice_description",
        )
        notes = st.text_area("Notes", value=prefill.get("notes", ""), key="invoice_notes")
        submitted = st.form_submit_button("Create Invoice", type="primary")
        if submitted:
            body = {
                "client_name": client_name,
                "client_email": client_email,
                "issue_date": date.today().isoformat(),
                "due_date": due_date.isoformat(),
                "currency": prefill.get("currency") or st.session_state.get("invoice_currency", "USD"),
                "notes": notes,
                "items": [{"description": description, "quantity": 1, "unit_price": amount}],
            }
            payload, error = api_request("POST", "/api/v1/invoices", json_body=_clean_payload(body))
            if error:
                st.error(error)
            else:
                created = unwrap_data(payload) or {}
                st.success(f"Invoice {created.get('invoice_number', '')} created for {created.get('client_name', client_name)}.")
                c1, c2, c3 = st.columns(3)
                c1.metric("Total", created.get("total_amount", amount))
                c2.metric("Status", created.get("status", "draft"))
                c3.metric("Due", created.get("due_date", due_date.isoformat()))
                render_response(created, title="Invoice details")


def render_documents(kind: str) -> None:
    title = "Leases" if kind == "leases" else "Agreements"
    st.subheader(title)
    if not auth_required():
        return
    _render_workflow_banner("lease" if kind == "leases" else "agreement")
    status_filter = st.text_input("Status filter", value="all" if kind == "leases" else "", key=f"{kind}_status_filter")
    params = {"page": 1, "page_size": PAGE_SIZE}
    if status_filter:
        params["status"] = status_filter
    payload, error = api_request("GET", f"/api/v1/smartflow/{kind}", params=params)
    if not display_error(error):
        data = unwrap_data(payload) or {}
        show_cards(
            data.get("items", []),
            title_key="tenant_name" if kind == "leases" else "title",
            subtitle_keys=["property_address", "client_name", "status", "created_at", "monthly_rent_label"],
            badge_key="status",
        )
        render_response(data, title=f"{title} debug JSON")

    with st.expander(f"AI generate and save {kind[:-1]}", expanded=True):
        prompt = st.text_area(
            "Prompt",
            value=st.session_state.get(f"{kind}_prompt", f"Create a professional {kind[:-1]} draft."),
            key=f"{kind}_prompt",
        )
        if st.button("Generate Draft", key=f"{kind}_generate_draft"):
            endpoint = f"/api/v1/smartflow/{kind}/generate"
            payload, error = api_request("POST", endpoint, json_body={"prompt": prompt})
            if display_error(error):
                return
            draft = unwrap_data(payload) or {}
            st.session_state[f"{kind}_draft"] = draft
            st.success("Draft generated. Review below, then save.")
        draft = st.session_state.get(f"{kind}_draft")
        if draft:
            st.text_area("Generated content", value=draft.get("content", ""), height=260, key=f"{kind}_draft_content")
            if st.button(f"Save {kind[:-1].title()}", key=f"{kind}_save_draft"):
                if kind == "leases":
                    body = {
                        "prompt": prompt,
                        "property_address": draft.get("property_address") or "123 Main Street",
                        "property_type": draft.get("property_type") or "apartment",
                        "landlord_name": draft.get("landlord_name") or "Mabdel Properties",
                        "tenant_name": draft.get("tenant_name") or "Tenant",
                        "tenant_email": draft.get("tenant_email") or "tenant@example.com",
                        "monthly_rent_cents": draft.get("monthly_rent_cents") or 120000,
                        "security_deposit_cents": draft.get("security_deposit_cents") or 120000,
                        "rent_due_day": draft.get("rent_due_day") or 1,
                        "start_date": draft.get("start_date") or date.today().isoformat(),
                        "end_date": draft.get("end_date") or date(date.today().year + 1, date.today().month, date.today().day).isoformat(),
                        "content": st.session_state.get(f"{kind}_draft_content"),
                        "status": "draft",
                    }
                else:
                    body = {
                        "title": draft.get("title") or "Generated Agreement",
                        "client_name": draft.get("client_name") or "Client",
                        "client_email": draft.get("client_email") or "client@example.com",
                        "agreement_type": draft.get("agreement_type") or "contract",
                        "priority": draft.get("priority") or "standard",
                        "content": st.session_state.get(f"{kind}_draft_content"),
                        "smart_fields": draft.get("smart_fields") or [],
                    }
                payload, error = api_request("POST", f"/api/v1/smartflow/{kind}", json_body=body)
                st.error(error) if error else st.success(f"{kind[:-1].title()} saved")
                render_response(payload, title=f"Saved {kind[:-1]} debug")


def render_bulk_messages() -> None:
    st.subheader("Bulk Messages")
    if not auth_required():
        return
    _render_workflow_banner("bulk_message")
    payload, error = api_request("GET", "/api/v1/smartflow/bulk-messages", params={"page": 1, "page_size": PAGE_SIZE})
    if not display_error(error):
        data = unwrap_data(payload) or {}
        show_cards(data.get("items", []), title_key="subject", subtitle_keys=["channel", "status", "recipient_count", "sent_count"], badge_key="status")
        render_response(data, title="Bulk messages debug JSON")

    with st.form("bulk_message_form"):
        st.markdown("#### Create Real Bulk Message")
        prefill = st.session_state.get("bulk_message_prefill") or {}
        channel_options = ["email", "sms"]
        channel_default = prefill.get("channel") if prefill.get("channel") in channel_options else "email"
        channel = st.selectbox("Channel", channel_options, index=channel_options.index(channel_default), key="bulk_channel")
        subject = st.text_input("Subject", value=prefill.get("subject") or "", key="bulk_subject")
        content = st.text_area("Content", value=prefill.get("content") or "", key="bulk_content")
        contact_ids = st.text_area("Contact IDs, one per line", value="\n".join(prefill.get("contact_ids") or []), key="bulk_contact_ids")
        recipient_emails = st.text_area(
            "Recipient emails, one per line",
            value="\n".join(prefill.get("recipient_emails") or []),
            key="bulk_recipient_emails",
        )
        send_now = st.checkbox("Send now", value=bool(prefill.get("send_now", True)), key="bulk_send_now")
        submitted = st.form_submit_button("Create Bulk Message")
        if submitted:
            body = _clean_payload(
                {
                    "channel": channel,
                    "subject": subject,
                    "content": content,
                    "contact_ids": _line_list(contact_ids),
                    "recipient_emails": _line_list(recipient_emails),
                    "send_now": send_now,
                    "ai_transcript": prefill.get("ai_transcript"),
                }
            )
            payload, error = api_request("POST", "/api/v1/smartflow/bulk-messages", json_body=body)
            if error:
                st.error(error)
            else:
                created = unwrap_data(payload) or {}
                st.success(f"Bulk message created: {created.get('subject') or created.get('id')}")
                render_response(created, title="Bulk message details")


def render_calls() -> None:
    st.subheader("Twilio Calls")
    if not auth_required():
        return
    status_filter = st.text_input("Status")
    summary_payload, summary_error = api_request("GET", "/api/v1/smartflow/calls/summary")
    if not summary_error:
        summary = unwrap_data(summary_payload) or {}
        cols = st.columns(4)
        cols[0].metric("Total", summary.get("total_calls", 0))
        cols[1].metric("Missed", summary.get("missed_calls", 0))
        cols[2].metric("Completed", summary.get("completed_calls", 0))
        cols[3].metric("AI Ready", summary.get("ai_ready_calls", 0))

    payload, error = api_request("GET", "/api/v1/smartflow/calls", params=_clean_payload({"page": 1, "page_size": PAGE_SIZE, "status": status_filter}))
    if not display_error(error):
        data = unwrap_data(payload) or {}
        show_cards(data.get("items", []), title_key="display_name", subtitle_keys=["phone_number", "status", "duration_label", "timestamp"], badge_key="status")
        render_response(data, title="Calls debug JSON")

    with st.form("outbound_twilio_call_form"):
        st.markdown("#### Start Outbound Twilio Call")
        phone = st.text_input("Phone number", placeholder="+88017XXXXXXXX")
        from_number = st.text_input("From number override", placeholder="Optional Twilio number")
        ai_ready = st.checkbox("AI ready call", value=True)
        submitted = st.form_submit_button("Start Call", type="primary")
        if submitted:
            body = _clean_payload({"phone_number": phone, "from_number": from_number, "ai_ready": ai_ready})
            payload, error = api_request("POST", "/api/v1/smartflow/calls/outbound", json_body=body)
            if error:
                st.error(error)
                st.info("Twilio call needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and PUBLIC_BACKEND_URL configured.")
            else:
                data = unwrap_data(payload) or {}
                call_log = data.get("call_log") or {}
                st.success(f"Call queued with Twilio SID: {data.get('twilio_call_sid')}")
                c1, c2, c3 = st.columns(3)
                c1.metric("Status", data.get("twilio_status", call_log.get("status", "queued")))
                c2.metric("To", call_log.get("phone_number", phone))
                c3.metric("AI Ready", "Yes" if call_log.get("ai_ready") else "No")
                render_response(data, title="Call details")


def render_notifications() -> None:
    st.subheader("Notifications")
    if not auth_required():
        return
    unread_only = st.checkbox("Unread only")
    payload, error = api_request("GET", "/api/v1/smartflow/notifications", params={"page": 1, "page_size": PAGE_SIZE, "unread_only": unread_only})
    if display_error(error):
        return
    data = unwrap_data(payload) or {}
    show_cards(data.get("items", []), title_key="title", subtitle_keys=["body", "display_time_label", "type"], badge_key="date_bucket")
    render_response(data, title="Notifications debug JSON")
    if st.button("Mark all read"):
        payload, error = api_request("POST", "/api/v1/smartflow/notifications/mark-all-read")
        st.error(error) if error else st.success("Marked all read")
        render_response(payload)


def render_ai_workflow() -> None:
    st.subheader("Mabdel AI Workflow")
    if not auth_required():
        return
    st.caption("Text or audio command দিলে LangGraph intent detect করে proper create page খুলে দেবে.")

    intent_options = ["Auto detect", "invoice", "bulk_message", "calendar", "lease", "agreement"]
    intent_label = st.selectbox("Workflow", intent_options)
    prompt = st.text_area("Text command", value="Create an invoice for Alex for $1200 due next Friday")

    audio_file = None
    if hasattr(st, "audio_input"):
        audio_file = st.audio_input("Voice command")
    else:
        audio_file = st.file_uploader("Voice command file", type=["wav", "mp3", "m4a", "webm", "ogg"])

    if st.button("Prepare and Open Form", type="primary"):
        body: dict[str, Any] = {"current_values": {}}
        if intent_label != "Auto detect":
            body["workflow_intent"] = intent_label
        if prompt.strip():
            body["transcript"] = prompt.strip()
        if audio_file is not None:
            audio_bytes = audio_file.getvalue()
            body["audio_base64"] = base64.b64encode(audio_bytes).decode("utf-8")
            body["audio_mime_type"] = getattr(audio_file, "type", None) or "audio/wav"
            body["audio_filename"] = getattr(audio_file, "name", None) or "voice.wav"
            body.pop("transcript", None)
        if not body.get("transcript") and not body.get("audio_base64"):
            st.error("Type a command or record/upload audio first.")
            return

        payload, error = api_request("POST", "/api/v1/smartflow/ai/workflow-prefill", json_body=body)
        if display_error(error):
            return
        data = unwrap_data(payload) or {}
        st.session_state["last_ai_prefill"] = data
        route = _route_from_ai_result(data)
        workflow = data.get("workflow") or {}
        st.success(f"{workflow.get('intent', intent_label)} form prepared.")
        st.markdown(f"**Transcript:** {data.get('transcript', '')}")
        st.markdown(f"**Next action:** `{data.get('next_action')}`")
        render_response(data.get("prefill"), title="AI-filled form fields")
        if route:
            st.session_state["pending_page"] = route
            st.rerun()

    with st.expander("Raw AI chat"):
        message = st.text_area("Message", key="ai_chat_message")
        if st.button("Send Chat"):
            payload, error = api_request("POST", "/api/v1/smartflow/ai/chat", json_body={"content": message})
            if error:
                st.error(error)
            else:
                data = unwrap_data(payload) or {}
                navigation = data.get("navigation") or {}
                st.write((data.get("ai_message") or {}).get("content", ""))
                if navigation.get("should_redirect"):
                    route = _route_from_ai_result(data)
                    if route:
                        st.session_state["pending_page"] = route
                        st.rerun()
                render_response(data, title="AI details")


def render_public_bootstrap() -> None:
    st.subheader("Public, Bootstrap, and Permissions")
    st.caption("Use this page before or after login to test startup flows.")

    tab_config, tab_content, tab_permissions, tab_onboarding = st.tabs(["App Config", "Content", "Permissions", "Onboarding"])

    with tab_config:
        current_version = st.text_input("Current version", value="1.0.0")
        device_id = st.text_input("Device ID", value="web-console")
        if st.button("Load App Config", type="primary"):
            payload, error = api_request(
                "GET",
                "/api/v1/app/config",
                params={"current_version": current_version, "device_id": device_id},
            )
            st.error(error) if error else st.json(unwrap_data(payload))

    with tab_content:
        slug = st.selectbox("Page", ["about-us", "terms-and-conditions", "privacy-policy", "help-support"])
        if st.button("Load Content"):
            payload, error = api_request("GET", f"/api/v1/content/{slug}")
            st.error(error) if error else st.json(unwrap_data(payload))

    with tab_permissions:
        permission_device_id = st.text_input("Permission device ID", value="web-console-device")
        col1, col2 = st.columns(2)
        if col1.button("Get Permissions", use_container_width=True):
            payload, error = api_request("GET", "/api/v1/app/permissions", params={"device_id": permission_device_id})
            st.error(error) if error else st.json(unwrap_data(payload))
        if col2.button("Accept All", use_container_width=True):
            payload, error = api_request("POST", "/api/v1/app/permissions/accept-all", json_body={"device_id": permission_device_id})
            st.error(error) if error else st.json(unwrap_data(payload))
        with st.form("permissions_update_form"):
            microphone_enabled = st.checkbox("Microphone", value=True)
            notifications_enabled = st.checkbox("Notifications", value=True)
            contacts_enabled = st.checkbox("Contacts", value=True)
            if st.form_submit_button("Save Permissions"):
                body = {
                    "device_id": permission_device_id,
                    "microphone_enabled": microphone_enabled,
                    "notifications_enabled": notifications_enabled,
                    "contacts_enabled": contacts_enabled,
                }
                payload, error = api_request("PUT", "/api/v1/app/permissions", json_body=body)
                st.error(error) if error else st.json(unwrap_data(payload))

    with tab_onboarding:
        if st.button("Load Slides"):
            payload, error = api_request("GET", "/api/v1/onboarding/slides")
            st.error(error) if error else st.json(unwrap_data(payload))
        with st.form("onboarding_progress_form"):
            onboarding_device_id = st.text_input("Onboarding device ID", value="web-console")
            current_step = st.number_input("Current step", min_value=0, step=1)
            if st.form_submit_button("Save Progress"):
                body = {"device_id": onboarding_device_id, "current_step": int(current_step)}
                payload, error = api_request("POST", "/api/v1/onboarding/progress", json_body=body)
                st.error(error) if error else st.json(unwrap_data(payload))


def render_calendar_events() -> None:
    st.subheader("Calendar")
    if not auth_required():
        return
    _render_workflow_banner("calendar")
    payload, error = api_request("GET", "/api/v1/smartflow/calendar/events", params={"page": 1, "page_size": PAGE_SIZE})
    if not display_error(error):
        data = unwrap_data(payload) or {}
        show_cards(data.get("items", []), title_key="title", subtitle_keys=["starts_at", "ends_at", "meeting_mode", "status"], badge_key="status")
        render_response(data, title="Calendar debug JSON")

    with st.form("create_calendar_event_form"):
        st.markdown("#### Create Event")
        prefill = st.session_state.get("calendar_prefill") or {}
        title = st.text_input("Title", value=prefill.get("title", "Client meeting"), key="calendar_title")
        description = st.text_area("Description", value=prefill.get("description", ""), key="calendar_description")
        event_date = st.date_input("Event date", value=_parse_date_from_iso(prefill.get("starts_at"), date.today()), key="calendar_event_date")
        start_hour = st.number_input("Start hour", min_value=0, max_value=23, value=9)
        end_hour = st.number_input("End hour", min_value=0, max_value=23, value=10)
        mode_options = ["offline", "online"]
        mode_default = prefill.get("meeting_mode") if prefill.get("meeting_mode") in mode_options else "offline"
        meeting_mode = st.selectbox("Meeting mode", mode_options, index=mode_options.index(mode_default), key="calendar_mode")
        location = st.text_input("Location or link")
        contact_ids = st.text_area("Contact IDs, one per line", value="\n".join(prefill.get("contact_ids") or []))
        if st.form_submit_button("Create Event", type="primary"):
            body = _clean_payload(
                {
                    "title": title,
                    "description": description,
                    "starts_at": _iso_datetime(event_date, int(start_hour)),
                    "ends_at": _iso_datetime(event_date, int(end_hour)),
                    "meeting_mode": meeting_mode,
                    "location": location if meeting_mode == "offline" else None,
                    "meeting_link": location if meeting_mode == "online" else None,
                    "contact_ids": _line_list(contact_ids),
                    "timezone": "Asia/Dhaka",
                }
            )
            payload, error = api_request("POST", "/api/v1/smartflow/calendar/events", json_body=body)
            if error:
                st.error(error)
            else:
                created = unwrap_data(payload) or {}
                st.success(f"Event scheduled: {created.get('title', title)}")
                render_response(created, title="Event details")


def render_groups() -> None:
    st.subheader("Groups")
    if not auth_required():
        return
    payload, error = api_request("GET", "/api/v1/smartflow/groups", params={"page": 1, "page_size": PAGE_SIZE})
    if not display_error(error):
        data = unwrap_data(payload) or {}
        show_cards(data.get("items", []), title_key="name", subtitle_keys=["description", "member_count", "pending_invite_count"], badge_key="can_manage")
        render_response(data, title="Groups debug JSON")

    with st.form("create_group_form"):
        st.markdown("#### Create Group")
        name = st.text_input("Group name")
        description = st.text_area("Description")
        member_ids = st.text_area("Member contact IDs, one per line")
        admin_ids = st.text_area("Admin contact IDs, one per line")
        if st.form_submit_button("Create Group", type="primary"):
            body = _clean_payload(
                {
                    "name": name,
                    "description": description,
                    "member_ids": _line_list(member_ids),
                    "admin_ids": _line_list(admin_ids),
                }
            )
            payload, error = api_request("POST", "/api/v1/smartflow/groups", json_body=body)
            st.error(error) if error else st.success("Group created")
            render_response(payload)


def render_settings_and_support() -> None:
    st.subheader("Settings, Business, and Support")
    if not auth_required():
        return

    tab_profile, tab_business, tab_subscription, tab_support = st.tabs(["Profile", "Business", "Subscription", "Support"])

    with tab_profile:
        payload, error = api_request("GET", "/api/v1/smartflow/settings")
        if not display_error(error):
            profile = unwrap_data(payload) or {}
            render_response(profile, title="Current profile")
        with st.form("profile_update_form"):
            full_name = st.text_input("Full name", value=(profile or {}).get("full_name", "") if "profile" in locals() else "")
            country = st.text_input("Country", value=(profile or {}).get("country", "") if "profile" in locals() else "")
            language = st.text_input("Language", value=(profile or {}).get("language_preference", "EN") if "profile" in locals() else "EN")
            if st.form_submit_button("Save Profile"):
                body = _clean_payload({"full_name": full_name, "country": country, "language_preference": language})
                payload, error = api_request("PATCH", "/api/v1/smartflow/settings", json_body=body)
                st.error(error) if error else st.success("Profile saved")
                render_response(payload)
        if st.button("Load Notification Preferences"):
            payload, error = api_request("GET", "/api/v1/smartflow/settings/notifications")
            st.error(error) if error else st.json(unwrap_data(payload))

    with tab_business:
        payload, error = api_request("GET", "/api/v1/smartflow/business-profile")
        if not display_error(error):
            render_response(unwrap_data(payload), title="Business profile")
        with st.form("business_profile_form"):
            business_name = st.text_input("Business name")
            email = st.text_input("Business email")
            phone_number = st.text_input("Phone")
            website = st.text_input("Website")
            office_address_text = st.text_area("Office address")
            if st.form_submit_button("Save Business Profile"):
                body = _clean_payload(
                    {
                        "business_name": business_name,
                        "email": email,
                        "phone_number": phone_number,
                        "website": website,
                        "office_address_text": office_address_text,
                    }
                )
                payload, error = api_request("PATCH", "/api/v1/smartflow/business-profile", json_body=body)
                st.error(error) if error else st.success("Business profile saved")
                render_response(payload)

    with tab_subscription:
        col1, col2 = st.columns(2)
        if col1.button("Plans", use_container_width=True):
            payload, error = api_request("GET", "/api/v1/smartflow/subscription/plans")
            st.error(error) if error else st.json(unwrap_data(payload))
        if col2.button("Current", use_container_width=True):
            payload, error = api_request("GET", "/api/v1/smartflow/subscription/current")
            st.error(error) if error else st.json(unwrap_data(payload))

    with tab_support:
        col1, col2 = st.columns(2)
        if col1.button("Start Support Session", use_container_width=True):
            payload, error = api_request("POST", "/api/v1/smartflow/support/session", json_body={"topic": "general"})
            st.error(error) if error else st.json(unwrap_data(payload))
        if col2.button("Load Messages", use_container_width=True):
            payload, error = api_request("GET", "/api/v1/smartflow/support/messages")
            st.error(error) if error else st.json(unwrap_data(payload))
        with st.form("support_ticket_form"):
            subject = st.text_input("Subject")
            message = st.text_area("Message")
            topic = st.selectbox("Topic", ["general", "account", "billing", "technical", "feature_request"])
            if st.form_submit_button("Create Support Ticket"):
                payload, error = api_request("POST", "/api/v1/smartflow/support/tickets", json_body={"topic": topic, "subject": subject, "message": message})
                st.error(error) if error else st.success("Support ticket created")
                render_response(payload)


def render_documents_hub() -> None:
    tab_agreements, tab_leases, tab_files = st.tabs(["Agreements", "Leases", "Files"])
    with tab_agreements:
        render_documents("agreements")
    with tab_leases:
        render_documents("leases")
    with tab_files:
        st.subheader("Documents")
        if not auth_required():
            return
        payload, error = api_request("GET", "/api/v1/smartflow/documents", params={"page": 1, "page_size": PAGE_SIZE})
        if not display_error(error):
            data = unwrap_data(payload) or {}
            show_cards(data.get("items", []), title_key="name", subtitle_keys=["type", "file_url", "created_at"], badge_key="type")
            render_response(data, title="Documents debug JSON")
        with st.form("create_document_form"):
            name = st.text_input("Name")
            doc_type = st.selectbox("Type", ["agreement", "invoice", "lease", "others"])
            file_url = st.text_input("File URL", value="https://example.com/document.pdf")
            if st.form_submit_button("Create Document"):
                payload, error = api_request("POST", "/api/v1/smartflow/documents", json_body={"name": name, "type": doc_type, "file_url": file_url})
                st.error(error) if error else st.success("Document created")
                render_response(payload)


def load_openapi_spec() -> tuple[dict[str, Any] | None, str | None]:
    payload, error = api_request("GET", "/openapi.json")
    if payload and not error:
        return payload, None
    snapshot = Path("docs/openapi.json")
    if snapshot.exists():
        try:
            return json.loads(snapshot.read_text(encoding="utf-8")), None
        except (OSError, json.JSONDecodeError) as exc:
            return None, f"{error}; local OpenAPI snapshot failed: {exc}"
    return None, error or "OpenAPI spec was not found."


def _resolve_schema(openapi: dict[str, Any], schema: dict[str, Any] | None) -> dict[str, Any]:
    if not schema:
        return {}
    if "$ref" in schema:
        ref = schema["$ref"].split("/")
        current: Any = openapi
        for part in ref[1:]:
            current = current.get(part, {})
        return _resolve_schema(openapi, current)
    for key in ("allOf", "anyOf", "oneOf"):
        if schema.get(key):
            merged: dict[str, Any] = {}
            for item in schema[key]:
                resolved = _resolve_schema(openapi, item)
                merged.update(resolved)
                if resolved.get("properties"):
                    merged.setdefault("properties", {}).update(resolved["properties"])
            return merged
    return schema


def _sample_from_schema(openapi: dict[str, Any], schema: dict[str, Any] | None) -> Any:
    schema = _resolve_schema(openapi, schema)
    if "example" in schema:
        return schema["example"]
    if "default" in schema:
        return schema["default"]
    if schema.get("enum"):
        return schema["enum"][0]

    schema_type = schema.get("type")
    schema_format = schema.get("format")
    if schema_type == "object" or schema.get("properties"):
        return {
            name: _sample_from_schema(openapi, prop_schema)
            for name, prop_schema in (schema.get("properties") or {}).items()
            if not prop_schema.get("readOnly")
        }
    if schema_type == "array":
        return [_sample_from_schema(openapi, schema.get("items") or {})]
    if schema_type == "integer":
        return 1
    if schema_type == "number":
        return 1.0
    if schema_type == "boolean":
        return True
    if schema_format == "date":
        return date.today().isoformat()
    if schema_format == "date-time":
        return _iso_datetime(date.today())
    if schema_format == "email":
        return "user@example.com"
    if schema_format == "binary":
        return None
    return "string"


def _request_media_types(operation: dict[str, Any]) -> list[str]:
    return list(((operation.get("requestBody") or {}).get("content") or {}).keys())


def _request_schema(operation: dict[str, Any], media_type: str) -> dict[str, Any]:
    return (((operation.get("requestBody") or {}).get("content") or {}).get(media_type) or {}).get("schema") or {}


def _operation_inventory(openapi: dict[str, Any]) -> list[dict[str, Any]]:
    operations: list[dict[str, Any]] = []
    for path, methods in (openapi.get("paths") or {}).items():
        for method, spec in methods.items():
            method_upper = method.upper()
            if method_upper not in HTTP_METHODS:
                continue
            tags = spec.get("tags") or ["Other"]
            operations.append(
                {
                    "label": f"{method_upper} {path} - {spec.get('summary') or spec.get('operationId') or ''}",
                    "method": method_upper,
                    "path": path,
                    "tag": tags[0],
                    "summary": spec.get("summary") or spec.get("operationId") or "",
                    "operation": spec,
                    "auth": bool(spec.get("security") or openapi.get("security")),
                    "media_types": _request_media_types(spec),
                }
            )
    return sorted(operations, key=lambda item: (item["tag"], item["path"], item["method"]))


def _parameter_sample(openapi: dict[str, Any], parameter: dict[str, Any]) -> Any:
    return _sample_from_schema(openapi, parameter.get("schema") or {})


def render_endpoint_runner(openapi: dict[str, Any], selected: dict[str, Any]) -> None:
    operation = selected["operation"]
    st.markdown(f"**{selected['method']}** `{selected['path']}`")
    if selected["summary"]:
        st.caption(selected["summary"])
    if selected["auth"]:
        st.info("This endpoint usually needs a bearer token. Login first or paste a token through the login flow.")

    parameters = operation.get("parameters") or []
    path_params = [param for param in parameters if param.get("in") == "path"]
    query_params = [param for param in parameters if param.get("in") == "query"]

    resolved_path = selected["path"]
    if path_params:
        st.markdown("#### Path Parameters")
        for param in path_params:
            name = param["name"]
            value = st.text_input(name, value=str(_parameter_sample(openapi, param)), key=f"path_{selected['method']}_{selected['path']}_{name}")
            resolved_path = resolved_path.replace("{" + name + "}", value)

    query_template = {
        param["name"]: _parameter_sample(openapi, param)
        for param in query_params
        if not param.get("schema", {}).get("deprecated")
    }
    st.markdown("#### Query Parameters")
    params_text = st.text_area(
        "Query params JSON",
        value=json.dumps(query_template, indent=2, default=_json_default),
        key=f"query_{selected['method']}_{selected['path']}",
    )

    media_types = selected["media_types"]
    media_type = media_types[0] if media_types else ""
    if media_types:
        media_type = st.selectbox("Request body type", media_types, key=f"media_{selected['method']}_{selected['path']}")

    body_text = "{}"
    form_data: dict[str, Any] = {}
    files: dict[str, Any] = {}
    if media_type == "application/json":
        body_template = _sample_from_schema(openapi, _request_schema(operation, media_type))
        body_text = st.text_area(
            "Body JSON",
            value=json.dumps(body_template, indent=2, default=_json_default),
            height=260,
            key=f"body_{selected['method']}_{selected['path']}",
        )
    elif media_type == "multipart/form-data":
        st.markdown("#### Multipart Form")
        schema = _resolve_schema(openapi, _request_schema(operation, media_type))
        for name, prop_schema in (schema.get("properties") or {}).items():
            resolved = _resolve_schema(openapi, prop_schema)
            if resolved.get("format") == "binary":
                uploaded = st.file_uploader(name, key=f"file_{selected['method']}_{selected['path']}_{name}")
                if uploaded is not None:
                    files[name] = (uploaded.name, uploaded.getvalue(), uploaded.type or "application/octet-stream")
            else:
                form_data[name] = st.text_input(name, value=str(_sample_from_schema(openapi, resolved)), key=f"form_{selected['method']}_{selected['path']}_{name}")

    if st.button("Send Selected API", type="primary", key=f"send_{selected['method']}_{selected['path']}"):
        try:
            params = _json_from_text(params_text, {})
            body = _json_from_text(body_text, {}) if media_type == "application/json" else None
        except json.JSONDecodeError as exc:
            st.error(f"Invalid JSON: {exc}")
            return
        response, error = api_request(
            selected["method"],
            resolved_path,
            params=params,
            json_body=body,
            form_data=form_data if media_type == "multipart/form-data" else None,
            files=files if files else None,
        )
        st.error(error) if error else st.json(response)


def render_all_backend_apis() -> None:
    st.subheader("All Backend APIs")
    st.caption("OpenAPI theke auto-loaded. Backend-e joto API registered ache, ekhane shob dekha and call kora jabe.")
    openapi, error = load_openapi_spec()
    if not openapi:
        st.error(error)
        return

    operations = _operation_inventory(openapi)
    tags = sorted({item["tag"] for item in operations})
    c1, c2, c3 = st.columns(3)
    c1.metric("Total APIs", len(operations))
    c2.metric("Groups", len(tags))
    c3.metric("With Body", sum(1 for item in operations if item["media_types"]))

    selected_tag = st.selectbox("API group", ["All"] + tags)
    search = st.text_input("Search API", placeholder="/api/v1/smartflow or invoice")
    filtered = [
        item
        for item in operations
        if (selected_tag == "All" or item["tag"] == selected_tag)
        and (not search or search.lower() in item["label"].lower())
    ]

    st.dataframe(
        [
            {
                "method": item["method"],
                "path": item["path"],
                "group": item["tag"],
                "body": ", ".join(item["media_types"]) or "-",
                "summary": item["summary"],
            }
            for item in filtered
        ],
        use_container_width=True,
        hide_index=True,
    )

    if not filtered:
        st.warning("No API matched this filter.")
        return

    selected_label = st.selectbox("Select API to call", [item["label"] for item in filtered])
    selected = next(item for item in filtered if item["label"] == selected_label)
    render_endpoint_runner(openapi, selected)


def render_api_console() -> None:
    st.subheader("API Explorer")
    st.caption("This is the escape hatch: any backend endpoint can be tested from here.")

    payload, error = load_openapi_spec()
    operations: list[tuple[str, str, str]] = []
    if not error and payload:
        for item in _operation_inventory(payload):
            operations.append((item["label"], item["method"], item["path"]))

    if operations:
        labels = [item[0] for item in operations]
        selected_label = st.selectbox("Known endpoints from OpenAPI", labels)
        selected = operations[labels.index(selected_label)]
        default_method, default_path = selected[1], selected[2]
    else:
        st.warning(error or "OpenAPI could not be loaded. You can still type a route manually.")
        default_method, default_path = "GET", "/api/v1/smartflow/home"

    method = st.selectbox("Method", HTTP_METHODS, index=HTTP_METHODS.index(default_method))
    path = st.text_input("Path", value=default_path)
    params_text = st.text_area("Query params JSON", value="{}")
    body_text = st.text_area("Body JSON", value="{}")
    if st.button("Send Request", type="primary"):
        try:
            params = _json_from_text(params_text, {})
            body = _json_from_text(body_text, {})
        except json.JSONDecodeError as exc:
            st.error(f"Invalid JSON: {exc}")
            return
        payload, error = api_request(method, path, params=params, json_body=body if method != "GET" else None)
        st.error(error) if error else st.json(payload)


def main() -> None:
    st.set_page_config(page_title="Mabdel Console", page_icon="M", layout="wide")
    inject_styles()
    
    cols = st.columns([1, 4, 1])
    with cols[1]:
        st.markdown("<h2 style='text-align: center; margin-top: -20px; margin-bottom: 0;'>Mabdel</h2>", unsafe_allow_html=True)
        st.markdown("<p style='text-align: center; color: #667085; font-size: 0.85rem;'>Backend control website</p>", unsafe_allow_html=True)
    
    is_logged_in = bool(st.session_state.get("access_token"))
    if is_logged_in:
        login_panel(inline=False)
    else:
        st.sidebar.header("Connection")
        st.sidebar.text_input("API Base", key="api_base_url", value=st.session_state.get("api_base_url", DEFAULT_API_BASE_URL))
        if st.sidebar.button("Check Health", use_container_width=True):
            payload, error = api_request("GET", "/health")
            st.sidebar.error(error) if error else st.sidebar.success("Online")

    pages = {
        "Login": lambda: login_panel(inline=True),
        "Public Bootstrap": render_public_bootstrap,
        "Messages": render_conversations,
        "Contacts": render_contacts,
        "Calendar": render_calendar_events,
        "AI Workflow": render_ai_workflow,
        "Invoices": render_invoices,
        "Bulk Messages": render_bulk_messages,
        "Documents": render_documents_hub,
        "Calls": render_calls,
        "Groups": render_groups,
        "Notifications": render_notifications,
        "Integrations": render_integrations,
        "Settings": render_settings_and_support,
        "All Backend APIs": render_all_backend_apis,
        "API Explorer": render_api_console,
    }
    if is_logged_in:
        pages = {"Dashboard": render_home, **pages}
    
    page_names = list(pages.keys())
    pending_page = st.session_state.pop("pending_page", None)
    if pending_page in page_names:
        st.session_state["nav_page"] = pending_page
    elif st.session_state.get("nav_page") not in page_names:
        st.session_state["nav_page"] = page_names[0]

    default_page = st.session_state.get("nav_page")
    default_index = page_names.index(default_page) if default_page in page_names else 0
    selected = st.sidebar.radio("Navigation", page_names, index=default_index, key="nav_page")
    pages[selected]()


if __name__ == "__main__":
    main()
