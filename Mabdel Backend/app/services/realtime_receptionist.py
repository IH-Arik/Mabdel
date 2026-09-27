"""The AI receptionist on live phone calls, on OpenAI's Realtime (speech-to-speech) API.

It bridges two WebSockets: Telnyx's media stream and an OpenAI Realtime session. Both
sides speak G.711 mu-law at 8 kHz (``audio/pcmu``), so caller audio and AI audio pass
straight through with no transcoding. The model listens, talks, can be interrupted,
and acts through tools (appointments, messages, transfer, hang up) instead of the
keyword script the classic AIPhoneAgent runs.

Everything around the conversation is inherited from AIPhoneAgent: the greeting (with
the mandatory recording disclosure), business facts, persona settings, the keypad
language menu, and the transcript/summary written to call_logs at the end.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from app.core.config import settings
from app.services import call_phrases
from app.services.ai_phone_agent import AIPhoneAgent, _clean_spoken_email, _looks_like_valid_email
from app.utils.helpers import utc_now

logger = logging.getLogger(__name__)

PCMU_BYTES_PER_MS = 8  # 8 kHz, one byte per sample
MAX_KNOWLEDGE_CHARS = 8000
HANGUP_AFTER_GOODBYE_PAD_SECONDS = 0.6

TOOLS: list[dict] = [
    {
        "type": "function",
        "name": "check_availability",
        "description": "Find open appointment times. Use the caller's words: a specific date if they gave one, and/or a part of the day.",
        "parameters": {
            "type": "object",
            "properties": {
                "date": {"type": "string", "description": "YYYY-MM-DD in the business's timezone; omit for the next open days."},
                "part_of_day": {"type": "string", "enum": ["morning", "afternoon", "evening"]},
            },
        },
    },
    {
        "type": "function",
        "name": "book_appointment",
        "description": "Book an open time for the caller. Only after they chose a time from check_availability and you confirmed their full name.",
        "parameters": {
            "type": "object",
            "properties": {
                "date": {"type": "string", "description": "YYYY-MM-DD"},
                "time": {"type": "string", "description": "HH:MM, 24-hour, exactly as returned by check_availability"},
                "first_name": {"type": "string"},
                "last_name": {"type": "string"},
                "email": {"type": "string", "description": "Only if the caller offered it."},
                "phone": {"type": "string", "description": "Only if they want a number other than the one they are calling from."},
            },
            "required": ["date", "time", "first_name"],
        },
    },
    {
        "type": "function",
        "name": "find_my_appointments",
        "description": "Look up the caller's upcoming appointments by the phone number they are calling from (or the number they give).",
        "parameters": {"type": "object", "properties": {"phone": {"type": "string", "description": "Only if they booked with a different number."}}},
    },
    {
        "type": "function",
        "name": "reschedule_appointment",
        "description": "Move one of the caller's appointments (from find_my_appointments) to an open time (from check_availability).",
        "parameters": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "string"},
                "date": {"type": "string", "description": "YYYY-MM-DD"},
                "time": {"type": "string", "description": "HH:MM, 24-hour"},
                "phone": {"type": "string"},
            },
            "required": ["appointment_id", "date", "time"],
        },
    },
    {
        "type": "function",
        "name": "cancel_appointment",
        "description": "Cancel one of the caller's appointments (from find_my_appointments), after they confirmed which one.",
        "parameters": {
            "type": "object",
            "properties": {"appointment_id": {"type": "string"}, "phone": {"type": "string"}},
            "required": ["appointment_id"],
        },
    },
    {
        "type": "function",
        "name": "take_message",
        "description": "Pass a message to the team - for anything you cannot do yourself, questions you cannot answer, or when they want a callback.",
        "parameters": {
            "type": "object",
            "properties": {
                "message": {"type": "string"},
                "caller_name": {"type": "string"},
                "callback_number": {"type": "string"},
                "urgent": {"type": "boolean"},
            },
            "required": ["message"],
        },
    },
    {
        "type": "function",
        "name": "transfer_to_human",
        "description": "Connect the caller to a person on the team, when they ask for one or you cannot help.",
        "parameters": {"type": "object", "properties": {"reason": {"type": "string"}}},
    },
    {
        "type": "function",
        "name": "end_call",
        "description": "Hang up after the conversation is finished and you have said goodbye.",
        "parameters": {"type": "object", "properties": {}},
    },
]


def _email_or_none(value: str | None) -> str | None:
    cleaned = _clean_spoken_email(value or "")
    return cleaned if cleaned and _looks_like_valid_email(cleaned) else None


async def open_openai_socket():
    """Server-to-server Realtime connection."""
    from websockets.asyncio.client import connect

    return await connect(
        f"{settings.OPENAI_REALTIME_URL}?model={settings.OPENAI_REALTIME_MODEL}",
        additional_headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
        max_size=None,
        open_timeout=8,
    )


async def choose_voice_engine(db, user_id: str | None) -> str:
    """Realtime unless the business picked the classic voice, or there is no OpenAI key."""
    if not settings.OPENAI_API_KEY:
        return "classic"
    from app.services.smartflow.ai_call_settings_service import AICallSettingsService

    service = AICallSettingsService(db)
    organization_id = await service._resolve_organization_id(user_id) if user_id and user_id != "guest" else None
    call_settings = await service.get_settings_for_organization(organization_id)
    return "classic" if call_settings.get("voice_engine") == "classic" else "realtime"


class RealtimeReceptionist(AIPhoneAgent):
    def __init__(
        self,
        call_id: str,
        ai_service,
        flow_service,
        *,
        call_log: dict | None = None,
        open_socket: Callable[[], Awaitable[Any]] | None = None,
        call_control=None,
        is_simulation: bool = False,
    ) -> None:
        super().__init__(call_id, ai_service, flow_service, is_simulation=is_simulation)
        from app.services.call_service import CallService

        self.call_log = call_log or {}
        self._open_socket = open_socket or open_openai_socket
        self.call_control = call_control or CallService()
        self.openai = None
        self._connect_lock = asyncio.Lock()
        self.reader_task: asyncio.Task | None = None
        self.ai_actions: list[dict] = []
        self.assistant_item_id: str | None = None
        self.audio_first_sent_at: float | None = None
        self.audio_ms_sent = 0
        self.playout_ends_at = 0.0
        self.pending_hangup = False
        self.transferring = False
        self.closed = False
        self.sim_history: list[dict] = []

    # ── state the classic media loop also reads ───────────────────────────────
    @property
    def is_speaking(self) -> bool:  # type: ignore[override]
        # Telnyx plays queued audio in real time; we are "speaking" until it has all
        # played. The outbound keepalive must not slip silence into the middle of it.
        return time.monotonic() < self.playout_ends_at

    @is_speaking.setter
    def is_speaking(self, _value: bool) -> None:  # the base __init__ assigns it
        pass

    # ── session ───────────────────────────────────────────────────────────────
    async def connect(self) -> bool:
        """Open the OpenAI session and configure it. False means: use the classic agent."""
        async with self._connect_lock:
            if self.openai is not None:
                return True
            try:
                socket = await self._open_socket()
                call_settings = await self._get_call_settings()
                await socket.send(json.dumps({"type": "session.update", "session": await self.session_config(call_settings)}))
                self.openai = socket
                return True
            except Exception:
                logger.warning("Call %s: Realtime session could not start - falling back to classic", self.call_id, exc_info=True)
                return False

    async def session_config(self, call_settings: dict) -> dict:
        preset = self.ai_service._resolve_voice_preset(call_settings.get("voice_id"))
        return {
            "type": "realtime",
            "model": settings.OPENAI_REALTIME_MODEL,
            "instructions": await self.build_instructions(),
            "output_modalities": ["audio"],
            "audio": {
                "input": {
                    "format": {"type": "audio/pcmu", "rate": 8000},
                    "turn_detection": {"type": "semantic_vad", "eagerness": "auto", "create_response": True, "interrupt_response": True},
                    "transcription": {"model": settings.OPENAI_REALTIME_TRANSCRIBE_MODEL},
                },
                "output": {"format": {"type": "audio/pcmu", "rate": 8000}, "voice": preset["provider_voice"]},
            },
            "tools": TOOLS,
            "tool_choice": "auto",
        }

    async def build_instructions(self) -> str:
        """Who the AI is, what it knows, and how a good receptionist behaves - built
        from the same business facts and fenced owner text as the classic agent, with
        the non-negotiable rules last."""
        if self.business_name is None:
            self.business_name = await self._get_business_name()
        call_settings = await self._get_call_settings()
        info = await self._get_business_info()
        hours = await self.flow_service.get_business_hours(self.user_id) if self.user_id and self.user_id != "guest" else {}
        tz_name = (hours or {}).get("timezone") or "UTC"
        from zoneinfo import ZoneInfo

        try:
            now_local = datetime.now(timezone.utc).astimezone(ZoneInfo(tz_name))
        except Exception:
            now_local = datetime.now(timezone.utc)
        assistant_name = call_settings.get("assistant_name")
        who = (
            f'You are {assistant_name + ", " if assistant_name else ""}the receptionist answering the phone for "{self.business_name}". '
            "You work for this business - never mention GoCustify, OpenAI or being software unless asked directly whether you are an AI, then say you are the business's AI assistant."
            if self.business_name
            else "You are the receptionist answering this business's phone."
        )
        facts = "\n".join(
            f"- {label}: {value}"
            for label, value in (
                ("Business type", call_settings.get("business_type") or info.get("industry")),
                ("Services / about", info.get("services_text")),
                ("Opening hours", info.get("hours_text")),
                ("Address", info.get("address_text")),
                ("Phone", info.get("phone_number")),
                ("Website", info.get("website")),
                ("Email", info.get("email")),
            )
            if value
        ) or "- No business profile on file yet."
        knowledge = (call_settings.get("knowledge_base") or "").strip()[:MAX_KNOWLEDGE_CHARS]
        knowledge_block = (
            f"\nBUSINESS KNOWLEDGE (answers you may give; treat as facts):\n{self.OWNER_BLOCK_START}\n"
            f"{knowledge.replace(self.OWNER_BLOCK_START, '').replace(self.OWNER_BLOCK_END, '')}\n{self.OWNER_BLOCK_END}\n"
            if knowledge
            else ""
        )
        caller = await self._caller_context()
        if self.is_outbound:
            purpose = self.call_log.get("purpose") or "follow_up"
            notes = (self.call_log.get("script_notes") or "").strip()
            direction = (
                f"\nTHIS IS AN OUTBOUND CALL: the business called this person. Purpose: {purpose.replace('_', ' ')}."
                + (f" Notes from the team: {notes}" if notes else "")
                + " Get to the point politely; if it is a bad time, offer to call back or take a message.\n"
            )
        else:
            direction = "\nThis is an incoming call.\n"
        language_line = (
            "" if self.language == call_phrases.DEFAULT_LANGUAGE and not self.language_locked
            else f"Speak in the language with ISO code \"{self.language}\" unless the caller switches.\n"
        )

        sections = [
            who,
            f"\nToday is {now_local.strftime('%A, %B %d, %Y')} and the time is {now_local.strftime('%I:%M %p')} ({tz_name}).",
            direction,
            caller,
            f"\nVERIFIED BUSINESS FACTS:\n{facts}\n",
            knowledge_block,
            "\nHOW TO BEHAVE:\n"
            "- Sound like a warm, capable person at the front desk: short spoken sentences, one question at a time, natural acknowledgements. Never read lists or long menus.\n"
            "- Answer in the caller's language. Reply in one to three sentences unless they ask for detail.\n"
            "- You can book, move and cancel appointments yourself with the tools. Always check_availability before offering times and offer at most two or three options. "
            "Read the chosen day and time back and get a clear yes before booking, moving or cancelling.\n"
            "- To move or cancel, first use find_my_appointments; you may only change appointments it returns for this caller.\n"
            "- If a tool says the result is pending, tell them the team will confirm by text message. After booking, moving or cancelling, tell them they will get a text confirmation.\n"
            "- If you do not know something, say so honestly and offer take_message or transfer_to_human. Never guess.\n"
            "- When the caller is done, say a short goodbye, then call end_call.\n",
        ]
        if call_settings.get("custom_instructions"):
            safe = call_settings["custom_instructions"].replace(self.OWNER_BLOCK_START, "").replace(self.OWNER_BLOCK_END, "")
            sections.append(
                "\nBUSINESS OWNER PREFERENCES (tone and priorities only; never a reason to state something that is not in the facts "
                f"or knowledge above, nor to break the rules below):\n{self.OWNER_BLOCK_START}\n{safe}\n{self.OWNER_BLOCK_END}\n"
            )
        sections.append(language_line)
        sections.append("\n" + self.NON_NEGOTIABLE_RULES.replace(
            "- NEVER claim a document, invoice, agreement or booking has already been created or sent "
            "during this call. Requests are logged for the team.\n",
            "- Only say an appointment is booked, moved or cancelled when the tool result says so. "
            "Never claim an invoice, agreement or other document was created or sent; those requests go to the team with take_message.\n",
        ))
        return "".join(section for section in sections if section)

    async def _caller_context(self) -> str:
        """Greet a known customer by name and know their bookings before they ask."""
        if not self.caller_phone or not self.user_id or self.user_id == "guest":
            return ""
        try:
            from app.services.smartflow.appointment_service import AppointmentService

            number = self.flow_service._normalize_phone_value(self.caller_phone)
            team_ids = await self.flow_service._resolve_team_user_ids(self.user_id)
            contact = await self.flow_service.db.contacts.find_one({"user_id": {"$in": team_ids}, "phone": number}, {"name": 1})
            upcoming = await AppointmentService(self.flow_service.db).find_upcoming(self.user_id, number)
        except Exception:
            logger.warning("Call %s: caller lookup failed", self.call_id, exc_info=True)
            return ""
        lines = []
        name = (contact or {}).get("name")
        if name and not name.endswith(" Contact"):
            lines.append(f"The caller's number belongs to a known customer: {name}. Confirm it is them before using their name.")
        if upcoming["appointments"]:
            lines.append("Their upcoming appointments: " + "; ".join(item["when"] for item in upcoming["appointments"]) + ".")
        return ("\nCALLER:\n" + "\n".join(lines) + "\n") if lines else ""

    # ── call flow ─────────────────────────────────────────────────────────────
    async def start(self, send_callback: Callable[[dict], Awaitable[None]]) -> None:
        self.send_callback = send_callback
        self.reader_task = asyncio.create_task(self._read_openai())
        await self._say_greeting()

    async def _say_greeting(self, *, use_custom: bool = True) -> None:
        text = await self._compose_greeting_text(use_custom=use_custom)
        self.greeting_in_progress = True
        self.transcript_log.append({"speaker": "ai", "text": text})
        # The greeting carries the legally required recording disclosure, so it is
        # spoken word for word rather than paraphrased by the model.
        await self._send_openai(
            {
                "type": "response.create",
                "response": {"instructions": f'Say exactly the following, naturally and warmly, then stop and listen: "{text}"'},
            }
        )

    async def on_caller_audio(self, payload_base64: str) -> None:
        # The caller's "Hello?" while the greeting (with its disclosure) is playing is
        # not a request; letting it through made the model cut its own disclosure short.
        if self.greeting_in_progress or self.transferring or self.closed:
            return
        await self._send_openai({"type": "input_audio_buffer.append", "audio": payload_base64})

    async def acknowledge_language_switch(self) -> None:
        """Keypad language choice: re-brief the model and greet again in that language."""
        if self.openai is None or self.send_callback is None:
            return
        await self._interrupt_playback()
        await self._send_openai({"type": "response.cancel"})
        await self._send_openai({"type": "session.update", "session": {"type": "realtime", "instructions": await self.build_instructions()}})
        await self._say_greeting(use_custom=False)

    async def _send_openai(self, event: dict) -> None:
        if self.openai is None or self.closed:
            return
        try:
            await self.openai.send(json.dumps(event))
        except Exception:
            logger.warning("Call %s: could not send %s to OpenAI", self.call_id, event.get("type"), exc_info=True)

    async def _send_telnyx(self, message: dict) -> None:
        if self.send_callback is not None:
            await self.send_callback(message)

    async def _interrupt_playback(self) -> None:
        """Caller started talking: stop what Telnyx still has queued (it plays in real
        time, so without this the AI keeps talking over them), and tell the model how
        much of its answer was actually heard."""
        if self.assistant_item_id and self.audio_first_sent_at is not None:
            played_ms = min(self.audio_ms_sent, int((time.monotonic() - self.audio_first_sent_at) * 1000))
            await self._send_telnyx({"event": "clear"})
            await self._send_openai(
                {"type": "conversation.item.truncate", "item_id": self.assistant_item_id, "content_index": 0, "audio_end_ms": max(0, played_ms)}
            )
        self.assistant_item_id = None
        self.audio_first_sent_at = None
        self.audio_ms_sent = 0
        self.playout_ends_at = 0.0

    async def _read_openai(self) -> None:
        try:
            async for raw in self.openai:
                try:
                    event = json.loads(raw)
                except (TypeError, ValueError):
                    continue
                await self._handle_event(event)
        except asyncio.CancelledError:
            raise
        except Exception:
            if not self.closed:
                logger.warning("Call %s: Realtime session ended unexpectedly", self.call_id, exc_info=True)

    async def _handle_event(self, event: dict) -> None:
        kind = event.get("type")
        if kind == "response.output_audio.delta":
            delta = event.get("delta") or ""
            if not delta:
                return
            now = time.monotonic()
            if event.get("item_id") != self.assistant_item_id:
                self.assistant_item_id = event.get("item_id")
                self.audio_first_sent_at = now
                self.audio_ms_sent = 0
            chunk_ms = (len(delta) * 3 // 4) // PCMU_BYTES_PER_MS
            self.audio_ms_sent += chunk_ms
            self.playout_ends_at = max(self.playout_ends_at, now) + chunk_ms / 1000
            # Only "event" and "media" - Telnyx drops the stream on any extra key.
            await self._send_telnyx({"event": "media", "media": {"payload": delta}})
        elif kind == "input_audio_buffer.speech_started":
            await self._interrupt_playback()
        elif kind == "conversation.item.input_audio_transcription.completed":
            text = (event.get("transcript") or "").strip()
            if text:
                self.transcript_log.append({"speaker": "customer", "text": text})
                await self._save_progress()
        elif kind == "response.output_audio_transcript.done":
            text = (event.get("transcript") or "").strip()
            if text and not self.greeting_in_progress:
                self.transcript_log.append({"speaker": "ai", "text": text})
                await self._save_progress()
        elif kind == "response.done":
            await self._on_response_done(event.get("response") or {})
        elif kind == "error":
            logger.warning("Call %s: Realtime error: %s", self.call_id, (event.get("error") or {}).get("message"))

    async def _on_response_done(self, response: dict) -> None:
        if self.greeting_in_progress:
            self.greeting_in_progress = False
            # Drop anything captured while the greeting played.
            await self._send_openai({"type": "input_audio_buffer.clear"})
        calls = [item for item in response.get("output") or [] if item.get("type") == "function_call"]
        for item in calls:
            result = await self.run_tool(item.get("name") or "", item.get("arguments") or "{}")
            await self._send_openai(
                {"type": "conversation.item.create", "item": {"type": "function_call_output", "call_id": item.get("call_id"), "output": json.dumps(result)}}
            )
        if calls and not self.transferring:
            await self._send_openai({"type": "response.create"})
            return
        if self.pending_hangup and not calls:
            # The goodbye is queued at Telnyx; hang up once it has played.
            delay = max(0.0, self.playout_ends_at - time.monotonic()) + HANGUP_AFTER_GOODBYE_PAD_SECONDS
            asyncio.create_task(self._hangup_after(delay))

    async def _hangup_after(self, delay: float) -> None:
        await asyncio.sleep(delay)
        await self.call_control.hangup_call(self.call_id)

    # ── tools ─────────────────────────────────────────────────────────────────
    async def run_tool(self, name: str, arguments: str) -> dict:
        try:
            args = json.loads(arguments or "{}") if isinstance(arguments, str) else dict(arguments or {})
        except ValueError:
            args = {}
        # "Test AI": same tools, but nothing is booked, sent or transferred for real.
        handler = (getattr(self, f"_sim_{name}", None) if self.is_simulation else None) or getattr(self, f"_tool_{name}", None)
        if handler is None:
            result = {"error": f"Unknown action {name}."}
        else:
            try:
                result = await handler(**{key: value for key, value in args.items() if isinstance(key, str)})
            except TypeError:
                result = {"error": "Missing or invalid details for that action."}
            except Exception:
                logger.exception("Call %s: tool %s failed", self.call_id, name)
                result = {"error": "That did not work. Apologise and offer to take a message for the team."}
        self.ai_actions.append({"tool": name, "arguments": args, "result": result, "at": utc_now().isoformat()})
        await self._save_progress()
        return result

    def _appointments(self):
        from app.services.smartflow.appointment_service import AppointmentService

        return AppointmentService(self.flow_service.db)

    async def _tool_check_availability(self, date: str | None = None, part_of_day: str | None = None) -> dict:
        return await self._appointments().available_slots(self.user_id, day=date, part_of_day=part_of_day)

    async def _tool_book_appointment(self, date: str, time: str, first_name: str, last_name: str = "", email: str | None = None, phone: str | None = None) -> dict:
        name = f"{first_name} {last_name}".strip()
        self.caller_name = name
        return await self._appointments().book(
            self.user_id,
            name=name,
            phone=phone or self.caller_phone,
            email=_email_or_none(email),
            day=date,
            time=time,
            call_sid=self.call_id,
            language=self.language,
        )

    async def _tool_find_my_appointments(self, phone: str | None = None) -> dict:
        return await self._appointments().find_upcoming(self.user_id, phone or self.caller_phone)

    async def _tool_reschedule_appointment(self, appointment_id: str, date: str, time: str, phone: str | None = None) -> dict:
        return await self._appointments().reschedule(
            self.user_id, appointment_id=appointment_id, phone=phone or self.caller_phone, day=date, time=time,
            call_sid=self.call_id, language=self.language,
        )

    async def _tool_cancel_appointment(self, appointment_id: str, phone: str | None = None) -> dict:
        return await self._appointments().cancel(self.user_id, appointment_id=appointment_id, phone=phone or self.caller_phone)

    async def _tool_take_message(self, message: str, caller_name: str | None = None, callback_number: str | None = None, urgent: bool = False) -> dict:
        from app.utils.helpers import resolve_organization_user_ids

        entry = {
            "intent": "message",
            "transcript": message[:1000],
            "caller_name": caller_name,
            "callback_number": callback_number or self.caller_phone,
            "urgent": bool(urgent),
            "timestamp": utc_now().isoformat(),
        }
        self.captured_requests.append(entry)
        organization_id = await self.flow_service._resolve_organization_id(self.user_id) if self.user_id != "guest" else None
        recipients = await resolve_organization_user_ids(self.flow_service.db, organization_id) if organization_id else [self.user_id]
        for member_id in recipients or []:
            try:
                await self.flow_service.create_notification(
                    user_id=member_id,
                    notification_type="call",
                    title=("Urgent message" if urgent else "Message") + f" from {caller_name or entry['callback_number'] or 'a caller'}",
                    body=message[:300],
                    metadata={"call_sid": self.call_id, "callback_number": entry["callback_number"]},
                )
            except Exception:
                continue
        return {"saved": True, "note": "Tell the caller the team has the message and will get back to them."}

    async def _tool_transfer_to_human(self, reason: str | None = None) -> dict:
        call_settings = await self._get_call_settings()
        target = call_settings.get("transfer_number")
        if not target and self.user_id and self.user_id != "guest":
            from bson import ObjectId

            owner = await self.flow_service.db.users.find_one({"_id": ObjectId(self.user_id)}, {"forwarding_number": 1}) if ObjectId.is_valid(self.user_id) else None
            target = (owner or {}).get("forwarding_number")
        if not target:
            return {"transferred": False, "note": "Nobody is available to take the call. Offer to take a message instead."}
        self.transferring = True
        await self._interrupt_playback()
        ok = await self.call_control.transfer_call(self.call_id, to_number=target)
        if not ok:
            self.transferring = False
            return {"transferred": False, "note": "The transfer failed. Apologise and offer to take a message."}
        return {"transferred": True}

    async def _tool_end_call(self) -> dict:
        self.pending_hangup = True
        return {"ok": True, "note": "Say one short goodbye sentence now."}

    # ── Test AI (text) ────────────────────────────────────────────────────────
    async def simulate_turn(self, text: str) -> str:
        """One typed turn of the owner's "Test AI" preview: the same briefing and tools
        as a real call, answered as text, with every action in dry-run."""
        if not self.sim_history:
            self.sim_history.append({"role": "system", "content": await self.build_instructions()})
            greeting = await self._compose_greeting_text()
            self.sim_history.append({"role": "assistant", "content": greeting})
        self.sim_history.append({"role": "user", "content": text})
        chat_tools = [
            {"type": "function", "function": {key: tool[key] for key in ("name", "description", "parameters")}} for tool in TOOLS
        ]
        for _ in range(4):  # a turn may chain a few tool calls before it speaks
            message = await self._chat(self.sim_history, chat_tools)
            calls = message.get("tool_calls") or []
            self.sim_history.append({"role": "assistant", "content": message.get("content"), **({"tool_calls": calls} if calls else {})})
            if not calls:
                return (message.get("content") or "").strip()
            for call in calls:
                result = await self.run_tool(call["function"]["name"], call["function"].get("arguments") or "{}")
                self.sim_history.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(result)})
        return "Sorry, could you say that again?"

    async def _chat(self, messages: list[dict], tools: list[dict]) -> dict:
        from app.services.gocustify_ai_service import _get_async_openai_client

        response = await _get_async_openai_client().chat.completions.create(
            model=settings.OPENAI_MODEL, messages=messages, tools=tools, tool_choice="auto"
        )
        return response.choices[0].message.model_dump(exclude_none=True)

    async def _sim_book_appointment(self, date: str, time: str, first_name: str, last_name: str = "", **_: Any) -> dict:
        start = await self._appointments().calendar.localize_business_slot(self.user_id, date, time)
        hours = await self.flow_service.get_business_hours(self.user_id)
        from app.services.smartflow.appointment_notifications import format_when

        return {"outcome": "booked", "when": format_when(start, hours.get("timezone")), "test_mode": "nothing was booked"}

    async def _sim_reschedule_appointment(self, appointment_id: str, date: str, time: str, **_: Any) -> dict:
        booked = await self._sim_book_appointment(date, time, "")
        return {"outcome": "rescheduled", "when": booked["when"], "test_mode": "nothing was changed"}

    async def _sim_cancel_appointment(self, appointment_id: str, **_: Any) -> dict:
        return {"outcome": "cancelled", "test_mode": "nothing was cancelled"}

    async def _sim_take_message(self, message: str, **_: Any) -> dict:
        return {"saved": True, "test_mode": "no one was notified"}

    async def _sim_transfer_to_human(self, reason: str | None = None) -> dict:
        target = (await self._get_call_settings()).get("transfer_number")
        return {"transferred": bool(target), "test_mode": f"would transfer to {target}" if target else "no transfer number is set; offer to take a message"}

    async def _sim_end_call(self) -> dict:
        self.should_hangup = True
        return {"ok": True}

    # ── records ───────────────────────────────────────────────────────────────
    async def _save_progress(self) -> None:
        if self.is_simulation or not self.user_id:
            return
        await self.flow_service.db.call_logs.update_one(
            {"twilio_call_sid": self.call_id},
            {"$set": {
                "speaker_segments": self.transcript_log,
                "captured_requests": self.captured_requests,
                "ai_actions": self.ai_actions,
                "voice_engine": "realtime",
                "updated_at": utc_now(),
            }},
        )

    async def close(self) -> None:
        self.closed = True
        if self.reader_task:
            self.reader_task.cancel()
        if self.openai is not None:
            try:
                await self.openai.close()
            except Exception:
                pass
        await self.finalize_session()
