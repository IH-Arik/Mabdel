from __future__ import annotations

from fastapi import Depends

from app.dependencies import get_current_user
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.get("/home")
async def get_home_dashboard(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_home_dashboard(current_user)
    return success_response(data=data, message="Home dashboard fetched successfully.")
