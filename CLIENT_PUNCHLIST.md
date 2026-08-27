# Client Punch List — AI Calling & Platform Fixes

Tracking sheet for the client meeting recap items, worked one at a time on
`need-verification` (synced to `master` after each item). Last updated: 2026-08-25.

## AI Calling

- [x] **Response Latency** — done, commit `a720ac3`.
  Root causes: (1) Whisper transcription called without `await`, blocking the
  event loop for every concurrent call; (2) TTS waited for the full OpenAI
  clip before sending any audio to the caller. Fixed with `asyncio.to_thread`
  and a streaming TTS pipeline (`synthesize_speech_stream` +
  `_stream_pcm_to_telnyx` in `ai_phone_agent.py`). Also trimmed silence
  threshold 750ms -> 600ms.

- [x] **Time-slot offering logic** — done, commit `b7cea08`.
  Fixed: (1) AI was offering/booking already-passed times on the current day
  (no comparison against "now"); (2) `find_next_available_slot` used the
  server's local `date.today()` instead of the business's own timezone,
  wrong near UTC day boundaries. Fixed via `CalendarService._now(tz)`.
  Also raised `MAX_SLOT_OFFERS` 3 -> 5 per user request.
  Declined-slot handling (re-offer avoidance, graceful give-up) was checked
  and already worked correctly — no change needed there.

- [x] **Inbound Call Routing — 3-ring-then-fallback-to-AI (BROWSER side)** — done,
  commit `d9d8464`. Originally skipped 2026-08-25 (see below for the mobile-app
  side, still not done), revisited after diagnosing why the live Messenger-style
  incoming-call popup never appeared for a browser-registered team member.
  **Root cause:** `_handle_incoming_call` answered the inbound call and
  immediately `transfer_call`'d it — audio bridged through instantly with no
  ring window at all, so the WebRTC client's `telnyx.notification` event (what
  `IncomingCallOverlay` listens for) never fired. The persisted notification
  record (bell icon) was always created separately, which is why that showed
  up while the live popup never did.
  **Fix:** `transfer_call`'s own `timeout_secs` was ruled out — per the Telnyx
  SDK docstring, an unanswered transfer hangs up the ORIGINAL call on timeout,
  making an AI fallback impossible. Implemented via dial-then-bridge instead:
  `CallService.ring_browser` dials a fresh, independent leg to the team
  member's SIP identity (own `timeout_secs`, ~18s / 3-4 rings) while leaving
  the original inbound call untouched/unanswered; on `call.answered` for that
  leg, `CallService.bridge_calls` bridges it in; on timeout/decline
  (`call.hangup`), the original call falls back to AI exactly like the
  no-registration path already did; if the caller abandons the call while the
  browser is still ringing, the ring leg is hung up too instead of left ringing.
  **Operational precondition, confirmed live in production DB while
  diagnosing this:** the browser only gets rung at all if it has an *active*
  `voice_device_registrations` entry at the moment the call arrives (heartbeat
  every 60s, 600s TTL) — every entry in the DB was expired when this was
  checked, meaning the tab wasn't open/foregrounded with a live connection at
  call time. This fix does nothing if that's the case; it only fixes the "no
  ring window" bug, not "browser must actually be open and registered."
  **Not tested against a real live Telnyx call** (backend session, no way to
  place one) — verified via the full test suite (14 tests touching this path,
  4 new + 1 rewritten covering ring/bridge/timeout-fallback/caller-abandons,
  each confirmed to fail when the underlying fix is reverted) and by reading
  the Telnyx SDK's own parameter docstrings for `dial`/`bridge`/`transfer`
  timeout semantics. **Recommend a real test call before relying on this in
  production.**
  **Follow-up fix, commit `b94001c`:** user tested live and the popup still
  didn't appear. Diagnosed via production DB: the browser's registration kept
  flipping to `active:false` within minutes even with the tab confirmed
  foregrounded the whole time — a genuine, self-inflicted WebRTC reconnect
  loop in `TelnyxVoiceContext.jsx`, unrelated to this feature itself.
  `initClient()` disconnects the client it's replacing (on the ~20h scheduled
  token refresh, or any reconnect), but the OLD client's own
  `telnyx.socket.close` handler didn't know it had been intentionally
  superseded — every disconnect re-triggered itself via a stale handler,
  producing a permanent connect→replace→stale-close→reconnect loop from the
  very first scheduled refresh. Fixed with a generation counter so each
  client's handlers only react if they're still the current one. No frontend
  test suite exists in this repo, so this could only be verified via lint
  (clean, confirmed pre-existing issues are unrelated via `git stash`) and a
  clean build — **ask the user to confirm the popup now actually appears on
  a real call** before considering this fully closed.
  **Mobile app side still not built** — same gap as before: no
  answer/accept/join mechanism exists on the app at all, it only receives an
  informational push notification, no SIP/VoIP registration
  (`app/api/v1/endpoints/calls.py`, `telnyx_web_voice_service.py`). Two ways
  to build this when picked back up: (1) forward inbound calls to the staff
  member's real phone number via Telnyx dial (no app changes needed,
  recommended), or (2) real in-app VoIP push + SIP registration + answer UI
  (native app work, meaningfully bigger).

