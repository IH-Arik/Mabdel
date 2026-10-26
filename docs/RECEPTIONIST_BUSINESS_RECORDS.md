# Receptionist business record execution

The Calls page can turn saved receptionist requests into local business records after a team member reviews the details. This extends request capture and assignment; it does not send messages, place phone calls, or execute arbitrary external URLs.

| Request | Reviewed result |
| --- | --- |
| Task | Business task with description, caller, assignees, priority and optional due time |
| Callback | Callback task for the team; no automatic phone call |
| Service ticket | Business service ticket with its own status lifecycle; separate from platform support tickets |
| Quote | Draft quote with a human-entered amount and currency; no inferred pricing or automatic delivery |
| Workflow | Selected local workflow: create task, create service ticket, or save CRM contact using the existing contact service |

## Review and permissions

Calls view permission allows listing requests and business records. Calls manage permission allows execution and status updates. Execution additionally requires an explicit `approved: true` review and checks the business owner's current capability settings. Disabled capabilities block execution, including the selected workflow's subordinate capability. A capability requiring human approval is satisfied by the authenticated review; a script cannot bypass it.

All request lookup, record lookup, updates and execution are scoped to the reviewer's current organization. Request and business-record lifecycles are separate: completing a capture-only request manually does not create a record; reopen it to execute. Executed requests link to the resulting business record, whose status is managed independently below the queue.

## Retry behavior

Execution claims a bounded database lease. Another active execution returns a conflict. A completed execution returns its saved result. Local task, callback, ticket and quote IDs derive from the request ID, so a retry after a partial database write recovers the existing record instead of creating another. A failed execution retains its reviewed plan; changing the plan during a retry is rejected to avoid creating a second artifact. An interrupted lease can be recovered after five minutes with the same reviewed details.

## API

- `POST /api/v1/smartflow/receptionist/work-items/{id}/execute`: requires `approved: true`. Optional fields: `title`, `priority`, timezone-aware `due_at`, quote `quote_amount`/`currency`, `workflow_action`, `contact_email`. Unexpected fields are rejected.
- `GET /api/v1/smartflow/receptionist/business-records`: latest local business records for the current organization.
- `PATCH /api/v1/smartflow/receptionist/business-records/{kind}/{id}`: update record status. Tasks/tickets/callbacks accept open, in_progress, completed or cancelled. Quotes accept draft, accepted, declined or cancelled.

Quote acceptance/decline records a team member's status update; it does not verify customer acceptance or send the quote. CRM workflow results appear in the existing Contacts area. Other resulting records appear in Calls under Business records.

## Local verification

`app/tests/test_receptionist_execution.py` covers all record kinds, supported workflows, contact service integration, review/price validation, tenant isolation, disabled permissions, partial-write recovery, repeated execution, and changed-plan rejection. These tests use the existing isolated test database and do not contact production or external providers.
