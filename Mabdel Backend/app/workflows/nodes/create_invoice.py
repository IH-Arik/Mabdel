from __future__ import annotations

from app.workflows.state import WorkflowState


def create_invoice(state: WorkflowState) -> WorkflowState:
    state.summary = "Invoice workflow prepared."
    state.output["invoice"] = {"status": "draft"}
    return state