- [x] **Dynamic Customization — dedicated "Business Type" field** — done, commit `9174003`.
  Added `business_type` to `organizations.ai_call_settings` (alongside
  `assistant_name`, `voice_id`, etc.), a matching Pydantic field on
  `AICallSettingsResponse`/`AICallSettingsUpdateRequest` (80 char cap, same
  control-character stripping as the other free-text fields), and wired it
  into the live call prompt as a `VERIFIED BUSINESS FACTS` line (not the
  untrusted owner-preferences block — same trust level as the existing
  industry/hours/address facts). Frontend: curated dropdown in the AI Config
  tab (`AIConfigTab.jsx`) with an "Other" free-text fallback.

## Security fixes (found during testing, not in original client list)

- [x] **Cross-organization direct messaging** — done, commits `48c7d60`, `a0b4d69`.
  Found while answering the user's question about whether unrelated users
  could message each other on the website. Confirmed live: any two signed-up
  users, regardless of business/organization, could open a "direct"
  conversation and exchange messages — `create_conversation` took
  `member_ids` straight from the request with no organization check, and
  `_get_accessible_conversation`'s teammate-inbox path only checked whether a
  user id appeared in `member_ids`, not which business it belonged to.
  Final rule (per user clarification, `a0b4d69`): a same-organization
  colleague is always reachable; a user on a *different* organization is
  reachable only if the caller has saved them as a contact (matched by
  email) — never a total stranger picked by raw user id. Fixed at both the
  write side (`ConversationService._assert_members_share_organization`) and
  read side (organization_id check in `_base.py`, defense in depth). Scoped
  to `type == "direct"` only — group chats use a separate contact-based
  membership path that was already fine.
  Also fixed: two pre-existing unrelated test failures
  (`test_bulk_messaging_api.py`, `test_settings_profile_api.py`) — see commit
  `796bcd7`. Suite is now 313/313 green in both fixed and randomized order.

- [x] **Team messaging UI bugs (3, reported live from the Messages page)** — done,
  commit `aacc3f7`, RBAC re-seeded against production DB.
  1. Chat bubbles for both people in a "direct" conversation rendered on the same
     side — `_resolve_message_sender` used the message's `direction` field (fixed
     at creation time from the original sender's POV) instead of resolving
     `is_self` against the current viewer. Now compares `sender_user_id` (always
     the real sender) to the viewer directly for non-customer conversations.
  2. Conversation sidebar showed the wrong person's name — `contact_name` fell
     back to the conversation's stored `title`, set once at creation from the
     creator's own POV and never recomputed per viewer. Now resolves the OTHER
     member's real name relative to whoever is viewing it (batched to avoid N+1).
  3. Owner got "contact your administrator" trying to delete a conversation —
     `messages:delete` was never defined in `scripts/seed_rbac.py` at all, so no
     role in the system had it. Added and granted to owner only (not
     manager/staff/assistant). **Required a manual `python scripts/seed_rbac.py`
     run against the production DB** (RBAC roles aren't re-seeded automatically
     on deploy) — done, owner's permission count went 45 -> 46.
  Suite is 316/316 green in both fixed and randomized order.

