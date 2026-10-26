# AI Receptionist implementation

Scope: remaining requirements identified from `Untitled document (1).pdf` (46 pages).

## Implemented

| Requirement | Implementation |
| --- | --- |
| Owner permissions separate from scripts | Server-side capability gates for messages, leads/CRM creation, transfers, SMS/email, account lookup, quotes and follow-up requests. Disabled actions cannot run; approval requests persist without performing the action. |
| Human approval | Calls page review queue; tenant-scoped approve/decline endpoints; atomic review prevents repeated execution. Approval rechecks disabled permissions and the requester's organization. Ended calls cannot be transferred. Offline replay preserves the original call transcript. |
| Inbound/outbound controls | AI outbound calls can be disabled or queued for approval. Browser timeout/bridge fallbacks check AI answering permission. Explicit authorized handoff counts as human approval. |
| Specific employee/department routing | Named playbooks resolve configured employee IDs and transfer numbers. Unknown/ambiguous destinations do not silently broadcast to unrelated staff. Requests are assignable and retain their destination. |
| Location-aware scheduling | Calendar location management; hours, weekdays, capacity, provider/service eligibility, ownership validation, availability, booking, rescheduling and approval persistence. Unknown named resources fail closed. |
| Concurrent booking protection | Business-scoped MongoDB lease serializes booking mutations across workers, including nested calendar/approval operations; waits and leases are bounded. External calendar changes still depend on provider synchronization. |
| Insurance validity | Effective dates and last-verification records in settings; future/expired plans excluded from the call's authoritative insurance context. Insurer recognition remains separate from acceptance/coverage. |
| Approved document knowledge | PDF/TXT/DOCX upload, extracted-text review, approval/revocation and deletion. Only approved organization documents enter calls. Retrieval searches every approved document so later documents are not lost to the initial context budget. |
| Tasks/tickets/quotes/callbacks/workflows | Durable, tenant-scoped follow-up requests, targeted notifications, assignment and statuses in Calls. The AI reports that a request was saved; it does not claim a quote was calculated, a service performed or an external workflow completed. |
| Follow-up communications | SMS/email capability checks and approval queue; optional SMS receipts for selected saved request types; caller consent for direct messages. Booking confirmation/reminder contact creation respects the separate CRM permission. |
| Truthful action results | Transfer results wait for the provider response; failed transfers resume the AI. Direct SMS tools wait for the sending result. Missing/failed actions do not count as successful dispositions. Attendance confirmation validates caller name, phone, appointment and explicit consent. |
| Test mode | New business-request, attendance and communication tools have simulation handlers that do not save requests or send messages. |

## Where to review

- **Profile → AI configuration:** permissions, insurance dates, routing targets, approved documents, SMS request receipts.
- **Calendar → Business locations:** location details, hours/capacity and provider/service eligibility.
- **Calls → Receptionist approvals & follow-up:** approve/decline, execution results, assign and complete follow-up requests.

## Validation boundaries

- Full backend regression run: **732 passed, 1 skipped**.
- Subsequent focused checks cover authorization outages, guest-call restrictions, attendance confirmation, CRM-independent SMS delivery and approval replay.
- Website production build and scoped ESLint/import checks pass.
- Browser smoke checks with intercepted APIs pass for document upload/review/approval, Calls approval execution and the location panel; no runtime errors in that run.

Automated backend tests use controlled databases/provider substitutes. Frontend production builds and scoped static checks are run locally. Real inbound/outbound calls, transfer reachability, audio quality, carrier delivery and external calendar synchronization need live acceptance checks against the deployment and its configured accounts.

No production deployment or real customer communications are performed by this change. Native mobile VoIP is outside this document implementation pass.
