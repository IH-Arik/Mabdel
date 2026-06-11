from app.api.v1.endpoints.ai import router as ai_router
from app.api.v1.endpoints.calendar import router as calendar_router
from app.api.v1.endpoints.calls import router as calls_router
from app.api.v1.endpoints.email import router as email_router
from app.api.v1.endpoints.groups import router as groups_router
from app.api.v1.endpoints.invoices import router as invoices_router
from app.api.v1.endpoints.permissions import router as permissions_router

__all__ = [
    "ai_router",
    "calendar_router",
    "calls_router",
    "email_router",
    "groups_router",
    "invoices_router",
    "permissions_router",
]
