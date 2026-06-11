from __future__ import annotations

from app.workflows.state import WorkflowState


def route_by_intent(state: WorkflowState) -> str:
    if state.intent == "unknown":
        return "finalize"
    if state.intent == "invoice":
        return "create_invoice"
    if state.intent == "email":
        return "send_email"
    if state.intent == "bulk_message":
        return "create_bulk_message"
    if state.intent == "calendar":
        return "schedule_meeting"
    if state.intent == "lease":
        return "create_lease"
    if state.intent == "agreement":
        return "create_agreement"
    if state.intent == "group":
        return "create_group"
    if state.intent == "call":
        return "handle_call"
    return "finalize"
