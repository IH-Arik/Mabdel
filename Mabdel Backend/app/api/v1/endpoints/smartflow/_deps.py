from __future__ import annotations

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_mongo_database
from app.services.smartflow_service import SmartFlowService


def get_smartflow_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> SmartFlowService:
    return SmartFlowService(db)
