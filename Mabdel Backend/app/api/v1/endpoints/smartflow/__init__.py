from __future__ import annotations

# Import all sub-modules so their routes are registered on the shared router.
from . import (  # noqa: F401
    home,
    contacts,
    conversations,
    ai,
    bulk_messages,
    calendar,
    documents,
    leases,
    agreements,
    calls,
    integrations,
    notifications,
    groups,
    settings,
)

from ._router import router

__all__ = ["router"]
