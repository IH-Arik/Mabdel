from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.group_service import GroupService
from app.utils.responses import success_response

router = APIRouter(prefix="/groups", tags=["Groups"])


class GroupCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    members: list[str] = Field(default_factory=list)


@router.post("")
async def create_group(payload: GroupCreateRequest) -> dict:
    result = GroupService().create_group(name=payload.name, members=payload.members)
    return success_response(data=result, message="Group created successfully.")
