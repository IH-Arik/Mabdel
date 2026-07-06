from fastapi import APIRouter
from .admin import router as admin_router
from .super_admin import router as super_admin_router
from .notifications import router as notifications_router
from .webhooks import router as webhooks_router
from .rbac import router as rbac_router
from .owner import router as owner_router
from .subscription import router as subscription_router

api_router = APIRouter()

api_router.include_router(admin_router, prefix="/admin", tags=["Dashboard Admin"])
api_router.include_router(super_admin_router, prefix="/super", tags=["Dashboard Super Admin"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(webhooks_router)
api_router.include_router(rbac_router, prefix="/rbac", tags=["Role & Permission Management"])
api_router.include_router(owner_router, prefix="/owner", tags=["Owner Team Management"])
api_router.include_router(subscription_router)
