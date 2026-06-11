def generate_invoice_task(payload: dict) -> dict:
    return {"task": "invoice", "status": "queued", "payload": payload}
