from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from Dashboard.app.dependencies import get_mongo_database, require_role
from Dashboard.app.dependencies import get_dashboard_service
from Dashboard.app.schemas.dashboard_schemas import DashboardSummary, GrowthMetrics, BaseResponse
from Dashboard.app.services.dashboard_service import DashboardService

router = APIRouter()


@router.get("/platform-summary", response_model=BaseResponse[DashboardSummary])
async def get_platform_summary(
    current_user: dict = Depends(require_role(["super_admin"])),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get a global summary of the entire platform's performance, including total users across all organizations and total revenue.
    """
    data = await service.get_super_admin_summary()
    return BaseResponse(data=data)


@router.get("/global-growth", response_model=BaseResponse[GrowthMetrics])
async def get_global_growth(
    current_user: dict = Depends(require_role(["super_admin"])),
    service: DashboardService = Depends(get_dashboard_service),
):
    """
    Get analytical data for global platform growth trends for high-level charts.
    """
    data = await service.get_growth_metrics("users")
    return BaseResponse(data=data)
