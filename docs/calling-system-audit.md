# Calling System Audit

Date: 2026-08-18
Workspace: `C:\Project`

## Scope

This review covers the current calling-related implementation across:

- `Mabdel Backend`
- `Mabdel Website`
- `madbel-mobile`

## Executive Summary

The calling system is partially implemented end-to-end, but there are several gaps between what the UI suggests and what the backend actually supports. The biggest issues are:

- Website incoming-call receiving depends too heavily on live Telnyx registration and has no strong fallback.
- Voice Assistant detects `call` intent, but the workflow cannot actually open or complete a call flow from the website voice UI.
- AI phone calling is intentionally limited, so business explanation and meeting scheduling do not behave like a full receptionist workflow.
- Mobile "accept call" is not a real in-app telephony implementation.
- There is at least one high-severity auth/security issue in call action handling.

## Problems Found

### 1. High: Unauthenticated call action endpoint trusts `user_id`

Problem:

- `POST /api/v1/calls/{call_sid}/action` does not use normal authenticated user resolution and trusts `user_id` from the request body.
- This means call control behavior can be driven by caller-provided data instead of server-side identity.

References:

- `Mabdel Backend/app/api/v1/endpoints/calls.py:40`
- `madbel-mobile/src/redux/slices/madbelApi/endpoints/smartflowEndpoints.js:1388`

Impact:

- Potential unauthorized call control.
- Cross-user/team call actions may be possible if request data is manipulated.

### 2. High: Website incoming call popup is not reliable

Problem:

- The website overlay depends on live Telnyx voice context state instead of also using persisted notifications as a fallback.
- If socket/registration state drops, the user may get no usable incoming-call UI even though the backend recorded the event.

References:

- `Mabdel Website/src/layouts/MainLayout.jsx:80`
- `Mabdel Website/src/context/TelnyxVoiceContext.jsx:275`
- `Mabdel Backend/app/api/v1/endpoints/calls.py:190`

Impact:

- User reports "call pop-up does not appear" are consistent with the current implementation.
- Calls can arrive in backend history/notifications without a usable accept UI in the website.

### 3. High: Browser registration TTL is too short, causing AI fallback instead of website ringing

Problem:

- Web voice registration TTL is only 180 seconds.
- When that registration expires or the browser is no longer actively registered, incoming calls fall back to AI instead of the website client.

References:

- `Mabdel Backend/app/services/telnyx_web_voice_service.py:20`
- `Mabdel Backend/app/api/v1/endpoints/calls.py:200`

Impact:

- Website call receiving appears inconsistent.
- Users can think "website receive system is broken" even though the backend is intentionally falling back.

### 4. High: Voice Assistant `call` workflow is advertised but not actually implemented in website workflow execution

Problem:

- The voice assistant can detect `call` intent.
- The backend also supports `call` as a workflow intent and exposes `/api/v1/smartflow/calls/outbound`.
- But the website voice conversation page has no `call` destination in `getWorkflowDestination()`.
- When the user confirms the workflow, the UI throws the fallback message: `I could not prepare that workflow form yet.`

References:

- `Mabdel Website/src/utils/voiceAgentConfig.js:732`
- `Mabdel Website/src/utils/voiceAgentConfig.js:742`
- `Mabdel Website/src/pages/VoiceConversation.jsx:118`
- `Mabdel Website/src/pages/VoiceConversation.jsx:281`
- `Mabdel Website/src/i18n/translations.js:1174`
- `Mabdel Backend/app/services/smartflow/workflow_service.py:70`
- `Mabdel Backend/app/services/smartflow/_base.py:4137`
- `Mabdel Backend/app/api/v1/endpoints/smartflow/calls.py:46`

Impact:

- Exactly matches the user-reported Voice Assistant issue.
- The product suggests call automation support that the voice UI cannot actually complete.

### 5. High: Backend `call` workflow support is incomplete at the prefill level

