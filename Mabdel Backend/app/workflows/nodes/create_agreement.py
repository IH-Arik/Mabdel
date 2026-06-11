from __future__ import annotations

from app.workflows.state import WorkflowState


def create_agreement(state: WorkflowState) -> WorkflowState:
    state.summary = "Agreement workflow prepared."
    state.output["agreement"] = {"status": "draft"}
    return state
