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

DISPOSITIONS_BY_TOOL = {
    "book_appointment": "booked",
    "reschedule_appointment": "rescheduled",
    "cancel_appointment": "cancelled",
    "transfer_to_human": "transferred",
    "take_message": "message_taken",
    "notify_team": "message_taken",
}
# When a call did more than one of these, the most consequential one wins (e.g. a
# caller who got transferred after a failed booking attempt is "transferred", not
# "booked", since the booking never actually went through).
DISPOSITION_PRIORITY = ["booked", "rescheduled", "cancelled", "transferred", "message_taken"]


def _derive_call_disposition(ai_actions: list[dict] | None) -> str:
    """A reportable outcome category for the call, derived from which tools actually
    succeeded - not just which were called, since a failed booking attempt (slot taken,
    no match found) shouldn't be reported as a booking. Falls back to "faq_only" (the
    call connected and the AI talked, but took no recordable action) when nothing
    qualifies, so every answered call gets a disposition."""
    achieved: set[str] = set()
    for action in ai_actions or []:
        tool = action.get("tool")
        disposition = DISPOSITIONS_BY_TOOL.get(tool)
        if not disposition:
            continue
        result = action.get("result") or {}
        if tool in ("book_appointment", "reschedule_appointment", "cancel_appointment"):
            outcome = result.get("outcome")
            if outcome not in ("booked", "rescheduled", "cancelled", "pending", "pending_cancellation"):
                continue
        elif tool == "transfer_to_human" and not result.get("transferred"):
            continue
        achieved.add(disposition)
    for candidate in DISPOSITION_PRIORITY:
        if candidate in achieved:
            return candidate
    return "faq_only"


PCMU_BYTES_PER_MS = 8  # 8 kHz, one byte per sample
MAX_KNOWLEDGE_CHARS = 8000
MAX_POLICY_CHARS = 500
HANGUP_AFTER_GOODBYE_PAD_SECONDS = 0.6
SESSION_HANDSHAKE_SECONDS = 4.0
GREETING_MAX_SECONDS = 30.0  # a greeting that never reports done must not mute the caller all call
WATCH_INTERVAL_SECONDS = 2.0
HARD_STOP_GRACE_SECONDS = 20.0

