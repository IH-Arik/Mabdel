from __future__ import annotations

import pytest

from app.workers.celery_app import celery_app

# Regression: task_routes keyed on the task's Python module path
# ("app.workers.tasks.email_tasks.*"), but every task here registers under a
# short explicit name instead ("email.send", etc.) - the glob patterns never
# matched anything. Every task silently fell through to Celery's built-in
# default queue, literally named "celery", which the deployed worker
# (-Q email,push,invoice,default) never listens to. Confirmed live on the
# production server: two beat-fired tasks sat unconsumed in Redis for 5+
# minutes before this was fixed. This test asserts each task resolves to a
# queue the worker actually subscribes to, by calling Celery's real router -
# not by re-reading the task_routes dict, which would just restate the bug
# if it regressed the same way again.

WORKER_QUEUES = {"email", "push", "invoice", "default"}

TASKS = [
    "email.send",
    "push.dispatch",
    "invoice.generate",
    "reminder.send",
    "appointments.send_reminders",
    "social.sync_polling_platforms",
    "caldav.sync_connections",
]


@pytest.mark.parametrize("task_name", TASKS)
def test_every_task_routes_to_a_queue_the_worker_listens_to(task_name):
    celery_app.loader.import_default_modules()
    route = celery_app.amqp.router.route({}, task_name)
    queue = route["queue"].name if hasattr(route.get("queue"), "name") else route.get("queue")
    assert queue in WORKER_QUEUES, f"{task_name} routes to {queue!r}, which no deployed worker queue listens to"
