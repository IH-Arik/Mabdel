# Local AI Receptionist acceptance

Run these checks from the repository root in PowerShell:

```powershell
& '.\Mabdel Backend\.venv\Scripts\python.exe' '.\Mabdel Backend\scripts\verify_receptionist_local.py'
```

The runner uses the backend test database fixtures, fake provider responses, a socket guard that rejects non-loopback connections, and test-client requests within the process. It does not call a production number, send a real message, connect a customer calendar, deploy, or print environment credentials. The child process also blanks communication credential environment variables; existing test fixtures supply any required fake values. Loopback sockets remain available for Python event-loop internals.

## What the suite proves

- Browser timeout and failed bridge reach the actual fallback handlers, honor disabled/approval/allowed answering, and consume repeated ring callbacks once. Reject ends the call without AI answering.
- SMS/email provider timeouts do not return success, and approval review retries cannot repeat a failed provider delivery.
- Pending actions and meetings respect organization isolation, disabled permissions, and approval replay controls.
- Google, Microsoft and Zoom calendar adapters handle mocked OAuth and event synchronization requests. This verifies request/response handling, not live account connectivity.
- Appointment SMS wording/toggles and outbound follow-up deduplication work against provider substitutes.
- Document upload rejects unreadable/oversized files; approval, revocation, deletion, extraction, retrieval and organization boundaries are tested.
- Location scheduling, workflow request handling, streaming audio envelopes and speech-provider failures have regression coverage.

## UI review without production services

Build the website with `npm run build` from `Mabdel Website`. For interactive checks, use development/test accounts and intercept API responses in the browser; keep Telnyx registration and all send/call controls disconnected. Verify document review/approval, permission selection, route targets, follow-up assignment and business locations. An unmocked browser connected to the normal API host is not an isolated acceptance environment.

## Requirements still needing deployment acceptance

Real inbound/outbound audio, transfer reachability, native device behavior, carrier SMS delivery and real external-calendar token/synchronization checks require the configured deployment and explicitly selected test destinations/accounts. Passing the local suite proves the tested logic, not deployment readiness or all 46 pages of product behavior.

Document knowledge uses bounded verbatim lexical retrieval. Uploaded PDFs must contain readable text; scanned-only files require OCR before upload. Supported limits are ten documents, 5 MB per document, 12,000 extracted characters per document and sixty PDF pages. This flow does not calculate insurance eligibility, issue a financial quote or execute an arbitrary external workflow; those are staff follow-up requests.
