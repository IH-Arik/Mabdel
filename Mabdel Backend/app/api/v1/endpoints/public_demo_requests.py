from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_mongo_database
from app.schemas.demo_request import DemoRequestCreate
from app.services.demo_request_service import DemoRequestService
from app.utils.responses import success_response

router = APIRouter(prefix="/public", tags=["Public"])


def get_demo_request_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> DemoRequestService:
    return DemoRequestService(db)


@router.post("/demo-requests")
async def submit_demo_request(
    payload: DemoRequestCreate,
    service: DemoRequestService = Depends(get_demo_request_service),
) -> dict:
    data = await service.create_demo_request(payload.model_dump())
    return success_response(data=data, message="Demo request submitted successfully.")
