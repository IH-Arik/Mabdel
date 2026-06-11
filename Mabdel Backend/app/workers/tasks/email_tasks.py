def send_email_task(payload: dict) -> dict:
    return {"task": "email", "status": "queued", "payload": payload}
