# API Reference — gap-fill endpoints

Exact backend contracts for every feature in `01_GAP_ANALYSIS.md`. Read directly from the real FastAPI routers and Pydantic schemas in `Mabdel Backend/app` — not from docs or comments. All paths are relative to `/api/v1` unless shown in full.

A few response shapes (CalDAV status, Stripe/Telnyx status, DocuSign status, payment-link result) come from service-layer dicts rather than a strict Pydantic response model — field names below are accurate to the service code but weren't double-checked against a schema class. Hit those specific endpoints once against the live backend before locking in a mobile TypeScript/Flow type for them.

---

## 1. AI Call / Receptionist configuration

Base path: `/api/v1/smartflow`. Schemas: `app/schemas/smartflow.py`. Routers: `app/api/v1/endpoints/smartflow/calls.py`, `ai_call_test.py`, `providers.py`, `calendar.py`.

```
GET /ai-call-settings
Auth: calls:view
Response: { assistant_name, voice_id, business_type, custom_instructions,
  greeting_inbound, greeting_outbound, closing_message,
  language_menu_enabled: bool, language_menu: [{...}], knowledge_base: str,
  transfer_number: str, voice_engine: "realtime"|"classic",
  require_meeting_approval: bool, require_approval_for_reschedules: bool,
  require_approval_for_cancellations: bool, sms_confirmations_enabled: bool,
  request_sms_events: [str], appointment_reminders_enabled: bool,
  appointment_reminder_hours_before: int, sms_wording: {...},
  cancellation_policy: str, call_routing_rules: [{...}],
  outbound_call_purposes: [{...}], ai_capabilities: {...},
  insurance_plans: [{...}], emergency_keywords: [str],
  emergency_response_mode: "take_message"|"direct_to_911",
  emergency_alert_phone: str }
Notes: Org-wide settings. PATCH accepts the same shape it returns.
```
```
PATCH /ai-call-settings
Auth: calls:manage
Request: all fields optional (PATCH = exclude_unset):
  assistant_name: str(<=60), voice_id: str(<=40), business_type: str(<=80),
  custom_instructions: str(<=2000), greeting_inbound/greeting_outbound/
  closing_message: str(<=500), language_menu_enabled: bool,
  language_menu: [LanguageMenuOption], knowledge_base: str(<=8000),
  transfer_number: str(<=32), voice_engine: "realtime"|"classic",
  require_meeting_approval/require_approval_for_reschedules/
  require_approval_for_cancellations/sms_confirmations_enabled: bool,
  request_sms_events: ["callback"|"quote"|"service_ticket"|"task"|"workflow"]
  (max 5), appointment_reminders_enabled: bool,
  appointment_reminder_hours_before: int(1-168), sms_wording: SmsWordingOverrides,
  cancellation_policy: str(<=500), call_routing_rules: [CallRoutingRule] (max 20),
  outbound_call_purposes: [OutboundCallPurpose] (max 20),
  ai_capabilities: AICapabilities, insurance_plans: [InsurancePlan] (max 50),
  emergency_keywords: [str] (max 20, each <=80),
  emergency_response_mode: "take_message"|"direct_to_911",
  emergency_alert_phone: str(<=32)
Response: same shape as GET (updated)
Notes: sending null on a free-text field resets it to the built-in translated
default. Free-text fields are control-char-stripped server-side.
```
```
POST /ai-call-settings/documents
Auth: calls:manage
Request: multipart/form-data, field "file" (knowledge-base document)
Response: { id/document_id, filename, extracted_text/preview,
  status: "pending_review" }
Notes: capped at MAX_DOCUMENT_BYTES (app.services.smartflow.receptionist_documents).
```
```
GET /ai-call-settings/documents/{document_id}
Auth: calls:view
Response: knowledge document detail (extracted text, approval state, filename)
```
```
PATCH /ai-call-settings/documents/{document_id}
Auth: calls:manage
Request: { approved: bool }
Response: updated knowledge document
Notes: there's no separate "/approve" route — this PATCH with approved=true is how approval happens.
```
```
DELETE /ai-call-settings/documents/{document_id}
Auth: calls:manage
Response: message "Document removed."
```
```
POST /ai-call-settings/test/start
Auth: calls:manage
Response: { session_id: str, greeting: str }
Notes: in-memory, non-persisted simulated conversation using the org's real
settings. Session TTL 30 min, 500 concurrent sessions max server-wide.
```
```
POST /ai-call-settings/test/{sessionId}/message
Auth: calls:manage
Request: { message: str (1-1000 chars) }
Response: { reply: str, ended: bool }
Notes: 404 (AI_CALL_TEST_SESSION_NOT_FOUND) if the session expired or isn't yours.
```
```
DELETE /ai-call-settings/test/{sessionId}
Auth: calls:manage
Response: message "Test AI conversation ended."
```
```
GET /locations
Auth: calls:view
Response: [{ id, name, address, capacity: int, working_days: [int 0-6],
  working_hours: {...}, active: bool }]
```
```
POST /locations
Auth: calls:manage (+ active subscription required)
Request: { name: str(1-100), address?: str(<=500), capacity: int(1-1000, default 1),
  working_days?: [int 0-6] (max 7), working_hours?: ProviderWorkingHours }
Response: created location
```
```
PATCH /locations/{location_id}
Auth: calls:manage (+ active subscription required)
Request: all optional: name, address, capacity, active: bool, working_days, working_hours
Response: updated location
```
```
DELETE /locations/{location_id}
Auth: calls:manage
Response: { deleted: true }
Notes: deactivates, does not hard-delete.
```
```
GET /providers
Auth: calls:view
Response: [{ id, name, role_title, linked_user_id, active, working_days,
  working_hours, location_ids: [str] }]
```
```
POST /providers
Auth: calls:manage (+ active subscription required)
Request: { name: str(1-80), role_title?: str(<=60), linked_user_id?: str,
  working_days?: [int 0-6] (max 7), working_hours?: ProviderWorkingHours,
  location_ids?: [str] (max 50) }
Response: created provider
```
```
PATCH /providers/{provider_id}
Auth: calls:manage (+ active subscription required)
Request: all optional: name, role_title, linked_user_id, active, working_days,
  working_hours, location_ids
Response: updated provider
```
```
DELETE /providers/{provider_id}
Auth: calls:manage
Response: { deleted: true }
```
```
GET /appointment-types
Auth: calls:view
Response: [{ id, name, duration_minutes, active, eligible_provider_ids: [str],
  eligible_location_ids: [str] }]
```
```
POST /appointment-types
Auth: calls:manage (+ active subscription required)
Request: { name: str(1-80), duration_minutes: int(5-480),
  eligible_provider_ids?: [str](max 50), eligible_location_ids?: [str](max 50) }
Response: created appointment type
Notes: empty/unset eligible_provider_ids means any provider can perform it.
```
```
PATCH /appointment-types/{type_id}
Auth: calls:manage (+ active subscription required)
Request: all optional: name, duration_minutes, active, eligible_provider_ids,
  eligible_location_ids
Response: updated appointment type
```
```
DELETE /appointment-types/{type_id}
Auth: calls:manage
Response: { deleted: true }
```
```
GET /calendar/business-hours
Auth: appointments:view
Response: { timezone: str, days: [int], start_hour: int, end_hour: int,
  slot_minutes: int, blocked_dates: [str "YYYY-MM-DD"], daily_breaks: [{...}] }
Notes: org-wide; used by the AI receptionist to offer meeting slots.
```
```
PUT /calendar/business-hours
Auth: appointments:edit
Request: all optional: timezone: str(<=64), days: [int] (0=Monday..6=Sunday),
  start_hour: int(0-23), end_hour: int(1-24), slot_minutes: int(15-240),
  blocked_dates: [str "YYYY-MM-DD"] (max 366), daily_breaks: [DailyBreak] (max 10)
Response: updated business hours object
Notes: days must be 0-6; blocked_dates must parse as YYYY-MM-DD, or you get a validation error.
```

