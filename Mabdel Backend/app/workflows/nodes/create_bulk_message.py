from __future__ import annotations

from app.workflows.state import WorkflowState


def create_bulk_message(state: WorkflowState) -> WorkflowState:
    state.summary = "Bulk messaging workflow prepared."
    state.output["bulk_message"] = {"status": "draft", "channel": "email"}
    return state
