def send_reminder_task(payload: dict) -> dict:
    return {"task": "reminder", "status": "queued", "payload": payload}
