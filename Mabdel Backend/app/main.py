from __future__ import annotations

import asyncio
import logging
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.compat_routes import router as compat_router
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import close_database_connection, mongo_manager
from app.core.exceptions import register_exception_handlers
from app.core.http import AuthRateLimitMiddleware, MutationRateLimitMiddleware, RequestContextMiddleware
from app.services.smartflow.bulk_message_service import BulkMessageService
from app.utils.responses import success_response

logger = logging.getLogger(__name__)
_BULK_DISPATCH_POLL_SECONDS = 5

API_DESCRIPTION = (
    "Backend API for Mabdel client applications. "
    "Provides authentication, onboarding, permissions, invoicing, and SmartFlow workflows."
)

OPENAPI_TAGS = [
    {"name": "Health", "description": "Operational health and readiness checks."},
    {"name": "Authentication", "description": "Registration, OTP verification, login, and token lifecycle endpoints."},
    {"name": "App Config", "description": "Bootstrap configuration returned during client startup."},
    {"name": "Onboarding", "description": "Onboarding slide content and progress tracking."},
    {"name": "Content", "description": "Public app content pages such as About Us, terms, privacy, and help."},
    {"name": "Permissions", "description": "Permission preference persistence for clients and devices."},
    {"name": "AI", "description": "AI helper endpoints for commands and content generation."},
    {"name": "Invoices", "description": "Invoice CRUD, sharing, reminders, and PDF delivery."},
    {"name": "Email", "description": "Email drafting helpers."},
    {"name": "Calendar", "description": "Calendar scheduling helpers."},
    {"name": "Groups", "description": "Group creation helpers."},
    {"name": "Calls", "description": "Inbound call transport hooks."},
    {"name": "SmartFlow", "description": "Protected messaging, integrations, notifications, and workflow endpoints."},
    {"name": "Compatibility", "description": "Legacy routes kept for backward compatibility."},
]


async def _scheduled_bulk_dispatcher(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            database = mongo_manager.database
            if database is not None:
                processed = await BulkMessageService(database).dispatch_due_scheduled_messages()
                if processed:
                    logger.info("Bulk scheduler dispatched %s scheduled campaign(s).", processed)
        except Exception:  # pragma: no cover - background loop logging path
            logger.exception("Bulk scheduler loop failed.")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=_BULK_DISPATCH_POLL_SECONDS)
        except asyncio.TimeoutError:
            continue


def mount_media(app: FastAPI) -> None:
    media_root = Path(settings.MEDIA_ROOT)
    try:
        media_root.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        fallback_root = Path(tempfile.gettempdir()) / "mabdel-uploads"
        fallback_root.mkdir(parents=True, exist_ok=True)
        settings.MEDIA_ROOT = str(fallback_root)
        media_root = fallback_root
        logger.warning("MEDIA_ROOT was not writable (%s). Using %s instead.", exc, media_root)

    app.mount(settings.MEDIA_PUBLIC_PATH, StaticFiles(directory=str(media_root)), name="media")


@asynccontextmanager
async def lifespan(_: FastAPI):
    stop_event = asyncio.Event()
    scheduler_task: asyncio.Task | None = None
    try:
        await mongo_manager.connect()
        scheduler_task = asyncio.create_task(_scheduled_bulk_dispatcher(stop_event))
    except Exception as exc:  # pragma: no cover - startup log path
        logger.warning("MongoDB connection could not be established at startup: %s", exc)
    yield
    stop_event.set()
    if scheduler_task is not None:
        try:
            await scheduler_task
        except Exception:  # pragma: no cover - shutdown log path
            logger.exception("Bulk scheduler task failed during shutdown.")
    await close_database_connection()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description=API_DESCRIPTION,
        debug=settings.DEBUG,
        version="1.0.0",
        lifespan=lifespan,
        openapi_tags=OPENAPI_TAGS,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.TRUSTED_HOSTS)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(AuthRateLimitMiddleware)
    app.add_middleware(MutationRateLimitMiddleware)

    _MAX_BODY_BYTES = 10 * 1024 * 1024  # 10 MB

    @app.middleware("http")
    async def limit_request_body(request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > _MAX_BODY_BYTES:
            return JSONResponse(status_code=413, content={"detail": "Request body too large."})
        return await call_next(request)

    register_exception_handlers(app)
    app.include_router(compat_router)
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)
    mount_media(app)

    @app.get("/health", tags=["Health"])
    async def health_check() -> dict:
        return success_response(data={"status": "ok"}, message="Service is healthy.")

    @app.get("/ready", tags=["Health"])
    async def readiness_check() -> dict:
        mongo_connected = await mongo_manager.ping()
        return success_response(
            data={
                "status": "ready" if mongo_connected else "degraded",
                "services": {
                    "mongodb": "up" if mongo_connected else "down",
                },
            },
            message="Readiness check completed.",
        )

    return app


app = create_app()