Problem:

- `call` is included in workflow validation, required fields, and create config.
- But `_build_workflow_prefill()` does not have a dedicated `call` branch like invoice, calendar, lease, agreement, or contact.
- So `phone_number` and call-specific fields are not robustly prepared from natural language.

References:

- `Mabdel Backend/app/services/smartflow/workflow_service.py:70`
- `Mabdel Backend/app/services/smartflow/_base.py:3739`
- `Mabdel Backend/app/services/smartflow/_base.py:3998`
- `Mabdel Backend/app/services/smartflow/_base.py:4043`
- `Mabdel Backend/app/services/smartflow/_base.py:4119`
- `Mabdel Backend/app/services/smartflow/_base.py:4137`

Impact:

- Even if frontend call workflow routing is added, the backend still needs call-specific extraction logic for a smooth AI call initiation flow.

### 6. High: Mobile "accept call" is not a real in-app telephony implementation

Problem:

- Mobile incoming call accept appears to navigate to an active-call screen, but the app does not include a real Telnyx/WebRTC/CallKeep-style receiving stack.
- Backend `receive` action transfers/reroutes at provider level rather than connecting an actual in-app media session.

References:

- `madbel-mobile/src/screens/call/IncomingCallScreen.js:47`
- `madbel-mobile/package.json:1`

Impact:

- The user can see a UI flow but not a true mobile answer-call experience.
- "Call dorar system" on mobile is not fully implemented.

### 7. Medium: Live transcript ownership mismatch for team-routed incoming calls

Problem:

- Incoming calls may be logged under one user/team context while live transcript lookups use exact current-user matching.
- This can break transcript visibility for the staff member who actually handled the call.

References:

- `Mabdel Backend/app/api/v1/endpoints/calls.py:169`
- `Mabdel Backend/app/api/v1/endpoints/calls.py:316`

Impact:

- Team members may not see the live transcript they expect during or after call handling.

### 8. Medium: Mobile transcript API usage is inconsistent with backend ID expectations

Problem:

- One mobile transcript path uses provider `callSid`-style behavior while backend route expects the internal call-log ID.
- Another mobile flow uses the live SID transcript route but marks it `skipAuth: true` even though the backend expects auth.

References:

- `madbel-mobile/src/screens/call/ActiveCallScreen.js:38`
- `madbel-mobile/src/redux/slices/madbelApi/endpoints/smartflowEndpoints.js:838`
- `madbel-mobile/src/screens/call/AiCallScreen.js:40`
- `Mabdel Backend/app/api/v1/endpoints/calls.py:316`

Impact:

- Transcript loading can fail or behave inconsistently on mobile.

### 9. Medium: Webhook-created call logs are missing stable timestamps used by history sorting/display

Problem:

- Some call log creation paths do not set the same `timestamp` field used by history sorting and display helpers.
- Later history serialization relies on `timestamp`.

References:

- `Mabdel Backend/app/api/v1/endpoints/calls.py:174`
- `Mabdel Backend/app/api/v1/endpoints/calls.py:230`
- `Mabdel Backend/app/services/smartflow/call_history_service.py:61`
- `Mabdel Backend/app/services/smartflow/_base.py:457`

Impact:

- Call history ordering and time labels can be inconsistent or wrong.

### 10. Medium: Callback queue backend exists, but website callback UI is wired to outbound browser calling instead

Problem:

- Backend supports a callback request flow.
- Website callback button currently behaves like direct outbound calling instead of using the callback queue endpoint.

References:

- `Mabdel Backend/app/api/v1/endpoints/smartflow/calls.py:129`
- `Mabdel Backend/app/services/smartflow/call_history_service.py:254`
- `Mabdel Website/src/pages/Calls.jsx:609`
- `Mabdel Website/src/api/services.js:69`

Impact:

- UI behavior does not match backend feature intent.
- Callback workflow is effectively missing from website UX.

