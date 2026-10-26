# GoCustify Website — Page-by-Page Feature List (verified live)

Scope: the customer web app in `Mabdel Website/` (React + Vite). It does not cover the Owner/Team Dashboard (`madbel-dashboard/`) or the mobile app.
Verified: 21 Sep 2026.

**How this was verified**
Every route (15 public, 19 signed-in) was opened in a real browser (Microsoft Edge, 1440 px wide) against the running site, signed in as the account owner. Tabs, side panels, modals, forms and detail views were then opened on the main pages, and each screen was compared with what this document says.
To protect real data, every save, send, delete and connect request was blocked during the check. So **submit and delivery flows were not exercised**: saving, sending email/SMS, phone calls, microphone input, OAuth connects (Google, Meta, Zoom, Zoho, Microsoft), Stripe and DocuSign. Those are described from the code and marked *(code)*.

**Legend**
✅ works · ⚠️ works with a caveat · 🚧 shown in the UI but not functional · 🔑 needs external setup or provider approval · 🔗 page exists but nothing links to it · 🐞 visible defect found during the check (listed in section 5)

---

## 0. Platform-wide behaviour

| Area | What it does | Status |
|---|---|---|
| Languages | 12 UI languages: English, বাংলা, हिंदी, العربية, Español, Français, Português, Русский, اردو, Türkçe, 中文, 日本語. Arabic and Urdu switch the whole layout to right-to-left. Remembered in the browser and stored on the account. *(code)* | ✅ |
| Sign-in state | Signed-out visitors see the landing page; signed-in users are sent to `/dashboard`. The access token is refreshed automatically (30-minute expiry). | ✅ |
| Sidebar | Home · Messages · Voice Assistant · AI Calling · Unified Conversation · Contacts · Groups · Calendar · Documents · Profile, with **Owner Dashboard** (owners and managers, opens the team dashboard with single sign-on) and **Logout** pinned at the bottom. | ✅ |
| Top bar | Page title, language switcher (EN), notification bell with unread count, account avatar. Sub-pages (Invoices, Bulk Messaging, Integrations, Calendar, Create Post, Unified Conversation…) add a back arrow and a descriptive title such as "Billing Invoices" or "Social Integrations". | ✅ |
| Incoming-call overlay | When a call rings the browser: caller name/number with **Accept**, **Decline** and **Transfer to AI**. *(code)* | ✅ |
| Active-call overlay | Live timer, mute, speaker, end call, and the last three lines of the live transcript. *(code)* | ✅ |
| Roles & permissions | Owner / manager / staff / assistant with permission checks on the API. Only owners see the Subscription tab. | ✅ |

---

## 1. Public pages (no login)

### 1.1 Landing page — `/`  ✔ opened, all sections seen
- Header: How It Works, Features, Pricing anchors; language switcher; Login; Start Free Trial.
- Hero: "Power Up Your Business With AI", 7-day-trial button, See How It Works, and three floating chips (AI Receptionist, Smart Invoicing, Unified Inbox).
- **App Store and Google Play badges** (hero and again near the bottom) — 🚧 each shows a "SOON" tag and an alert "App Store is coming soon."
- "See GoCustify in Action" video block — 🚧 the play button opens a window that says "Demo video coming soon".
- Stat strip: 24/7 AI receptionist · 8+ channels · 3,000+ AI call minutes on Pro · 7-day free trial.
- **Customer journey**: four numbered sections one after another — 01 Capture, 02 Engage, 03 Close, 04 Grow — each with a headline, description, four ticked bullets and an illustration card.
- "Stop Duct-Taping Your Business Together" problem section with four chips.
- Six feature cards (AI Voice Assistant, Smart Invoicing, Unified Inbox, Bulk Campaigns, Documents & E-Sign, Team & Automation). Each has an "Explore →" link that takes the visitor to the Login page.
- Three pricing cards: Starter $299, Growth $699 (Most Popular), Pro $999, each with a Start Free Trial button, plus an add-on note.
- Trust blocks (Private by Design, Built for Teams, Up & Running in Minutes) and a closing "Your AI team member starts today." call-to-action.
- **Contact form** "Talk to GoCustify AI Team" (first/last name, phone, email, message, SEND) → saved as a demo request in the team dashboard's Demo Requests inbox. *(code)*
- Footer: "GoCustify LLC — support@gocustify.com", links to six policies (Privacy, SMS Messaging, Terms & Conditions, Acceptable Use, Refund, Protocols for Law Enforcement) and the section anchors. About Us and Help & Support are not linked from here.

