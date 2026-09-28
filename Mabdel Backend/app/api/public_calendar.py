from __future__ import annotations

from html import escape

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_mongo_database
from app.services.smartflow._base import SmartFlowBase

router = APIRouter(tags=["Public"])

_PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>{title}</title>
<style>body{{font-family:system-ui,sans-serif;background:#0c101b;color:#e2e8f0;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}}
.card{{background:#121625;border:1px solid #243041;border-radius:20px;padding:32px;max-width:440px;width:calc(100% - 32px)}}
h1{{font-size:22px;margin:0 0 16px}}p{{margin:8px 0;line-height:1.5}}small{{color:#94a3b8}}a{{color:#c084fc;word-break:break-all}}</style></head>
<body><div class="card">{body}</div></body></html>"""


@router.get("/calendar/share/{share_token}", response_class=HTMLResponse, include_in_schema=False)
async def shared_calendar_event(share_token: str, db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> HTMLResponse:
    """The page behind the "View meeting details" link in a meeting invite. Shows only what
    the invite itself already says: title, when, where and the join link."""
    event = await db.calendar_events.find_one({"share_token": share_token}) if len(share_token) >= 16 else None
    if not event:
        body = "<h1>Meeting not found</h1><p><small>This invite link is no longer valid.</small></p>"
        return HTMLResponse(_PAGE.format(title="Meeting not found", body=body), status_code=404)

    lines = [f"<h1>{escape(str(event.get('title') or 'Meeting'))}</h1>", f"<p><strong>{escape(SmartFlowBase._format_event_time(event))}</strong></p>"]
    if event.get("location"):
        lines.append(f"<p>{escape(str(event['location']))}</p>")
    if event.get("meeting_link"):
        link = escape(str(event["meeting_link"]), quote=True)
        lines.append(f'<p>Join: <a href="{link}" rel="noopener noreferrer">{link}</a></p>')
    return HTMLResponse(_PAGE.format(title=escape(str(event.get("title") or "Meeting")), body="".join(lines)))