TOOLS: list[dict] = [
    {
        "type": "function",
        "name": "check_availability",
        "description": "Find open appointment times. Use the caller's words: a specific date if they gave one, and/or a part of the day. If the business has named providers or appointment types (see PROVIDERS/APPOINTMENT TYPES above), ask which one and pass it here.",
        "parameters": {
            "type": "object",
            "properties": {
                "date": {"type": "string", "description": "YYYY-MM-DD in the business's timezone; omit for the next open days."},
                "part_of_day": {"type": "string", "enum": ["morning", "afternoon", "evening"]},
                "provider": {"type": "string", "description": "Exactly one name from PROVIDERS above, if the caller named or chose one."},
                "appointment_type": {"type": "string", "description": "Exactly one name from APPOINTMENT TYPES above, if the caller said what kind of visit."},
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
                "provider": {"type": "string", "description": "Same provider name used in check_availability, if any."},
                "appointment_type": {"type": "string", "description": "Same appointment type used in check_availability, if any."},
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
        "name": "notify_team",
        "description": "Alert the business's team about something from this call - only when a PLAYBOOK above names who to notify (e.g. dispatch an on-call technician, flag a new client lead). Not for a caller wanting a callback; use take_message for that.",
        "parameters": {
            "type": "object",
            "properties": {
                "note": {"type": "string", "description": "What the team needs to know: the situation, address, issue, requested by."},
                "playbook": {"type": "string", "description": "The playbook name this came from."},
            },
            "required": ["note"],
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


LANGUAGE_PROPERTY = {
    "type": "string",
    "enum": list(call_phrases.SUPPORTED_LANGUAGES),
    "description": "ISO code of the language the caller has been speaking on this call; the confirmation text is sent in it.",
}
for _tool in TOOLS:
    if _tool["name"] in ("book_appointment", "reschedule_appointment", "cancel_appointment"):
        _tool["parameters"]["properties"]["language"] = LANGUAGE_PROPERTY


def _email_or_none(value: str | None) -> str | None:
    cleaned = _clean_spoken_email(value or "")
    return cleaned if cleaned and _looks_like_valid_email(cleaned) else None


def audio_session_config(voice: str) -> dict:
    """Telephony audio: G.711 mu-law both ways. The API rejects a ``rate`` on
    audio/pcmu (unlike audio/pcm) - verified against the live API; a rejected
    session.update leaves the session on its 24 kHz PCM default, which Telnyx would
    play as static."""
    pcmu = {"type": "audio/pcmu"}
    return {
        "input": {
            "format": pcmu,
            "turn_detection": {"type": "semantic_vad", "eagerness": "auto", "create_response": True, "interrupt_response": True},
            "transcription": {"model": settings.OPENAI_REALTIME_TRANSCRIBE_MODEL},
            # Phone handsets: trims line noise and echo that would otherwise trip the
            # "caller is speaking" detector and cut the AI off.
            "noise_reduction": {"type": "near_field"},
        },
        "output": {"format": pcmu, "voice": voice},
    }


async def open_openai_socket():
    """Server-to-server Realtime connection."""
    from websockets.asyncio.client import connect

    return await connect(
        f"{settings.OPENAI_REALTIME_URL}?model={settings.OPENAI_REALTIME_MODEL}",
        additional_headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
        max_size=None,
        open_timeout=4,
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
        # Only one response may be in flight: a second response.create is rejected, so
        # requests made while one is active wait for it to finish.
        self.response_active = False
        self._queued_response: tuple[dict, bool] | None = None
        self._last_dispatched: tuple[dict, bool] | None = None
        self._expect_greeting_response = False
        self.greeting_response_id: str | None = None
        self.greeting_started_at = 0.0
        self.call_started_at = self.last_activity = time.monotonic()
        self.idle_prompted = False
        self._goodbye_requested = False
        self._hangup_scheduled = False
        self.watch_task: asyncio.Task | None = None
        self._tasks: set[asyncio.Task] = set()

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
            socket = None
            try:
                socket = await self._open_socket()
                call_settings = await self._get_call_settings()
                await socket.send(json.dumps({"type": "session.update", "session": await self.session_config(call_settings)}))
                # Only go live once OpenAI has accepted the configuration. A rejected
                # session.update used to be ignored, so the call ran on the default audio
                # format with no instructions or tools.
                await self._await_session_ready(socket)
                self.openai = socket
                return True
            except Exception:
                logger.warning("Call %s: Realtime session could not start - falling back to classic", self.call_id, exc_info=True)
                if socket is not None:
                    try:
                        await socket.close()
                    except Exception:
                        pass
                return False

    @staticmethod
    async def _await_session_ready(socket) -> None:
        async with asyncio.timeout(SESSION_HANDSHAKE_SECONDS):
            while True:
                event = json.loads(await socket.recv())
                kind = event.get("type")
                if kind == "session.updated":
                    return
                if kind == "error":
                    raise RuntimeError(f"OpenAI rejected the session: {(event.get('error') or {}).get('message')}")

    async def session_config(self, call_settings: dict) -> dict:
        preset = self.ai_service._resolve_voice_preset(call_settings.get("voice_id"))
        return {
            "type": "realtime",
            "model": settings.OPENAI_REALTIME_MODEL,
            "instructions": await self.build_instructions(),
            "output_modalities": ["audio"],
            "audio": audio_session_config(preset["provider_voice"]),
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
        policy = (call_settings.get("cancellation_policy") or "").strip()[:MAX_POLICY_CHARS]
        policy_block = (
            f"\nCANCELLATION POLICY - tell the caller this if they ask to cancel, before you cancel for them:\n"
            f"{self.OWNER_BLOCK_START}\n{policy.replace(self.OWNER_BLOCK_START, '').replace(self.OWNER_BLOCK_END, '')}\n{self.OWNER_BLOCK_END}\n"
            if policy
            else ""
        )
        providers_block = ""
        ask_provider_line = ""
        playbooks_block = ""
        if self.user_id and self.user_id != "guest":
            providers = await self._providers().list_providers(self.user_id, active_only=True)
            appointment_types = await self._providers().list_appointment_types(self.user_id, active_only=True)
            lines = []
            if providers:
                lines.append("PROVIDERS: " + ", ".join(p["name"] + (f" ({p['role_title']})" if p.get("role_title") else "") for p in providers))
            if appointment_types:
                lines.append("APPOINTMENT TYPES: " + ", ".join(f"{t['name']} ({t['duration_minutes']} min)" for t in appointment_types))
            if lines:
                providers_block = "\n" + "\n".join(lines) + "\n"
                ask_provider_line = (
                    "- This business has named providers and/or appointment types listed above. Ask which one the caller wants "
                    "(or offer the choices) before check_availability, and pass the exact name through.\n"
                )

            # Named playbooks the owner set up: guidance the model follows with judgement,
            # not a rigid script it recites - same spirit as a written office procedure.
            rules = [rule for rule in (call_settings.get("call_routing_rules") or []) if rule.get("active", True)]
            if rules:
                provider_names = {p["id"]: p["name"] for p in providers}
                type_names = {t["id"]: t["name"] for t in appointment_types}
                playbook_lines = []
                for index, rule in enumerate(rules, start=1):
                    parts = [f"{index}. {rule.get('name')} - when: {rule.get('trigger_description')}"]
                    questions = rule.get("questions_to_ask") or []
                    if questions:
                        parts.append("   Ask: " + " | ".join(questions))
                    booking_bits = []
                    if provider_names.get(rule.get("provider_id")):
                        booking_bits.append(f"provider {provider_names[rule['provider_id']]}")
                    if type_names.get(rule.get("appointment_type_id")):
                        booking_bits.append(f"type {type_names[rule['appointment_type_id']]}")
                    if booking_bits:
                        parts.append("   Book with: " + ", ".join(booking_bits))
                    if rule.get("notify_target"):
                        parts.append(f"   Notify: {rule['notify_target']} (use notify_team)")
                    if rule.get("crm_note"):
                        parts.append(f"   Note: {rule['crm_note']}")
                    playbook_lines.append("\n".join(parts))
                playbooks_block = (
                    "\nCALL PLAYBOOKS - match what the caller needs to one of these. Ask its questions before booking, "
                    "use its provider/appointment type with check_availability and book_appointment, and call notify_team "
                    "if it names someone to notify. If nothing matches, use your own judgement as usual.\n"
                    + "\n".join(playbook_lines) + "\n"
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
            providers_block,
            playbooks_block,
            knowledge_block,
            policy_block,
            "\nHOW TO BEHAVE:\n"
            "- Sound like a warm, capable person at the front desk: short spoken sentences, one question at a time, natural acknowledgements. Never read lists or long menus.\n"
            "- Answer in the caller's language. Reply in one to three sentences unless they ask for detail.\n"
            "- You can book, move and cancel appointments yourself with the tools. Always check_availability before offering times and offer at most two or three options. "
            "Read the chosen day and time back and get a clear yes before booking, moving or cancelling.\n"
            f"{ask_provider_line}"
            "- To move or cancel, first use find_my_appointments; you may only change appointments it returns for this caller.\n"
            "- If a tool says the result is pending, tell them the team will confirm by text message. After booking, moving or cancelling, tell them they will get a text confirmation.\n"
            "- If you do not know something, say so honestly and offer take_message or transfer_to_human. Never guess.\n"
            "- If booking, moving or cancelling comes back unavailable or not possible, say so plainly and offer other times with check_availability.\n"
            "- Pass the language field (the language the caller is speaking) when you book, move or cancel, so the confirmation text matches.\n"
            "- Before calling transfer_to_human, tell the caller you are connecting them to a person.\n"
            "- When the caller is done, say a short goodbye in that same turn, then call end_call.\n",
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
    def _spawn(self, coro) -> asyncio.Task:
        task = asyncio.create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return task

    async def start(self, send_callback: Callable[[dict], Awaitable[None]]) -> None:
        self.send_callback = send_callback
        self.call_started_at = self.last_activity = time.monotonic()
        self.reader_task = asyncio.create_task(self._read_openai())
        self.watch_task = asyncio.create_task(self._watch_call())
        await self._say_greeting()

    async def _say_greeting(self, *, use_custom: bool = True) -> None:
        text = await self._compose_greeting_text(use_custom=use_custom)
        self.transcript_log.append({"speaker": "ai", "text": text})
        # The greeting carries the legally required recording disclosure, so it is
        # spoken word for word rather than paraphrased by the model.
        await self._request_response(
            {
                "type": "response.create",
                "response": {"instructions": f'Say exactly the following, naturally and warmly, then stop and listen: "{text}"'},
            },
            greeting=True,
        )

    async def on_caller_audio(self, payload_base64: str) -> None:
        if self.greeting_in_progress and time.monotonic() - self.greeting_started_at > GREETING_MAX_SECONDS:
            logger.warning("Call %s: greeting never finished; listening to the caller anyway", self.call_id)
            self.greeting_in_progress = False
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
        if self.response_active:
            await self._send_openai({"type": "response.cancel"})
        await self._send_openai({"type": "session.update", "session": {"type": "realtime", "instructions": await self.build_instructions()}})
        await self._say_greeting(use_custom=False)

    async def _send_openai(self, event: dict) -> bool:
        if self.openai is None or self.closed:
            return False
        try:
            await self.openai.send(json.dumps(event))
            return True
        except Exception:
            logger.warning("Call %s: could not send %s to OpenAI", self.call_id, event.get("type"), exc_info=True)
            return False

    async def _send_telnyx(self, message: dict) -> None:
        if self.send_callback is not None:
            await self.send_callback(message)

    async def _request_response(self, payload: dict | None = None, *, greeting: bool = False) -> None:
        """Ask the model to speak - now if it is idle, otherwise as soon as it is."""
        if greeting:
            self.greeting_in_progress = True
            self.greeting_started_at = time.monotonic()
            self.greeting_response_id = None
        request = (payload or {"type": "response.create"}, greeting)
        if self.response_active:
            queued = self._queued_response
            if queued is None or greeting or (payload is not None and not queued[1]):
                self._queued_response = request
            return
        # A request that was waiting (e.g. the greeting in a newly chosen language)
        # outranks a plain "carry on".
        if self._queued_response is not None and not greeting and payload is None:
            request = self._queued_response
        self._queued_response = None
        await self._dispatch_response(*request)

    async def _dispatch_response(self, payload: dict, greeting: bool) -> None:
        self._expect_greeting_response = greeting
        self.response_active = True
        self._last_dispatched = (payload, greeting)
        if not await self._send_openai(payload):
            self.response_active = False
            self._expect_greeting_response = False

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

    def _note_caller_activity(self) -> None:
        self.last_activity = time.monotonic()
        self.idle_prompted = False

    async def _handle_event(self, event: dict) -> None:
        kind = event.get("type")
        if kind == "response.created":
            self.response_active = True
            if self._expect_greeting_response:
                self.greeting_response_id = (event.get("response") or {}).get("id") or ""
                self._expect_greeting_response = False
        elif kind == "response.output_audio.delta":
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
            self._note_caller_activity()
            await self._interrupt_playback()
        elif kind == "conversation.item.input_audio_transcription.completed":
            self._note_caller_activity()
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
            error = event.get("error") or {}
            if error.get("code") == "conversation_already_has_active_response" and self._last_dispatched:
                # Our request crossed a response the server had already started (the
                # caller spoke during a tool call): run it once that one ends.
                self.response_active = True
                self._expect_greeting_response = False
                if self._queued_response is None:
                    self._queued_response = self._last_dispatched
            logger.warning("Call %s: Realtime error: %s", self.call_id, error.get("message"))

    async def _on_response_done(self, response: dict) -> None:
        self.response_active = False
        if self.greeting_in_progress and self.greeting_response_id is not None and response.get("id") == self.greeting_response_id:
            self.greeting_in_progress = False
            # Drop anything captured while the greeting played.
            await self._send_openai({"type": "input_audio_buffer.clear"})
        calls = [item for item in response.get("output") or [] if item.get("type") == "function_call"]
        if calls:
            # Tools touch the database; run them beside the reader so caller speech and
            # interruptions keep being processed while they work.
            self._spawn(self._run_tool_calls(calls))
            return
        await self._after_response()

    async def _run_tool_calls(self, calls: list[dict]) -> None:
        for item in calls:
            result = await self.run_tool(item.get("name") or "", item.get("arguments") or "{}")
            await self._send_openai(
                {"type": "conversation.item.create", "item": {"type": "function_call_output", "call_id": item.get("call_id"), "output": json.dumps(result)}}
            )
        if self.transferring:
            return
        await self._after_response(reply_to_tools=True)

    async def _after_response(self, *, reply_to_tools: bool = False) -> None:
        if self.pending_hangup:
            await self._finish_call()
            return
        if reply_to_tools or self._queued_response is not None:
            await self._request_response()

    async def _finish_call(self) -> None:
        """Hang up - but only after the goodbye has been said and has finished playing."""
        if self._hangup_scheduled:
            return
        if self.is_speaking:
            self._schedule_hangup()
        elif not self._goodbye_requested:
            self._goodbye_requested = True
            await self._request_response(
                {"type": "response.create", "response": {"instructions": "Say a short, warm goodbye in the caller's language."}}
            )
        else:
            self._schedule_hangup()

    def _schedule_hangup(self) -> None:
        self._hangup_scheduled = True
        delay = max(0.0, self.playout_ends_at - time.monotonic()) + HANGUP_AFTER_GOODBYE_PAD_SECONDS
        self._spawn(self._hangup_after(delay))

    async def _hangup_after(self, delay: float) -> None:
        await asyncio.sleep(delay)
        await self.call_control.hangup_call(self.call_id)

    async def _watch_call(self) -> None:
        """Ends calls we would otherwise pay for forever: one that runs past the time
        limit, or where the caller has gone quiet (a voicemail, someone who walked away)."""
        try:
            while not self.closed:
                await asyncio.sleep(WATCH_INTERVAL_SECONDS)
                now = time.monotonic()
                if now - self.call_started_at > settings.AI_CALL_MAX_SECONDS:
                    await self._end_for_time_limit()
                    return
                busy = self.transferring or self.pending_hangup or self.greeting_in_progress or self.response_active or self.is_speaking
                if busy:
                    continue
                quiet = now - max(self.last_activity, self.playout_ends_at)
                if not self.idle_prompted and quiet > settings.AI_CALL_IDLE_PROMPT_SECONDS:
                    self.idle_prompted = True
                    await self._request_response(
                        {"type": "response.create", "response": {"instructions": "The caller has gone quiet. Ask briefly, in their language, whether they are still there."}}
                    )
                elif self.idle_prompted and quiet > settings.AI_CALL_IDLE_HANGUP_SECONDS:
                    self.pending_hangup = True
                    self._goodbye_requested = True
                    await self._request_response(
                        {"type": "response.create", "response": {"instructions": "You cannot hear the caller. Say one short goodbye, mention they are welcome to call back, and stop."}}
                    )
        except asyncio.CancelledError:
            raise

    async def _end_for_time_limit(self) -> None:
        self.pending_hangup = True
        self._goodbye_requested = True
        await self._request_response(
            {"type": "response.create", "response": {"instructions": "The call has reached its time limit. Politely say so, say the team will follow up on anything left, and say goodbye."}}
        )
        await asyncio.sleep(HARD_STOP_GRACE_SECONDS)
        if not self._hangup_scheduled and not self.closed:
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

    def _providers(self):
        from app.services.smartflow.provider_service import ProviderService

        return ProviderService(self.flow_service.db)

    async def _tool_check_availability(
        self, date: str | None = None, part_of_day: str | None = None, provider: str | None = None, appointment_type: str | None = None
    ) -> dict:
        return await self._appointments().available_slots(
            self.user_id, day=date, part_of_day=part_of_day, provider_name=provider, appointment_type_name=appointment_type
        )

    def _adopt_language(self, language: str | None) -> str:
        """The realtime model hears the caller; Whisper-style detection does not run
        here, so the model tells us which language the call is in."""
        code = (language or "").strip().lower()
        if code in call_phrases.SUPPORTED_LANGUAGES:
            self.language = code
            self.language_locked = True
        return self.language

    async def _tool_book_appointment(
        self, date: str, time: str, first_name: str, last_name: str = "", email: str | None = None,
        phone: str | None = None, language: str | None = None, provider: str | None = None, appointment_type: str | None = None,
    ) -> dict:
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
            language=self._adopt_language(language),
            provider_name=provider,
            appointment_type_name=appointment_type,
        )

    async def _tool_find_my_appointments(self, phone: str | None = None) -> dict:
        return await self._appointments().find_upcoming(self.user_id, phone or self.caller_phone)

    async def _tool_reschedule_appointment(
        self, appointment_id: str, date: str, time: str, phone: str | None = None, language: str | None = None
    ) -> dict:
        return await self._appointments().reschedule(
            self.user_id, appointment_id=appointment_id, phone=phone or self.caller_phone, day=date, time=time,
            call_sid=self.call_id, language=self._adopt_language(language),
        )

    async def _tool_cancel_appointment(self, appointment_id: str, phone: str | None = None, language: str | None = None) -> dict:
        return await self._appointments().cancel(
            self.user_id, appointment_id=appointment_id, phone=phone or self.caller_phone,
            call_sid=self.call_id, language=self._adopt_language(language),
        )

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

    async def _tool_notify_team(self, note: str, playbook: str | None = None) -> dict:
        from app.utils.helpers import resolve_organization_user_ids

        entry = {
            "intent": "playbook_notify",
            "playbook": playbook,
            "transcript": note[:1000],
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
                    title=f"Team notified: {playbook}" if playbook else "Team notified",
                    body=note[:300],
                    metadata={"call_sid": self.call_id, "playbook": playbook},
                )
            except Exception:
                continue
        return {"notified": True}

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
        # "One moment, I'll connect you" is already queued at Telnyx; let it finish
        # before the line changes hands (clearing it would leave the caller in silence).
        delay = max(0.0, self.playout_ends_at - time.monotonic()) + HANGUP_AFTER_GOODBYE_PAD_SECONDS
        self._spawn(self._transfer_after(delay, target))
        return {"transferred": True}

    async def _transfer_after(self, delay: float, target: str) -> None:
        await asyncio.sleep(delay)
        if await self.call_control.transfer_call(self.call_id, to_number=target):
            return
        self.transferring = False
        await self._request_response(
            {"type": "response.create", "response": {"instructions": "The transfer did not go through. Apologise briefly and offer to take a message for the team."}}
        )

    async def _tool_end_call(self) -> dict:
        self.pending_hangup = True
        return {"ok": True}

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
        from app.core.exceptions import AppException

        try:
            start, _end = await self._appointments()._slot_bounds(self.user_id, date, time)
        except AppException as exc:
            return {"outcome": "unavailable", "reason": exc.message, "test_mode": "nothing was booked"}
        hours = await self.flow_service.get_business_hours(self.user_id)
        from app.services.smartflow.appointment_notifications import format_when

        return {"outcome": "booked", "when": format_when(start, hours.get("timezone")), "test_mode": "nothing was booked"}

    async def _sim_reschedule_appointment(self, appointment_id: str, date: str, time: str, **_: Any) -> dict:
        booked = await self._sim_book_appointment(date, time, "")
        if booked["outcome"] != "booked":
            return booked
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
                "disposition": _derive_call_disposition(self.ai_actions),
                "ai_ready": True,
                "voice_engine": "realtime",
                "updated_at": utc_now(),
            }},
        )

    async def close(self) -> None:
        self.closed = True
        for task in (self.reader_task, self.watch_task, *self._tasks):
            if task:
                task.cancel()
        if self.openai is not None:
            try:
                await self.openai.close()
            except Exception:
                pass
        await self.finalize_session()