### 1.2 Pricing — `/subscription`  ✔ opened, modals opened
- Three plan cards. Each card has **four inner tabs: Included · Usage · Add-Ons · Email Packs**.
  - Starter $299: 300 call minutes · 500 SMS · 200 emails. Growth $699: 1,500 · 5,000 · 10,000. Pro $999: 3,000 · 15,000 · 50,000.
  - Add-ons: $25 / $50 / $100 SMS-or-minute bundles; email packs $10 / $25 / $50.
- Each card has **Subscribe Now** and **Start Free Trial**. Both open the same **Request Access** window: Full Name, Work Email, Business Name, Business Address, Phone Number, Owner Date of Birth, Business Type / Industry. It is a sales-led flow — "Our team will set up your workspace" and email login credentials. There is no online card payment. ⚠️
- **Request a Demo** (button under the cards) opens a two-column window: a message form (first/last name, phone, email, message, "What happens next") and **Set up an appointment**, which lists real open demo windows to pick and confirm.
- ⚠️ The Starter plan lists "Mobile app access", while the landing page says the mobile app is "coming soon".

### 1.3 Login — `/login`  ✔ opened, Forgot Password opened
- Email or phone plus password (show/hide eye), Forgot Password, Log In. Language switcher at top right; Privacy Policy and Terms links in the footer. There is no Google sign-in.
- **Forgot Password**: enter email or phone → receive a verification code → set a new password with a strength meter. ✅ *(code for the later steps)*
- 🐞 **"Don't have an account? Sign Up" goes to the Pricing page**, not to a sign-up form. The sign-up screens (name, email, phone, password, Terms checkbox, email-or-SMS code choice, OTP) exist in `Login.jsx` but nothing opens them.

### 1.4 Onboarding — `/onboarding` (`/begin` forwards here)  ✔ all three steps opened
- Step 1 "How do you identify?": Real Estate Investor · Realtor / Agent · Landlord · Homebuyer. Step 2 "Main goals" (Expand my portfolio, Generate more leads, Find off-market deals, Manage property maintenance…). Step 3 company name and years of experience, then **Go to Dashboard**.
- ⚠️ The whole flow is written for real estate and does not fit a general business CRM. 🔗 Nothing links to `/begin` or `/onboarding` from the app.

### 1.5 Legal and content pages  ✔ all eight opened
Privacy Policy, Terms & Conditions, SMS Messaging Policy, Acceptable Use Policy, Refund Policy, Protocols for Law Enforcement, About Us, Help & Support. Each shows the page title, an "Updated Sep 20, 2026" date and a back-to-home link. Content is edited in the CMS without a deploy. ✅
🐞 About Us still says "**SmartFlow** keeps conversations…" and ends "production APIs that mobile clients can use directly". Help & Support says "Use the **support ticket endpoint**…". Both are developer wording.

### 1.6 Confirm a meeting time — `/confirm-meeting/:token`  ✔ invalid-link state opened
Shows the proposed time and **Confirm This Time**, then a confirmation with the meeting link. An unknown link shows "This link isn't available / This scheduling link was not found." ✅

### 1.7 Sign a document — `/sign/:docType/:token`  ✔ invalid-link state opened
Public signing page for agreements and leases: **Download PDF**, type your name as the signature, complete signing. Handles already-signed and invalid links. ✅ *(code for the signing step)*

---

## 2. Main app pages (sidebar order)

### 2.1 Home / Dashboard — `/dashboard`  ✔ opened with data
- Greeting "Good Morning, {name}" and a **"Tap to ask GoCustify AI"** bar that opens the Voice Assistant.
- A **Bulk Messaging** banner with Open.
- Four stat tiles: Conversations, Contacts, AI Calls, Mins Saved.
- **Unified Conversations** card (Inbox, chat count, latest message, avatars, View All), **Contacts** card (count, avatars, View All), **Calendar** card (next meeting, "N upcoming meetings", Add Your Calendar), **Integrations** card (connected platforms, or a plus button when none).
- **Documents** row of four shortcuts: Agreement, Invoice, Lease, Create Post.
- **AI Call Analytics**: Total Calls, Minutes Saved, and the most recent calls with the AI's one-line summary and status. ✅

