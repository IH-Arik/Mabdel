from __future__ import annotations

from app.workflows.state import WorkflowState


def send_email(state: WorkflowState) -> WorkflowState:
    state.summary = "Email workflow prepared."
    state.output["email"] = {"status": "draft"}
    return state
