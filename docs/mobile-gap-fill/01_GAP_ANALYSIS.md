# Mobile Feature Gap Analysis

What exists on the Website (web CRM) that does **not** exist yet in `madbel-mobile`. Subscription/billing-plan management is intentionally excluded — not in scope for this pass.

Every feature below already has a **working, live backend**. This is mobile-UI work only, not backend work. See `02_API_REFERENCE.md` for exact request/response contracts.

Legend: **Size** = rough effort based on how much code the equivalent web feature took.

---

## AI tools

### 1. AI Call / Receptionist configuration — Size: Large
Configure the AI phone receptionist: business locations, service providers, appointment types, business hours, upload/approve the "knowledge" documents the AI reads from, and a live chat console to test the AI call agent before going live.

- Website reference: `Mabdel Website/src/pages/Profile/tabs/AIConfigTab.jsx` (1,951 lines) + `ReceptionistDocuments.jsx`
- Why it matters: this is the single biggest settings surface in the whole product. Businesses can't fully configure their AI receptionist from mobile at all right now.

### 2. AI Workflow (prompt-to-action) — Size: Medium
A universal AI command bar: type, dictate, or describe an image request, and the AI pre-fills a real action (create event, lease, message, etc.). Includes history of past runs with a replay button.

- Website reference: `Mabdel Website/src/pages/AIWorkflow.jsx` (319 lines)
- Mobile already has voice/chat screens, but nothing like this "universal command bar + history" screen.

### 3. AI-call meeting requests — Size: Small
Accept or decline a meeting time the AI receptionist proposed to a caller mid-call.

- Website reference: used inside `Calls.jsx` / `Calendar.jsx`
- Could be added as one extra action inside mobile's existing Calls or Calendar screen — doesn't need its own stack.

---

## Admin / Team

### 4. Admin panel (internal ops dashboard) — Size: Medium
Internal super-admin view: user growth, earnings/transactions, AI usage stats and logs, abuse reports, admin list, chat oversight. Not a customer-facing feature — used by Mabdel's own team, not business owners.

- Website reference: `Mabdel Website/src/pages/AdminPanel.jsx` (89 lines + several chart components)
- Lower priority than the others — internal tool, not something a business customer needs on their phone.

---

## Settings / Integrations

### 5. CalDAV calendar integration — Size: Small
Connect, sync, or disconnect a generic CalDAV calendar (iCloud, Nextcloud, etc.) alongside Google/Outlook.

- Website reference: inside `Mabdel Website/src/pages/Calendar.jsx`

### 6. Business email domain management — Size: Large
Claim and verify a custom sending domain (DNS records, verification status) used for outbound email — invoices, bulk email, etc.

- Website reference: `Mabdel Website/src/components/BusinessEmailDomain.jsx` (692 lines)
- Most of the effort here is the DNS-record + verification-status UI, not the API calls themselves.

### 7. Telnyx phone-number self-service — Size: Medium
Provision a new AI-call phone number, bring your own (custom) Telnyx number, or release one.

- Website reference: `Mabdel Website/src/pages/Integrations.jsx` (status display) + `Mabdel Website/src/pages/Profile/tabs/AccountSettingsTab.jsx` (provisioning actions)
- Mobile's `SocialIntegrationsScreen.js` only covers social/messaging platforms today — phone number lifecycle is a separate concern.

### 8. DocuSign e-signature connection — Size: Small
Connect DocuSign as an alternative signature provider to the in-app signing flow, with OAuth connect status.

- Website reference: used inside the Documents / agreements flow
- Mobile's agreement screens use only the in-app sign flow — fine unless a specific client needs DocuSign.

### 9. Stripe Connect for customer invoice payments — Size: Small
The business connects its own Stripe account so **its customers'** invoices carry a working payment link. This is a CRM feature for getting paid by customers, distinct from the business's own subscription (which stays out of scope).

- Website reference: inside `Mabdel Website/src/pages/Invoices.jsx`
- Mobile shows invoices but has no onboarding/status UI — customers may currently get invoices with no payment link.

---

## Already covered on mobile — do not rebuild

Contacts, Groups/Community, Calendar & Meetings, Bulk Messaging, Invoices (list/view), Leases, Agreements (in-app signing), Chat/Unified Conversations, Calls, Notifications, Create Post, basic Social Integrations, and most Profile tabs already have a working mobile screen with solid parity to the website.

## Explicitly out of scope

All subscription / billing-plan management: `Subscription.jsx`, `ProfileSubscriptionScreen.js`, and the `subscription/*` endpoints (plans, current tier, upgrade/downgrade).