### 2.2 Messages — `/conversations`  ✔ opened, a thread opened
This is the **team's internal chat**, not the customer inbox. Every row is tagged TEAM or GLOBAL (the organisation-wide chat) and lists team members and groups.
- Filters: All · Unread · Archived, with counts. Search box.
- Thread: text bubbles with time and read ticks, header icons for info, archive and delete, a composer with attach, mic (voice message) and send, and an **AI Reply Suggestions** link.
- ⚠️ *(code)* If the AI suggestion call fails, three canned replies are shown instead. Forward and reply-to are also available.

### 2.3 Voice Assistant — `/voice-conversation`  ✔ opened
- Left panel: **Chat History** (count, plus button for a new chat, list of past named chats), **Action Chips** (Create Invoice, Bulk Message, Schedule Meeting, New Lease, New Agreement, History), **Prompt Buttons** ("Read my latest messages", "Create a new invoice", "What's on my schedule?"), **Assistant Status**, **Voice Output** (choose an AI voice) and **AI Language**.
- Main panel: "Start AI Voice Assistant", **Connect** and **Start Listening**, and a suggested sentence to say.
- *(code)* Voice-to-workflow: it detects an intent (invoice, meeting, bulk message, agreement, lease), asks for missing fields, then shows **Confirm and Execute**, which opens the real form pre-filled.
- ⚠️ Speech recognition depends on the browser (Chrome, Edge or Safari); text chat works everywhere.
- 🐞 Some workflow field labels (`vcon_lbl_amount`, `vcon_lbl_client`…) are missing from the English text and would show as raw codes.

### 2.4 AI Calling — `/calls`  ✔ opened, Analyze opened
- Six stat cards: Total Calls, Inbound, Outbound, Missed, Avg Duration, AI Analyzed (direction counts now cover every call, not only the loaded page).
- **Make AI Call** (opens a phone-number window, international format) and a refresh button. While an AI call is live a banner shows "AI is calling {number}" with **End Call**. *(code)*
- **Call History**: search, "20 records", Load More. Each row shows number, direction, duration, time, a **Recorded** tag and four buttons: **Call Now** (browser call), **Queue Callback**, **Recording**, **Analyze**.
- **Analyze** opens an **AI Call Analysis** panel above the list with three tabs: **Summary** (call overview, AI summary, key points, action items, plus Call Now / Queue Callback / Download Recording), **Transcript**, **Recording**.
- **Appointment requests from calls** (Accept / Decline; accepting or declining texts the caller) appears **only while there are pending requests**; it is hidden when empty.
- ⚠️ When a call has only a whole-call transcript and no per-speaker segments, the Transcript tab shows it as one bubble with the caller icon, even though it contains the AI's greeting.
- The business-hours window the AI offers is **not** on this page; it is in Profile → Account Settings.

### 2.5 Unified Conversation — `/unified-conversation`  ✔ opened, filters used
This is the **customer inbox**. Filters with live counts: All · WhatsApp · SMS · Email · Facebook · Instagram · Archived (there is no Telegram filter). Same thread view and composer as Messages, with a channel tag on each row. Which channels deliver depends on what is connected in Integrations. ✅

### 2.6 Contacts — `/contacts`  ✔ opened, add form and a profile opened
- Tabs: **On GoCustify**, **Invite to GoCustify**, **Team**, each with a count. Header buttons: **Filter** (company drop-down), **Export**, **Import**, **Add Contact**.
- **Top Prospects** cards and a **Network Reach** card.
- **Directory**: search, grid/list toggle, columns Contact, Status, Company, Location, Last Interaction, Actions (edit, call, delete), pagination.
- **Add contact** form ("Creating Draft"): profile picture, first/last name, phone, email, physical address, date of birth, lead status (New Prospect / Active Partner / Client Partner), notes.
- **Import** from a CSV file or phone contacts; **Export** to CSV. *(code)*
- **Contact profile**: Back to Directory, **Call**, **Message**, **Edit**, quick stats (last contact, total calls), contact information, notes, Remove Contact.
- ⚠️ **Call** starts an *AI* outbound call to the contact, not a human call. *(code)*
- 🚧 The **Network Reach "94.2k / +12.4% vs last month"** card is fixed text. The **"Schedule welcome sequence upon saving? Yes / No"** switch only changes its own colour; nothing is saved or scheduled.