- [x] **Bubble side still wrong live + dead dashboard button** — done, commit `43eb0b7`.
  1. The `aacc3f7` fix only corrected the GET /messages history fetch. Live/realtime
     messages still rendered on the same side for both people because
     `create_message`'s WebSocket push serialized the message ONCE (from the
     sender's own point of view) and broadcast that identical payload to every
     connected socket. Added `RealtimeHub.publish_per_viewer` (re-serializes once
     per connected viewer, keyed by the user_id already tracked per socket) and
     switched all `message.created`/`message.updated` publishes to use it.
  2. "Owner/Manager Dashboard" sidebar button opened an unreachable localhost tab
     for every real visitor — `VITE_DASHBOARD_URL` was documented in
     `.env.example` but never actually configured for the production build.
     Changed the code fallback to the real production URL (confirmed with user:
     `https://gocustify.com/onwer-dashboard`). **Note: this is a frontend-only
     fix — it needs the Website's Vercel deploy to pick up this commit; unlike
     the backend, there's no GitHub Actions workflow for it in this repo, so
     confirm it actually redeployed (Vercel usually auto-deploys on push to the
     connected branch, but verify).**
  Suite is 317/317 green in both fixed and randomized order.

- [x] **Bulk SMS via Telnyx not working** — done, commit `b7e8114`.
  Two bugs in `CallService.send_sms`, both real and independent:
  1. Always sent from the single global `settings.TELNYX_PHONE_NUMBER` — no
     per-org resolution at all, unlike voice calls which already resolve each
     business's own provisioned number. Added `from_number` param + a
     `_resolve_org_sms_from_number` helper (`_base.py`) reusing the same
     `TelnyxProvisioningService.get_org_phone_number` voice already uses.
  2. Reused the voice validator, which hard-required `TELNYX_VOICE_APPLICATION_ID`
     — a setting SMS never touches. Split out `_validate_telnyx_sms_config`
     (only checks `TELNYX_API_KEY`/`TELNYX_PHONE_NUMBER`).
  The real Telnyx `client.messages.send()` call had **zero test coverage**
  before this — every existing bulk SMS test mocked `send_sms` entirely.
  **Known related issue, not fixed (out of scope for this pass):**
  `app/services/calendar_service.py:75` (appointment SMS reminders, a
  different/older calendar system than the smartflow one) has the exact same
  "always uses the global number" bug — not reported by the client yet, but
  will hit the same wall if/when appointment SMS reminders are used for a
  business with its own provisioned number.
  Suite is 319/319 green in both fixed and randomized order.

- [x] **Bulk SMS still showed "failed" after the above** — diagnosed, commit `2685ffe`.
  **Root cause is a Telnyx account limit, not a code defect.** Reproduced the
  real error by calling `send_sms` directly: Telnyx returns
  **40306 "Alpha sender not configured"**. Queried the Telnyx API to confirm
  why — the account's numbers are US longcodes with:
  `sms features: domestic_two_way=True, international_outbound=False`.
  The test recipient was `+880…` (Bangladesh), so the send is *international
  outbound*, which those numbers can't do; Telnyx then falls back to looking for
  an alphanumeric sender ID, finds none, and returns that confusing 40306.
  Config itself is correct — both numbers ARE assigned to the configured
  messaging profile `40019fbe-…`.
  **To actually send to Bangladesh/international numbers, action is needed in
  the Telnyx portal (not in this repo):** enable international outbound on the
  number/messaging profile, which Telnyx gates behind approval, and note many
  destination countries additionally require A2P sender pre-registration.
  Sending to US numbers should work as-is.
  Code fix shipped alongside: failed deliveries recorded only our generic
  wrapper text because `AppException.__str__` drops the `details` payload — the
  provider's real reason never reached the UI, which is why this showed as a
  bare "failed". `_delivery_error_text` now appends it (email + SMS branches).
  Suite is 320/320 green in both fixed and randomized order.

- [x] **Telnyx number provisioning UI shown to every role** — done, commit `8e1c58f`.
  User's request: only the owner should provision the platform number (and only
  once — no risk of a second number getting ordered), and non-owners should
  only see/use it if the owner explicitly grants `calls:manage` via RBAC.
  Investigated first (not assumed): backend was already fully safe —
  `TelnyxProvisioningService.provision_organization` is idempotent (no-ops
  once `telnyx_setup_status == "active"`, confirmed by reading the code) and
  every mutating endpoint already required `calls:manage`. The gap was
  frontend-only: `AccountSettingsTab.jsx` showed the "Re-run Provision Check"
  button and Custom Telnyx (BYO API key/number) form to every role, relying
  on a 403 after the click. Fixed by adding a `permissions` field to
  `/auth/me` (previously only ever returned role/primary_role) and gating
  those two UI blocks on `calls:manage` — read-only status text stays visible
  to everyone, matching the backend's own `calls:view` gate on
  `GET /telnyx/status`.
  Suite is 324/324 green in both fixed and randomized order (one transient,
  unrelated flake on a first fixed-order run, passed clean on both a
  standalone re-run and a full re-run).
  **Follow-up, commit `277a9d0`:** user specifically re-confirmed the
  "only ever one number per business" guarantee, so added a dedicated
  regression test (`test_reprovisioning_an_already_active_number_never_orders_a_second_one`)
  clicking provision 3x and asserting Telnyx's `number_orders.create` fires
  exactly once. The underlying guard already existed and was correct
  (`telnyx_setup_status == "active"` short-circuit) — this was previously
  untested; confirmed the new test actually catches a regression by
  reverting the guard first. Suite now 325/325.

