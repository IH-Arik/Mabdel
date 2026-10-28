from __future__ import annotations

import asyncio

from app.services.email_service import EmailService
from app.services.push_notification_service import PushNotificationService

# Regression for B05: every Celery task in app/workers/tasks called
# mongo_manager.get_database() (not a real method - the manager only has
# connect(); the real helper is the module-level get_database()), so every
# task crashed with AttributeError before doing anything. Separately,
# send_email_task and dispatch_push_notifications_task called service methods
# that don't exist at all (.send() / .dispatch()); the generic reminder task
# called a .send_reminder() that PushNotificationService never had. None of
# this was ever caught because the worker container isn't deployed, so these
# tasks have never actually run. These tests exercise the real service calls
# each task now makes, directly - not through Celery's machinery, since
# nothing here is Celery-specific.


def test_email_service_has_a_generic_send_method_the_task_can_call(monkeypatch):
    # RESEND_API_KEY is a real, live key in this dev environment - mock the
    # actual send call so this test can't fire a real email (confirmed the
    # hard way: this failed against the live Resend API on the first attempt).
    sent = {}

    def fake_send(payload):
        sent.update(payload)

    import resend
    monkeypatch.setattr(resend.Emails, "send", fake_send)

    asyncio.run(EmailService().send(email="someone@example.com", subject="Hi", text="hello", html="<p>hello</p>"))

    assert sent["to"] == ["someone@example.com"]
    assert sent["subject"] == "Hi"


def test_push_service_dispatch_jobs_accepts_the_tasks_payload_shape(mock_db):
    service = PushNotificationService(mock_db)
    result = asyncio.run(service.dispatch_jobs(job_ids=None, limit=50))
    assert result == []  # no jobs queued in a fresh test db, but the call itself must not raise


def test_push_service_enqueue_notification_accepts_the_reminder_tasks_payload_shape(mock_db):
    service = PushNotificationService(mock_db)
    result = asyncio.run(
        service.enqueue_notification(
            user_id="507f1f77bcf86cd799439011",
            notification={"type": "reminder", "id": "1", "title": "t", "body": "b"},
        )
    )
    assert result == []  # unknown user -> no device tokens, but again: must not raise