### 2.7 Groups — `/groups`  ✔ opened, Create Group opened
- Card grid plus a **Group Preview** panel (Message, Settings, description, linked conversation id, updated date, delete).
- The list includes the organisation **Global Chat** and **auto-managed role groups** (Staff Group, Manager Group, Assistant Group, "Auto-managed group for every … on the team"), plus custom groups. Search box and **Create Group**.
- **Create Group**: image, name, description, avatar URL, members picked from contacts, live preview.
- *(code)* Group page: change member roles (Member/Admin), add and remove members, invite by email or phone with pending invites, edit settings, leave, delete. Owners cannot leave; they delete. The global chat's membership is managed from the Owner Dashboard.
- 🐞 The Create Group side panel shows developer notes to users: "Runtime notes — Creates a real SmartFlow group record…".

### 2.8 Calendar — `/calendar`  ✔ opened, New Meeting and details opened
- **Calendar Providers**: four buttons — Connect Google, Apple, Zoom and Outlook Calendar (with Sync Now and a primary-provider choice once connected). *(code)*
- Three stat cards: Total Events, Online Meetings, Upcoming. **Upcoming Events** list with Refresh; each event is expandable.
- **Add to Calendar** opens a **New Meeting** side panel: title, description, date, start and end time, Online / Offline, meeting link (or location), attendees, notify by push / email / SMS, reminder time.
- Event details window: tags (ONLINE, LOCAL), **Edit**, **Share**, **Apple Calendar** (export), **Delete**; date and time, meeting link, reminder ("15 min before"), share link, attendees, organiser, created/updated, description.
- ⚠️ With no calendar provider connected, an "online" meeting gets a placeholder link on the backend address (`…/meet/<token>`) which returns "not found". Real Google Meet, Zoom or Teams links need a connected provider.
- 🔑 Provider connections need each provider's OAuth app configured. The Business Email Domain block is **not** on this page.

### 2.9 Documents — `/documents`  ✔ opened, every tab and form opened
Five tabs: **Agreements**, **Invoice**, **Leases**, **Documents**, **Create Post**. *Invoice* and *Create Post* are shortcuts that open those pages. The page opens on Leases. The top-right button follows the tab (New Lease / New Agreement / New Document).

**Leases** (list with search, status tags active / pending signature / expired / draft, delete, expand)
- **New Lease** panel: "Generate Lease with AI" prompt with mic; property address and type (Apartment, House, Commercial, Studio, Villa); parties ("I am signing this lease as" Landlord or Tenant); rent, deposit, duration, dates; terms; signature fields; preview. *(code for generation)*
- On a saved lease *(code)*: send for signature (native link or DocuSign, two-signer sequential), sign in place, AI review, **AI Improve** (focus Balanced / Tenant / Landlord / Compliance, with preview to accept or discard), **Renew** (creates a linked lease), downloads (PDF, signed PDF, certificate).

**Agreements** (list, statuses pending signature / draft / expired / signed)
- **New Agreement** panel: Agreement Basic Info (title, type Contract / NDA / Service / Lease / Legal, client name, email, phone, date), **Generate with AI** prompt with mic, Agreement Content editor, **Run AI Review**, required-signature toggle, Send For Signature or Save as Draft. *(code for generation and sending)*
- Signature provider: native GoCustify link or DocuSign (connect via OAuth). Renew and delete.

**Documents** (file records)
- Each record can be edited, deleted and expanded. **New Document** takes a Name, a Type and a **File URL**.
- 🚧⚠️ It stores a link, not an uploaded file.

Voice fill is also available to create any of these by speaking. *(code)*

