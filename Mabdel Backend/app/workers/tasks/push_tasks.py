from __future__ import annotations


def dispatch_push_notifications_task(payload: dict) -> dict:
    return {"task": "push_notifications", "status": "queued", "payload": payload}