- [x] **Incoming-call popup missing Reject/Transfer-to-AI, and Reject went to AI
  anyway** — done, commit `7d461fd`.
  Popup only ever had Accept/Reject. A `transferToAi` function already existed
  in `TelnyxVoiceContext.jsx` but was **completely dead code** — never exposed
  through the context or wired to any button (its own lint warning flagged
  this: "unused variable"). Added the third button + wired it end-to-end.
  **User-confirmed behavior rule while fixing this:** Reject = neither the
  human nor the AI picks up. Only a genuine ring TIMEOUT falls back to AI.
  This required a real backend fix — `_handle_browser_ring_hangup` previously
  answered the original call into AI on ANY hangup of the ring leg
  (reject and timeout both funneled into the same fallback). Now checks
  `hangup_cause == "timeout"` specifically; anything else (explicit decline)
  just ends the original call, no AI.
  Transfer-to-AI needed new backend support too: it fires against the RING
  LEG's call_sid (unanswered, still ringing) — the pre-existing
  `transfer_to_ai` action only worked via `start_streaming` on an
  already-answered call. `call_action` now detects a tracked ring leg and
  answers the ORIGINAL call into AI immediately instead, without waiting out
  `BROWSER_RING_TIMEOUT_SECONDS`.
  3 new regression tests (timeout still falls back, explicit reject does
  NOT, explicit Transfer-to-AI hands off immediately), each confirmed to
  fail when its underlying fix is reverted. Suite 327/327 green in both
  fixed and randomized order.

- [x] **Invoice share-link feature wired up** — done, commit `e382aa1`.
  Found during a backend-vs-frontend audit (user asked to check for backend
  capabilities with no frontend caller). `POST /invoices/{id}/share` and
  `GET /invoices/shared/{token}/pdf` were fully built and already tested
  backend-side (a public, login-free view/download link — distinct from
  "Send", which only emails the client) but `shareInvoice` in `services.js`
  had zero callers anywhere and no UI could generate/show the link. Added a
  "Create/Copy Share Link" button on the invoice detail panel, mirroring the
  existing "Copy Payment Link" button's exact pattern (generate once, cache
  via `share_url` on the invoice, copy to clipboard). Frontend-only change;
  backend already had test coverage (`test_invoice_api.py`), confirmed still
  passing. Verified via lint (clean) and build (green) — no frontend test
  suite exists in this repo.
  **Other gaps found in the same audit, not yet acted on:** meeting-request
  confirmation email link has no landing page (raw JSON instead of a styled
  page); CalDAV has connect/disconnect but no manual "Sync now"; agreement
  and lease public signing pages have no PDF download link; document
  rename/edit endpoint exists with no UI; AI email-draft endpoint has no
  compose UI anywhere. Also: `app/api/v1/endpoints/subscription.py` isn't
  even mounted in the router — fully unreachable dead code, worth a decision
  (delete vs wire up) independent of anything client-facing.

## Other client items (not yet scheduled)

From the original meeting recap, not yet picked up:
- Stripe OAuth redirect fix
- "Pay Now" button → Stripe checkout redirect
- Privacy Policy / Terms links for Stripe compliance
- Outlook Mail integration
- Meta/WhatsApp/Facebook/Instagram credential setup
- Apple/Zoho Calendar integration
- Call-recording-download XML error fix
- Bulk Messaging group-email-population bug

## Workflow reminder

- Fix items **one at a time**, in the order above.
- Commit + push to both `need-verification` and `master` after each item
  (auto-deploys) — client is on a tight deadline.
- New regression tests for each fix: write them, confirm they fail against
  the reverted bug, then confirm they pass with the fix restored, before
  moving to the next item.
