# Build Prompt — paste into an AI coding assistant

Use this with Claude Code, Cursor, or any repo-aware AI coding assistant, inside the `madbel-mobile` project. Copy the **base prompt** once, then append the **feature block** for whichever gap you're filling that session. Do one feature per session — don't batch multiple features into one prompt.

---

## Base prompt (use every time)

```
You're adding a missing screen to the madbel-mobile React Native app. This is a
feature-parity task: the equivalent feature already exists and works on the web
CRM ("Mabdel Website"), and the backend API for it is already live — you are
NOT building any backend code, only the mobile screen and its API wiring.

Before writing any code:
1. Read the website source file(s) I give you below under "Web reference" —
   treat it as the functional spec (what fields it sends, what it validates,
   what states it shows: loading, empty, error, success).
2. Open madbel-mobile/src/redux/slices/madbelApi/endpoints/smartflowEndpoints.js
   and confirm the hooks for the endpoints listed under "API contract" already
   exist. They're auto-generated from the backend's OpenAPI spec, so they
   should already be there — if one is missing, tell me before writing
   anything, don't hand-write a fetch call around it.
3. Look at an existing mobile screen that's structurally similar (I'll name one
   under "Closest existing mobile pattern") and match its folder location,
   naming convention, navigation registration, and component reuse. Don't
   introduce a new list-row/form-input/modal-sheet style if an existing shared
   one already does the job.

Then build the screen, wire it to the real hooks, and register it in the
relevant navigator. When you're done, tell me exactly what you built, which
existing components you reused vs. created, and anything from the web
behavior you intentionally left out or simplified for mobile — don't silently
drop a validation rule or an error state the web version has.

Feature for this session:
```

---

## Feature blocks — append one per session

### AI Call / Receptionist configuration
```
Feature: AI Call / Receptionist configuration
Web reference: Mabdel Website/src/pages/Profile/tabs/AIConfigTab.jsx, ReceptionistDocuments.jsx
API contract: see docs/mobile-gap-fill/02_API_REFERENCE.md, section "AI Call / Receptionist configuration"
Closest existing mobile pattern: ProfileScreen.js's tabbed settings layout
This is the largest item in the gap list — consider splitting it into sub-screens
(Locations, Providers, Appointment Types, Business Hours, Documents, Test Console)
under one entry point rather than one giant screen.
```

### AI Workflow (prompt-to-action)
```
Feature: AI Workflow (prompt-to-action)
Web reference: Mabdel Website/src/pages/AIWorkflow.jsx
API contract: see docs/mobile-gap-fill/02_API_REFERENCE.md, section "AI Workflow"
Closest existing mobile pattern: the existing MicConversationScreen.js for voice
input handling, and any existing list screen for the history/replay list.
```

### AI-call meeting requests
```
Feature: AI-call meeting requests
Web reference: inside Mabdel Website/src/pages/Calls.jsx and Calendar.jsx
API contract: see docs/mobile-gap-fill/02_API_REFERENCE.md, section "AI-call meeting requests"
Closest existing mobile pattern: add as one extra action/section inside the
existing Calls screen or Calendar screen — don't create a new stack for this.
```

### Admin panel
```
Feature: Admin panel (internal ops dashboard)
Web reference: Mabdel Website/src/pages/AdminPanel.jsx
API contract: see docs/mobile-gap-fill/02_API_REFERENCE.md, section "Admin panel"
Closest existing mobile pattern: none yet — this is a new stack, gated to admin
role only. Lower priority than the others; confirm with the team before
starting this one.
```

### CalDAV calendar integration
```
Feature: CalDAV calendar integration
Web reference: inside Mabdel Website/src/pages/Calendar.jsx
API contract: see docs/mobile-gap-fill/02_API_REFERENCE.md, section "CalDAV integration"
Closest existing mobile pattern: wherever mobile's calendar screen already
handles Google/Outlook connect — add CalDAV as a third provider option there.
```

### Business email domain management
```
Feature: Business email domain management
Web reference: Mabdel Website/src/components/BusinessEmailDomain.jsx
API contract: see docs/mobile-gap-fill/02_API_REFERENCE.md, section "Business email domain"
Closest existing mobile pattern: ProfileScreen.js's settings-card layout. Most
of the work is rendering DNS records + verification status clearly on a small
screen — keep the record list scrollable/copyable, don't try to cram it.
```

### Telnyx phone-number self-service
```
Feature: Telnyx phone-number self-service
Web reference: Mabdel Website/src/pages/Integrations.jsx, Mabdel Website/src/pages/Profile/tabs/AccountSettingsTab.jsx
API contract: see docs/mobile-gap-fill/02_API_REFERENCE.md, section "Telnyx self-service"
Closest existing mobile pattern: SocialIntegrationsScreen.js's connect/disconnect
card pattern — add a phone-number card using the same visual language.
```

### DocuSign e-signature connection
```
Feature: DocuSign e-signature connection
Web reference: used inside the Documents / agreements flow on the website
API contract: see docs/mobile-gap-fill/02_API_REFERENCE.md, section "DocuSign connection"
Closest existing mobile pattern: AgreementCreateScreen.js's signature step —
add DocuSign as an alternate option alongside in-app signing.
```

### Stripe Connect for customer invoice payments
```
Feature: Stripe Connect for customer invoice payments
Web reference: inside Mabdel Website/src/pages/Invoices.jsx
API contract: see docs/mobile-gap-fill/02_API_REFERENCE.md, section "Stripe Connect for invoices"
Closest existing mobile pattern: mobile's existing invoice list/detail screen —
add a connect-status banner/action, matching how Telnyx/social connect status
is shown elsewhere in the app.
```