---

## 2. AI Workflow (prompt-to-action)

Router: `app/api/v1/endpoints/smartflow/ai.py`.

```
POST /ai/workflow-prefill
Auth: ai_tools:use
Request: { transcript?: str, audio_url?: str, audio_base64?: str,
  audio_mime_type: str (default "audio/wav"), audio_filename: str (default "voice.wav"),
  response_mode: "text"|"audio"|"both" (default "both"), voice_id?: str,
  workflow_intent?: AIWorkflowIntent, current_values: dict (default {}) }
Response: AI-generated form-field prefill data (shape depends on workflow_intent)
```
```
GET /ai/history
Auth: ai_tools:use
Query: page=1, page_size=20 (max 100), search?, command_type?, status?,
  date_from?, date_to?, replayable_only: bool=false, group_by?
Response: paginated list of past AI command executions
```
```
POST /ai/history/{id}/replay
Auth: ai_tools:use (+ active subscription required)
Response: result of re-running the stored AI command
```
```
POST /ai/generate-image
Auth: ai_tools:use (+ active subscription required)
Request: { prompt: str (1-1000 chars) }
Response: generated image data (url/base64)
```

---

## 3. AI-call meeting requests

Router: `app/api/v1/endpoints/smartflow/call_meeting_requests.py`; provider settings in `calendar.py`.

