from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints.ai import router as ai_router
from app.api.v1.endpoints.calendar import router as calendar_router
from app.api.v1.endpoints.calls import router as calls_router
from app.api.v1.endpoints.twilio_provisioning import router as twilio_provisioning_router
from app.api.v1.endpoints.email import router as email_router
from app.api.v1.endpoints.groups import router as groups_router
from app.api.v1.endpoints.invoices import router as invoices_router
from app.api.v1.endpoints.permissions import router as permissions_router
from app.api.v1.endpoints.shop import router as shop_router
from app.api.v1.endpoints.smartflow import router as smartflow_router
from app.api.v1.endpoints.activities_events import router as activities_events_router
from app.api.v1.app_config_routes import router as app_config_router
from app.api.v1.auth_routes import router as auth_router
from app.api.v1.content_routes import router as content_router
from app.api.v1.onboarding_routes import router as onboarding_router
from app.api.dashboard.router import api_router as dashboard_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(app_config_router)
api_router.include_router(onboarding_router)
api_router.include_router(content_router)
api_router.include_router(ai_router)
api_router.include_router(invoices_router)
api_router.include_router(email_router)
api_router.include_router(calendar_router)
api_router.include_router(groups_router)
api_router.include_router(calls_router)
api_router.include_router(twilio_provisioning_router)
api_router.include_router(permissions_router)
api_router.include_router(shop_router)
api_router.include_router(smartflow_router)
api_router.include_router(activities_events_router)
api_router.include_router(dashboard_router, prefix="/dashboard")