### 2.10 Profile ("Settings") — `/profile`  ✔ opened, all nine tabs opened
Left menu: Personal Info · Business Profile · Subscription (owners only) · Voice History · Notifications · Account Settings · Support · AI Configuration · Security.

| Tab | What is there |
|---|---|
| **Personal Info** | Avatar with upload, full name, email (read-only), country, date of birth, preferred language, Save Profile. 🐞 the avatar shows a broken image, and the upload button and hint show raw codes `prof_btn_upload` / `prof_avatar_hint`. |
| **Business Profile** | Logo with **Upload Logo** (🐞 broken image), business name, email, phone, website, office address, Save Business Profile. Feeds the AI's business facts. |
| **Subscription** | Current plan (Pro, active) and the three plan cards with **View Only** buttons. ⚠️ No plan change or payment here. |
| **Voice History** | Searchable list with Refresh and a replay button per row. 🐞 The rows are activity events ("Download lease LD-… PDF", "Send agreement … with DocuSign", tagged AGREEMENT / EXPORTED / DELIVERED), not voice interactions. |
| **Notifications** | Eight switches (general, sound, vibrate, new messages, missed calls, scheduled calls, AI tasks, calendar reminders) and Save Preferences. 🐞 the last five labels show raw codes such as `nprof_lbl_new_messages`. |
| **Account Settings** | **Platform Telnyx Integration** (the business's phone number, Re-run Provision Check), **Business hours** (Mon–Sun toggles, From / To, Save business hours — the window the AI offers callers), **Custom Telnyx Integration** (own credentials and number), then legal and support documents. 🐞 the API-key label and token placeholder show raw codes `APROF_LBL_API_KEY` / `aprof_ph_token`. |
| **Support** | Live chat with a named support agent (General Support), quick topics (Billing Issue, Technical Help, Account Problem), and **Report a Problem** (category, subject, description). |
| **AI Configuration** | See below. |
| **Security** | Change Password (current / new / confirm), **Revoke All Sessions**, Danger Zone → **Delete My Account**. |

**AI Configuration** — controls the phone agent:
- AI Voice Language; assistant name; business type (with a free-text box when "Other").
- **Available AI Voices**: Male Executive, Male Warm, Female Executive, Female Warm, Neutral Assistant (the saved one is highlighted).
- Inbound greeting, outbound greeting, closing message, custom instructions (the AI's core safety rules always outrank these).
- **Keypad language menu**: the AI ends its greeting by naming the key that switches language (for example "Para español, marque 2"), on inbound calls and on Make AI Call. Pressing the key at any point re-greets in that language, including the recording notice. *(code)*
- **Test AI**: a text-only simulated call that never books or logs anything real.
- Bengali callers are answered in English because OpenAI's speech synthesis does not speak Bengali (a deliberate client decision).

---

## 3. Other pages (not in the sidebar)

### 3.1 Invoices — `/invoices` ("Billing Invoices")  ✔ opened, New Invoice and detail opened
- **New Invoice**. **Connect Stripe** banner. 🔑 needs live Stripe keys.
- KPI cards: Total Outstanding, Sent, Overdue; search; filters All / Draft / Sent / Overdue / Paid; table (Client / ID, Amount, Due Date, Status, download and more actions); pagination.
- A right-hand **Invoice Details** preview with Download PDF, Mark Paid, Create Share Link, and AI Suggestions (Send Reminder, Generate Follow-up), plus "View Full Timeline & Logs".
- **Create Invoice** form: **AI Voice Invoice Fill**, issue and due dates, client name (search or add), client email, invoice number, billing address, tax rate, notes, line items (description, quantity, price, delete, + Add Item), subtotal / tax / total, Save Draft, Create Invoice, and a live paper preview.
- **Invoice detail** page: status badge and "N day(s) overdue", Progress Timeline (Created → Sent → Viewed → Paid), Edit Invoice, View PDF, Share via Voice, Delete Invoice, line items, Client Identity, Activity Log, and an **AI Intelligence** card with a reminder picker (In 1 day / 2 days / 5 days / 1 week) and Schedule Voice Reminder.
- ✅ Email delivery, PDF download, share link, Stripe payment link, Mark Paid. *(code)*
- 🚧 **SMS, WhatsApp and Verified-thread delivery**: only the first ticked channel is used, and only email actually sends; the others record a "Sent" event and change the status without delivering anything.
- 🚧 **Send Reminder** does email the client, but then shows "AI Call Reminder scheduled in…". No AI call is scheduled.
- 🚧 **Generate Follow-up** ("Schedule automated sequence") only re-opens the detail view.
- 🚧 The paper preview is branded "**SmartFlow Agency, 123 Cyber Way, Neo SF**" with demo bank details, and the side panel says "SmartFlow is listening". The downloaded PDF is plain text with no business name, logo, address or bank details.
- 🚧 "+15% from last month", the "AI Intelligence — high likelihood of delayed payment" message, and the "Visual analytics for this invoice are generating…" spinner (which never finishes) are static.

### 3.2 Bulk Messaging — `/bulk-messaging`  ✔ opened, both channels opened
- **Delivery Channel**: two buttons labelled "email" and "phone number" (SMS).
- **Recipients**: type and press Enter, **Pick from Contacts**, **Pick from Groups** ("Add every member of a group at once"), **Upload CSV file**, **Validate Recipients**.
- **Compose**: recipients-validated counter, subject with **AI Draft**, message (0/5000) with mic and **Improve with AI**, personalisation variable chips ([name], [phone], [date]), attachments by link or upload, **Schedule Send**, **Send Now**.
- **Previous Broadcasts**: list of past sends with status sent / failed / cancelled. *(code: cancel on scheduled ones)*
- Email goes out from your Zoho Mail or Microsoft 365 when connected, otherwise from your business email domain; SMS from your business number. *(code)*
- 🐞 The message box hint reads "Write your broadcast message… Use  for personalization." — the placeholder name is missing.

### 3.3 Integrations — `/integrations` ("Social Integrations")  ✔ opened, Telegram window opened
- Top: **Business Email Domain** (use a business-name address we create, or your own domain with DNS records and **Check status**), **Connect Zoho Mail**, **Connect Microsoft 365**. *(code for the flows)*
- Cards with **Connect** for Facebook, Instagram, WhatsApp, Google Business, Zoom Calendar, Zoho Mail, Microsoft 365, LinkedIn, X (Twitter), Snapchat, Telegram, Threads.
- **Telegram** opens a Bot Token / Bot Username / Secret Token window. **WhatsApp** takes a number plus a gateway URL that defaults to `http://localhost:3001`, so it is not usable by ordinary customers. ⚠️
- 🔑 Facebook and Instagram stay blocked until the Meta app is switched to Live mode; Snapchat needs Snap's allowlist approval. LinkedIn, X and Threads were not verified. X inbox delivery is not supported.
- 🐞 Zoom Calendar, Zoho Mail and Microsoft 365 appear a second time as generic cards with a "?" icon and the text "Connect external channels."
- 🐞 The Business Email Domain card shows a raw status `bed_status_undefined` and an empty "Your domain" while saying "DNS records were created automatically".
- ⚠️ Google Business shows the connected account email next to a **Connect** button.

### 3.4 Notifications — `/notifications` ("System Notifications")  ✔ opened
Filters All · Unread · WhatsApp · Email · SMS; "N new notifications"; **Mark All As Read**; delete per row. Types seen: Bulk message dispatched / scheduled, Meeting scheduled, New meeting request from a call, Incoming Call. ✅

### 3.5 Create Post — `/create-post` ("Create Social Post")  ✔ opened
Generate a post with AI from a prompt, edit the content (character count), choose connected platforms, **Publish Now** or **Schedule**, and a Recent Posts list. With no connected platforms it says "No publishable connected platforms found." ✅ 🔑 depends on connected accounts.

### 3.6 Admin Panel — `/admin` ("System Administration")  ✔ opened as an owner
Platform-admin overview (users, revenue, AI requests, transactions, recent users). For a non-admin it shows "You don't have permission to perform this action" with zeros. 🐞 The whole page is dark teal on a dark background and is hard to read.

### 3.7 AI Workflow — `/ai-workflow` 🔗  ✔ opened
"What can I help you with today?" prompt box with voice input, **Run**, **History**, and chips Create Invoice, Bulk Message, Schedule Meeting, New Agreement, **Generate Image**. Detects the intent, shows missing fields, then Confirm and Execute opens the pre-filled form. Overlaps with the Voice Assistant. Not linked from anywhere.

### 3.8 AI Call (web) — `/ai-call` 🔗  ✔ opened
Talk to GoCustify AI through the browser microphone and speaker, with a "Phone Call & Dialer" tag. 🐞 The title, badge, notice and start-button text are raw codes (`aicall_title`, `aicall_badge`, `aicall_notice`, `aicall_start`). Not linked from anywhere.

### 3.9 Join Event — `/join-event` 🔗  ✔ opened
"Discover & Join Events": search and category filter, an event feed with capacity ("1/12 attending"), a **Create Event** form (title, category, capacity, description, location, online link, date, start and end time, timezone), and an event detail panel with **Leave Event / Join Event**. Not linked from anywhere.

---

## 4. What the marketing says vs. what exists

| Claim on the landing or pricing page | Reality |
|---|---|
| Missed-call text back | 🚧 Only plan-feature text. No text-back logic exists. |
| AI auto-replies to comments on your social posts | 🚧 Only plan-feature text. Not implemented. |
| AI reads and responds to messages on FB, IG and X | ⚠️ FB and IG blocked on Meta approval. X inbox is marked unsupported. |
| CRM with leads, contacts and pipeline | ⚠️ Contacts with a three-value lead status. There is no pipeline view. |
| Plan usage caps (300 call minutes, 500 SMS…) and plan-tier gating | ⚠️ Usage is not metered or capped. The API only checks for an active subscription; nothing separates Starter, Growth and Pro. |
| Demo video, App Store and Google Play | 🚧 Placeholders. |
| Advanced automation workflows | ⚠️ AI-assisted form pre-filling only. No automation builder. |
| Mobile app access (in the Starter plan) | ⚠️ The app badges say "coming soon". |

---

## 5. Defects found during the live check

**Customer-visible**
1. **Raw translation codes on screen (about 31 places).** Profile: avatar button and hint, five notification labels, API-key label and token placeholder. AI Call page: four texts. Voice Assistant workflow fields. Integrations: `bed_status_undefined`. Also missing: `sup_open_attachment`, `vprof_no_transcript`, `aprof_connected_num`, `prof_title`, `calls_err_no_number`, `conv_err_file_failed`.
2. **Sign Up link opens the Pricing page**; there is no self sign-up form.
3. Bulk Messaging hint "Use  for personalization" (name missing).
4. Integrations shows Zoom, Zoho and Microsoft twice, with "?" icons on the second copy, and a broken Business Email Domain card.
5. Broken avatar and business-logo images (only the alt text shows).
6. Admin Panel is unreadable (dark on dark).
7. About Us and Help & Support pages contain "SmartFlow" and developer wording.
8. Online meeting placeholder links return "not found".

**Misleading UI (looks like a feature, does nothing)**
9. Invoice SMS / WhatsApp / thread delivery, Send Reminder's "AI Call Reminder scheduled", Generate Follow-up, the endless analytics spinner, the AI-Intelligence message, "+15%", and the fake "SmartFlow Agency" preview and bank details. The real PDF has no business name, logo, address or bank details.
10. Contacts: "Network Reach 94.2k / +12.4%" and the "welcome sequence" switch.
11. Contacts **Call** places an AI call.
12. Voice History lists activity events, not voice interactions.
13. Documents "New Document" saves a URL, not a file.

**Housekeeping**
14. Onboarding is written for real estate.
15. Dead code: `AgreementGenerator.jsx`, `LeaseGenerator.jsx`, `Activities.jsx`, `Shop.jsx`, `Profile/tabs/PrivacyTab.jsx`, and the sign-up screens inside `Login.jsx`.
16. Unlinked routes: `/ai-call`, `/ai-workflow`, `/join-event`, `/begin`.
17. "SmartFlow" leftovers in the invoice screens and Groups notes.

**Not exercised in this check** (writes were blocked): every save / send / delete, phone and browser calls, microphone and speech, OAuth connections, Stripe payments, DocuSign envelopes, email and SMS delivery.