```
GET /calls/meeting-requests
Auth: calls:view
Query: page=1, page_size=20 (max 100), status?
Response: paginated list of meeting requests the AI proposed to callers, awaiting approval
```
```
POST /calls/meeting-requests/{id}/accept
Auth: calls:manage
Response: confirmed meeting/calendar event data
```
```
POST /calls/meeting-requests/{id}/decline
Auth: calls:manage
Response: updated (declined) meeting request
```
```
GET /calendar/provider-settings
Auth: integrations:view
Response: { primary_provider: str, connected_providers: [str] }
Notes: which calendar (Google/Apple/Zoom) is the primary two-way sync target,
plus others connected link-only.
```
```
PUT /calendar/provider-settings
Auth: integrations:manage
Request: { provider?: str (<=32) }
Response: updated calendar provider settings
```

---

## 4. Admin panel

Base path: `/api/v1/dashboard/admin`. Router: `app/api/dashboard/admin.py`. Schemas: `app/schemas/dashboard_schemas.py`.

```
GET /summary
Auth: settings:view
Response: { stats: [{ label, value, trend?: float, description?: str }],
  recent_activity?: [dict] }
```
```
GET /users
Auth: users:view
Query: limit=10, offset=0, page?, search?, status? ("active"|"blocked")
Response: { items: [{ id, full_name, email, phone_no?, joined_date?,
  created_at?, status: "active"|"blocked"|"pending", role? }], total, limit, offset }
```
```
GET /users/{id}
Auth: users:view
Response: single user item (same shape as one item above)
```
```
PATCH /users/{id}/status
Auth: users:edit
Request: { status?: str } or { isBlocked|blocked: bool }
Response: bool (success)
Notes: resolves to "blocked" if isBlocked/blocked is truthy, else "active".
```
```
GET /users-growth
Auth: users:view
Response: { chart_data: [{ label, value }], total_count: int, growth_rate: float }
```
```
GET /earnings
Auth: earnings:view
Response: { today: float, this_month: float, total_revenue: float }
```
```
GET /earnings/transactions
Auth: earnings:view
Query: limit=10, offset=0
Response: { items: [{ id, full_name, trx_id, plan_name, price: float, date, status }],
  total, limit, offset }
```
```
GET /ai/stats
Auth: ai_logs:view
Response: { total_requests: int, success_rate: float, avg_response_time: float(sec),
  total_tokens_used: int, task_distribution: [dict], error_breakdown: [dict],
  usage_trend: [dict] }
```
```
GET /ai/logs
Auth: ai_logs:view
Response: [{ id, user_id, action, status, tokens_used: int, timestamp }]
```
```
GET /reports
Auth: reports:view
Query: limit=10, offset=0
Response: { items: [{ id, report_from, report_from_image?, reason, report_to,
  report_to_image?, date_time }], total, limit, offset }
```
```
GET /admins
Auth: admins:view
Response: [user items] where role in {"admin","super_admin"}
```
```
GET /chats
Auth: role must be one of super_admin, admin, owner, supervisor, staff (role-gated, not permission-slug gated)
Response: [{ id, user_name, avatar_url?, last_message, timestamp, unread_count: int }]
```
Notes: this and other role-gated admin routes check the literal role, not a permission slug — mobile must hold one of those exact roles.

---

## 5. CalDAV integration

Router: `app/api/v1/endpoints/smartflow/caldav.py`.

