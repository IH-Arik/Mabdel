from __future__ import annotations

from datetime import datetime


def parse_iso_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value)
