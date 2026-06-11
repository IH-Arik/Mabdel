from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, NotRequired, TypedDict


Intent = Literal["invoice", "email", "bulk_message", "calendar", "lease", "agreement", "group", "call", "unknown"]


@dataclass
class WorkflowState:
    command: str
    intent: Intent = "unknown"
    summary: str = ""
    action_required: bool = False
    history: list[dict] = field(default_factory=list)
    output: dict = field(default_factory=dict)


class WorkflowStateData(TypedDict):
    command: str
    intent: NotRequired[Intent]
    summary: NotRequired[str]
    action_required: NotRequired[bool]
    history: NotRequired[list[dict]]
    output: NotRequired[dict]
