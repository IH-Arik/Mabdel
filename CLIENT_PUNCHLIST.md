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

- [ ] **Inbound Call Routing — 3-ring-then-fallback-to-AI** — **SKIPPED for now**
  (user decision, 2026-08-25).
  Current behavior: no ring/wait concept exists at all — either an instant
  SIP bridge to a browser-registered team member, or the AI answers
  immediately. Investigated: the mobile app has **no mechanism to answer/join
  a live call today** — it only receives an informational push notification;
  no SIP/VoIP registration, no answer/accept/join endpoint
  (`app/api/v1/endpoints/calls.py`, `telnyx_web_voice_service.py`).
  Two ways to actually build this when picked back up:
  1. **(Recommended)** Forward inbound calls to the staff member's real phone
     number via Telnyx dial, ring ~15s (or client-specified), fall back to AI
     if unanswered — no mobile app changes needed.
  2. Build real in-app call answering — VoIP push + SIP registration + answer
     UI in the mobile app. Native app work, out of scope for a backend-only
     session; would take meaningfully longer.
  Revisit and pick an approach before implementing.

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

- [x] **Cross-organization direct messaging** — done, commit `48c7d60`.
  Found while answering the user's question about whether unrelated users
  could message each other on the website. Confirmed live: any two signed-up
  users, regardless of business/organization, could open a "direct"
  conversation and exchange messages — `create_conversation` took
  `member_ids` straight from the request with no organization check, and
  `_get_accessible_conversation`'s teammate-inbox path only checked whether a
  user id appeared in `member_ids`, not which business it belonged to. Fixed
  at both the write side (`ConversationService._assert_members_share_organization`)
  and read side (organization_id check in `_base.py`, defense in depth).
  Scoped to `type == "direct"` only — group chats use a separate contact-based
  membership path that was already fine.
  Also fixed: two pre-existing unrelated test failures
  (`test_bulk_messaging_api.py`, `test_settings_profile_api.py`) — see commit
  `796bcd7`. Suite is now 312/312 green in both fixed and randomized order.

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
