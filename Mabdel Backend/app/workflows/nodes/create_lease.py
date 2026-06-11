from __future__ import annotations

from app.workflows.state import WorkflowState


def create_lease(state: WorkflowState) -> WorkflowState:
    state.summary = "Lease workflow prepared."
    state.output["lease"] = {"status": "draft"}
    return state