```
GET /integrations/caldav/status
Auth: integrations:view
Response: { connected: bool, username/account?, last_synced_at? }
```
```
POST /integrations/caldav/connect
Auth: integrations:manage
Request: { username: str (3-255), app_password: str (8-255), server_url?: str (<=255) }
Response: connection result (status/account info)
Notes: app_password is an app-specific password (e.g. Apple ID), not the account password.
```
```
POST /integrations/caldav/sync
Auth: integrations:manage
Response: sync result summary (counts of pulled changes)
```
```
DELETE /integrations/caldav
Auth: integrations:manage
Response: { disconnected: true }
```

---

## 6. Business email domain

Router: `app/api/v1/endpoints/smartflow/email_domains.py`.

```
GET /email-domain
Auth: integrations:view
Response: domain record (domain, status, dns_records, from_name, default_prefix), or null if none exists
```
```
GET /email-domain/availability
Auth: integrations:manage
Query: business_name: str (1-120, required)
Response: { available: bool, suggested_domain?: str }
```
```
POST /email-domain
Auth: integrations:manage
Request: { business_name?: str(<=120), custom_domain?: str(<=253),
  from_name?: str(<=100), default_prefix?: str(<=64) }
Response: created domain record
Notes: must supply business_name OR custom_domain, or you get a validation error.
```
```
POST /email-domain/verify
Auth: integrations:manage
Response: refreshed domain status (re-checks DNS)
```
```
PATCH /email-domain
Auth: integrations:manage
Request: { from_name?: str(<=100), default_prefix?: str(<=64) }
Response: updated domain settings
```
```
DELETE /email-domain
Auth: integrations:manage
Response: message "Business email domain removed successfully."
```

---

## 7. Telnyx self-service

Base path: `/api/v1/telnyx`. Router: `app/api/v1/endpoints/telnyx_provisioning.py`.

```
GET /status
Auth: calls:view
Response: { telnyx_setup_status: "none"|"provisioning"|"active"|..., telnyx_phone_number: str|null }
Notes: one number per organization, shared by the whole team.
```
```
POST /provision
Auth: calls:manage
Response: { telnyx_setup_status, telnyx_phone_number }
Notes: synchronously orders a voice-enabled number and attaches it to the shared
Call Control Application. If already provisioning, returns immediately with
telnyx_setup_status="provisioning" instead of double-ordering.
```
```
DELETE /release
Auth: calls:manage
Response: message "Telnyx number released."
```
```
POST /custom
Auth: calls:manage
Request: { api_key: str (min 10 chars), phone_number: str (min 7 chars) }
Response: result of validating + saving the BYO Telnyx credentials
Notes: api_key is validated against the live Telnyx API before saving.
```
```
DELETE /custom
Auth: calls:manage
Response: message "Custom Telnyx credentials removed."
```
Notes: every route under `/telnyx` requires the caller's organization_id to be set (422 NO_ORGANIZATION if not).

---

## 8. DocuSign connection

Router: `app/api/v1/endpoints/smartflow/agreements.py`.

```
GET /agreements/signature-providers/docusign/status
Auth: agreements:view
Response: { connected: bool, account_name?/email?, expires_at? }
```
```
GET /agreements/signature-providers/docusign/oauth/start
Auth: agreements:edit
Response: { oauth_url: str, state?: str }
Notes: redirect the user to oauth_url for DocuSign consent. A matching
/docusign/oauth/callback route exists but is browser-redirect-only — mobile
never calls it directly.
```

---

## 9. Stripe Connect for invoices

Routers: `app/api/v1/endpoints/stripe_connect.py` (`/api/v1/stripe/connect/*`), `app/api/v1/endpoints/invoices.py` (`/api/v1/invoices/*`).

```
GET /api/v1/stripe/connect/status
Auth: invoices:view
Response: { connected: bool, account_id?, charges_enabled?, payouts_enabled?, onboarding_complete? }
Notes: one Connect account per organization, shared across the team's invoices.
```
```
POST /api/v1/stripe/connect/onboard
Auth: invoices:edit
Response: { onboarding_url: str }
Notes: creates the org's Stripe Express account if missing, returns a fresh
Stripe-hosted onboarding link.
```
```
POST /api/v1/invoices/{id}/payment-link
Auth: invoices:edit (+ requires the "pro" plan feature)
Response: { url: str, expires_at?, invoice_id }
Notes: gated by the "pro" plan feature flag in addition to the permission —
confirm the test org has it before testing this one.
```
