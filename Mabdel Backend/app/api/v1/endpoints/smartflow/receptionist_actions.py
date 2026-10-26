from fastapi import Depends, Query

from app.dependencies import require_permission
from app.services.smartflow.receptionist_action_service import ReceptionistActionService
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.get("/receptionist/actions")
async def list_actions(
    status: str | None = Query(default=None),
    current_user: dict = Depends(require_permission("calls", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
):
    return success_response(
        data=await ReceptionistActionService(service.db).list_actions(
            str(current_user["_id"]), status
        )
    )


@router.post("/receptionist/actions/{action_id}/approve")
async def approve_action(
    action_id: str,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
):
    return success_response(
        data=await ReceptionistActionService(service.db).decide(
            str(current_user["_id"]), action_id, approve=True
        )
    )


@router.post("/receptionist/actions/{action_id}/decline")
async def decline_action(
    action_id: str,
    current_user: dict = Depends(require_permission("calls", "manage")),
    service: SmartFlowService = Depends(get_smartflow_service),
):
    return success_response(
        data=await ReceptionistActionService(service.db).decide(
            str(current_user["_id"]), action_id, approve=False
        )
    )
