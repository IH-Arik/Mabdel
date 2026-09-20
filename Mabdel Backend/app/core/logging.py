from __future__ import annotations

import logging


def configure_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    # Chatty per-request loggers that would drown out the call diagnostics we need.
    for noisy in ("httpx", "httpcore", "openai", "pymongo", "asyncio", "websockets", "multipart"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