### 11. Medium: AI phone agent is intentionally narrower than the expected receptionist behavior

Problem:

- The AI phone agent is designed mainly for conversation and meeting handoff rather than broad business workflow execution.
- It explicitly steers unsupported requests toward human follow-up.

References:

- `Mabdel Backend/app/services/ai_phone_agent.py:104`
- `Mabdel Backend/app/services/ai_phone_agent.py:397`

Impact:

- User expectation that AI should fully explain business processes or perform all assistant actions is not matched by current implementation.

### 12. Medium: Meeting scheduling flow is fragile in multi-turn AI call conversations

Problem:

- In the phone agent state machine, entering scheduling flow depends too much on scheduling keywords.
- A caller saying "yes" after AI offers scheduling may not reliably transition into scheduling state.

References:

- `Mabdel Backend/app/services/ai_phone_agent.py:256`

Impact:

- User reports that scheduling is not working properly are consistent with the current logic.

### 13. Medium: AI phone scheduling creates a pending request, not an immediately booked meeting

Problem:

- The phone scheduling path creates a meeting request first.
- Calendar booking only happens later on acceptance/approval.

References:

- `Mabdel Backend/app/services/smartflow/call_meeting_request_service.py:45`
- `Mabdel Backend/app/services/smartflow/call_meeting_request_service.py:122`

Impact:

- Product behavior may look broken to users expecting direct instant scheduling.

### 14. Medium: Bengali is not truly supported in AI call phrase logic

Problem:

- Bengali intentionally falls back to English behavior in call phrase handling.
- Language-sensitive keyword matching for call flows is therefore weaker for Bangla conversations.

References:

- `Mabdel Backend/app/services/call_phrases.py:1`
- `Mabdel Backend/app/services/call_phrases.py:295`

Impact:

- Bangla callers may experience lower intent accuracy and less reliable conversational control.

### 15. Medium: AI explanation quality depends heavily on business profile data being present

Problem:

- Business explanation responses pull from configured business profile and business hours data.
- If those records are incomplete, AI explanations become weak or generic.

References:

- `Mabdel Backend/app/services/ai_phone_agent.py:168`

Impact:

- "AI normal system moto explain kore na" can be caused partly by missing organization/business-profile setup, not only by prompt quality.

### 16. Low: Websocket media-stream tests are stale and no longer match current implementation

Problem:

- Tests expect acknowledgements and event behavior that the current handler does not implement.

References:

- `Mabdel Backend/app/tests/test_calls_api.py:162`
- `Mabdel Backend/app/api/v1/endpoints/calls.py:397`

Impact:

- Test coverage is not reliably protecting real calling behavior.

### 17. Low: Website `AiCall` page is not a real phone-calling page

Problem:

- The website AI call page behaves like mic-to-AI voice chat, not actual telephony call handling.

References:

- `Mabdel Website/src/pages/AiCall.jsx:44`

Impact:

- Product naming can mislead users into expecting a real phone call workflow there.

## What Is Implemented Already

- Backend outbound calling endpoint exists: `POST /api/v1/smartflow/calls/outbound`
- Website contacts page can place a real outbound call through platform telephony.
- Backend AI workflow prefill system exists and already advertises `call` as a supported intent.
- Backend callback queue logic exists.

## What Is Missing

- Website voice assistant `call` workflow destination and execution flow.
- Backend dedicated `call` prefill logic with reliable number/contact extraction.
- Notification-based or persistent fallback for website incoming-call popup.
- Strong browser registration refresh/recovery strategy for web receiving.
- True in-app mobile incoming-call media handling.
- Robust AI phone scheduling handoff and confirmation flow.
- Better Bangla-aware phone-call intent/phrase handling.

## Verification Notes

- Code review was done by reading implementation across backend, website, and mobile.
- Automated backend tests were not executed because `pytest` was not available in the current shell environment during review.
