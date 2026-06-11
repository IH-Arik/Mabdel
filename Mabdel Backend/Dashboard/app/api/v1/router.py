from fastapi import APIRouter
from .endpoints.admin import router as admin_router
from .endpoints.super_admin import router as super_admin_router
from .endpoints.notifications import router as notifications_router
from .endpoints.webhooks import router as webhooks_router

api_router = APIRouter()

api_router.include_router(admin_router, prefix="/admin", tags=["Dashboard Admin"])
api_router.include_router(super_admin_router, prefix="/super", tags=["Dashboard Super Admin"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(webhooks_router)
