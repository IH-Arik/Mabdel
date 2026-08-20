import base64
import re
import asyncio
import logging
from typing import Callable
from datetime import datetime, timezone
import wave
import io

from app.services.gocustify_ai_service import GoCustifyAIService
from app.services.smartflow_service import SmartFlowService
from app.services import call_phrases
from app.services.call_phrases import phrase, matches_any

logger = logging.getLogger(__name__)

# Mu-law constants
MU_LAW_SILENCE = 0xFF
SAMPLE_RATE = 8000

# After this many consecutive OpenAI (transcription/TTS) failures in a row, stop
# retrying silently and apologize + hang up instead of leaving the caller on dead air.
MAX_CONSECUTIVE_FAILURES = 2


def _looks_like_scheduling_request(text: str, language: str = "en") -> bool:
    return matches_any(text, language, call_phrases.SCHEDULING_KEYWORDS)


def _looks_affirmative(text: str, language: str = "en") -> bool:
    return matches_any(text, language, call_phrases.AFFIRMATIVE_WORDS)


def _looks_negative(text: str, language: str = "en") -> bool:
    return matches_any(text, language, call_phrases.NEGATIVE_WORDS)


_EMAIL_PATTERN = re.compile(r"^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$")


def _clean_spoken_email(text: str) -> str:
    """Whisper transcribes spoken email addresses as words, not symbols — this is a
    best-effort cleanup, not reliable NLU. Caller confirmation (read-back) is what
    actually catches mis-transcriptions, not this.

    Handles: "at"/"at the rate" -> @, "dot" -> ., "underscore" -> _, "dash"/"hyphen"
    -> -, and spelled-out letters ("j o h n" -> "john") — a common fallback callers
    use once asked to spell something out."""
    cleaned = text.strip().lower()
    cleaned = re.sub(r"[.,;!?]+$", "", cleaned)
    cleaned = re.sub(r"\s+at\s+the\s+rate\s+", " at ", cleaned)
    cleaned = re.sub(r"\s+underscore\s+", "_", cleaned)
    cleaned = re.sub(r"\s+(dash|hyphen)\s+", "-", cleaned)
    # Collapse runs of single letters/digits spoken one at a time ("j o h n" -> "john")
    # before the word-level at/dot substitutions, so "j o h n at gmail" isn't mangled.
    cleaned = re.sub(
        r"\b(?:[a-z0-9]\s+){2,}[a-z0-9]\b",
        lambda m: m.group(0).replace(" ", ""),
        cleaned,
    )
    cleaned = re.sub(r"\s+at\s+", "@", cleaned)
    cleaned = re.sub(r"\s+dot\s+", ".", cleaned)
    cleaned = cleaned.replace(" ", "")
    cleaned = re.sub(r"\.{2,}", ".", cleaned)
    return cleaned


def _looks_like_valid_email(text: str) -> bool:
    return bool(_EMAIL_PATTERN.match(text))


def _format_hour_only(hour) -> str:
    try:
        hour_int = int(hour) % 24
    except (TypeError, ValueError):
        return ""
    return datetime(2000, 1, 1, hour_int, 0).strftime("%I:%M %p").lstrip("0")


def _format_business_hours_text(hours: dict, language: str) -> str:
    """Real business hours, spoken in the caller's language — e.g. "Monday, Tuesday,
    Wednesday, Thursday, Friday: 9:00 AM - 5:00 PM". Empty if no days are configured,
    so the caller is never told a made-up schedule."""
    days = sorted(d for d in (hours.get("days") or []) if isinstance(d, int) and 0 <= d <= 6)
    if not days:
        return ""
    weekday_names = call_phrases.WEEKDAYS.get(language, call_phrases.WEEKDAYS["en"])
    day_text = ", ".join(weekday_names[d] for d in days)
    start_text = _format_hour_only(hours.get("start_hour", 9))
    end_text = _format_hour_only(hours.get("end_hour", 17))
    if not start_text or not end_text:
        return day_text
    return f"{day_text}: {start_text} - {end_text}"


def _friendly_slot(date_str: str, time_str: str, language: str = "en") -> str:
    try:
        dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    except ValueError:
        return f"{date_str} {time_str}"
    weekday = call_phrases.WEEKDAYS.get(language, call_phrases.WEEKDAYS["en"])[dt.weekday()]
    month = call_phrases.MONTHS.get(language, call_phrases.MONTHS["en"])[dt.month - 1]
    time_text = dt.strftime("%I:%M %p").lstrip("0")
    template = call_phrases.DATE_TEMPLATES.get(language, call_phrases.DATE_TEMPLATES["en"])
    return template.format(weekday=weekday, month=month, day=dt.day, time=time_text)


class AIPhoneAgent:
    """
    Handles a single live phone call session.

    Scope is deliberately narrow: the AI can hold a normal conversation and — its one
    real capability — offer a real open meeting slot and forward a booking request to
    the business for approval. It does not create invoices, leases, agreements, or any
    other business record on a call; those all route through a human afterward.
    """
    def __init__(self, call_id: str, ai_service: GoCustifyAIService, flow_service: SmartFlowService):
        self.call_id = call_id
        self.ai_service = ai_service
        self.flow_service = flow_service
        self.audio_buffer = bytearray()
        self.is_processing = False
        self.is_speaking = False
        self.barge_in_triggered = False
        self.consecutive_failures = 0
        self.should_hangup = False
        self.stream_sid = None
        self.greeted = False
        self.user_id = None
        self.transcript_log: list[dict] = []
        # Scheduling micro-flow state.
        self.phase = "idle"  # idle -> offering_slot -> collecting_name -> collecting_email -> confirming
        self.proposed_slot: dict | None = None
        self.declined_slots: set[str] = set()
        self.slot_offer_attempts = 0
        self.email_attempts = 0
        self.caller_name: str | None = None
        self.caller_email: str | None = None
        self.caller_phone: str | None = None
        self.business_name: str | None = None
        self.business_info: dict | None = None
        # Locked in from the caller's first substantive utterance (see
        # process_and_respond) and held for the rest of the call — re-detecting every
        # turn would make the AI jarringly flip languages mid-conversation on a short
        # or ambiguous utterance. Starts English since the greeting is spoken before
        # we've heard the caller say anything.
        self.language: str = call_phrases.DEFAULT_LANGUAGE
        self.language_locked = False
        self.offered_scheduling_in_last_turn = False
        self.captured_requests: list[dict] = []

    async def greet(self, send_callback: Callable):
        if self.greeted:
            return
        self.greeted = True
        self.business_name = await self._get_business_name()
        if self.business_name:
            greeting_text = phrase("greeting_with_business", self.language, business=self.business_name)
        else:
            # No business name on file yet — a generic greeting beats a wrong one.
            greeting_text = phrase("greeting_no_business", self.language)
        greeting_text = f"{phrase('recording_disclosure', self.language)} {greeting_text}"
        await self._speak(greeting_text, send_callback)

    async def _speak(self, text: str, send_callback: Callable) -> bool:
        """Synthesizes and streams `text`, retrying once on failure. On repeated
        failure across turns, apologizes (best-effort) and flags the call to hang
        up rather than leaving the caller on dead air indefinitely."""
        audio_result = await self.ai_service.synthesize_speech(text)
        if not audio_result or not audio_result.get("audio_base64"):
            audio_result = await self.ai_service.synthesize_speech(text)  # one retry

        if audio_result and audio_result.get("audio_base64"):
            self.consecutive_failures = 0
            await self.stream_audio_to_telnyx(audio_result["audio_base64"], send_callback)
            return True

        self.consecutive_failures += 1
        logger.warning(
            "Call %s: TTS failed %d consecutive time(s)", self.call_id, self.consecutive_failures
        )
        if self.consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            self.should_hangup = True
            apology_audio = await self.ai_service.synthesize_speech(phrase("technical_issue", self.language))
            if apology_audio and apology_audio.get("audio_base64"):
                await self.stream_audio_to_telnyx(apology_audio["audio_base64"], send_callback)
        return False

    async def _get_business_name(self) -> str | None:
        if not self.user_id or self.user_id == "guest":
            return None
        try:
            profile = await self.flow_service.db.business_profiles.find_one({"user_id": self.user_id})
            if profile and profile.get("business_name") and profile["business_name"].strip():
                return profile["business_name"].strip()

            from bson import ObjectId
            user = await self.flow_service.db.users.find_one({"_id": self.user_id})
            if not user:
                try:
                    user = await self.flow_service.db.users.find_one({"_id": ObjectId(self.user_id)})
                except Exception:
                    user = None
            if user and user.get("organization_id"):
                org = await self.flow_service.db.organizations.find_one({"organization_id": user["organization_id"]})
                if org and (org.get("company_name") or org.get("name")):
                    return (org.get("company_name") or org.get("name")).strip()
        except Exception:
            logger.warning("Call %s: could not look up business name", self.call_id, exc_info=True)
        return None

    async def _get_business_info(self) -> dict:
        """Real address/phone/hours/services the caller might ask about — fetched once and
        cached from business_profiles, organizations, and user records."""
        if self.business_info is not None:
            return self.business_info
        info: dict = {
            "address_text": None,
            "phone_number": None,
            "website": None,
            "hours_text": None,
            "services_text": None,
            "industry": None,
            "email": None,
        }
        if self.user_id and self.user_id != "guest":
            profile = None
            org = None
            user = None
            try:
                from bson import ObjectId
                profile = await self.flow_service.db.business_profiles.find_one({"user_id": self.user_id})
                user = await self.flow_service.db.users.find_one({"_id": self.user_id})
                if not user:
                    try:
                        user = await self.flow_service.db.users.find_one({"_id": ObjectId(self.user_id)})
                    except Exception:
                        user = None
                if user and user.get("organization_id"):
                    org = await self.flow_service.db.organizations.find_one({"organization_id": user["organization_id"]})
            except Exception:
                logger.warning("Call %s: could not look up business profile or org", self.call_id, exc_info=True)

            if profile:
                address = profile.get("office_address") or {}
                info["address_text"] = profile.get("office_address_text") or self.flow_service._business_address_text(address)
                info["phone_number"] = profile.get("phone_number")
                info["website"] = profile.get("website")
                info["services_text"] = profile.get("services_offered") or profile.get("description") or profile.get("about_us")
                info["email"] = profile.get("email")

            if org:
                if not info["address_text"]:
                    info["address_text"] = org.get("address") or org.get("office_address")
                if not info["phone_number"]:
                    info["phone_number"] = org.get("phone_number") or org.get("telnyx_phone_number")
                if not info["website"]:
                    info["website"] = org.get("website")
                if not info["services_text"]:
                    info["services_text"] = org.get("services_offered") or org.get("description") or org.get("about_us")
                if not info["industry"]:
                    info["industry"] = org.get("industry")
                if not info["email"]:
                    info["email"] = org.get("email")

            if user:
                if not info["email"]:
                    info["email"] = user.get("email")

            try:
                hours = await self.flow_service.get_business_hours(self.user_id)
                info["hours_text"] = _format_business_hours_text(hours, self.language)
            except Exception:
                logger.warning("Call %s: could not look up business hours", self.call_id, exc_info=True)
        self.business_info = info
        return info

    async def handle_media(self, payload_base64: str, stream_sid: str, send_callback: Callable):
        """Legacy method kept for compatibility — buffering is now done in calls.py."""
        self.stream_sid = stream_sid
        audio_chunk = base64.b64decode(payload_base64)
        self.audio_buffer.extend(audio_chunk)

    async def process_and_respond(self, send_callback: Callable):
        if self.is_processing or not self.audio_buffer:
            return

        self.is_processing = True
        logger.debug("Call %s: process_and_respond called with buffer size: %d", self.call_id, len(self.audio_buffer))

        try:
            wav_data = self._mulaw_to_wav(self.audio_buffer)
            self.audio_buffer = bytearray()

            audio_b64 = base64.b64encode(wav_data).decode("utf-8")
            transcript, detected_language, error = self.ai_service._transcribe_with_language(
                audio_base64=audio_b64,
                audio_mime_type="audio/wav",
                audio_filename=f"call_{self.call_id}.wav",
            )
            logger.debug("Call %s: Whisper transcript: '%s', lang='%s', error='%s'", self.call_id, transcript, detected_language, error)

            if not transcript or len(transcript.strip()) < 2:
                if error and error != "OpenAI returned an empty transcript.":
                    # A real transcription failure (API error, missing key, bad
                    # payload) — not just silence/no speech — counts toward the
                    # dead-air failsafe below.
                    self.consecutive_failures += 1
                    logger.warning(
                        "Call %s: transcription failed %d consecutive time(s): %s",
                        self.call_id, self.consecutive_failures, error,
                    )
                    if self.consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                        self.should_hangup = True
                        apology_audio = await self.ai_service.synthesize_speech(
                            phrase("technical_issue", self.language)
                        )
                        if apology_audio and apology_audio.get("audio_base64"):
                            await self.stream_audio_to_telnyx(apology_audio["audio_base64"], send_callback)
                self.is_processing = False
                return

            if not self.language_locked:
                self.language = call_phrases.resolve_call_language(detected_language)
                self.language_locked = True

            logger.debug("Call %s: Transcript (%s): '%s'", self.call_id, self.language, transcript)

            response_text = await self._advance_conversation(transcript)

            self.transcript_log.append({"speaker": "customer", "text": transcript})
            self.transcript_log.append({"speaker": "ai", "text": response_text})

            from app.utils.audio import utc_now
            await self.flow_service.db.call_logs.update_one(
                {"twilio_call_sid": self.call_id, "user_id": self.user_id},
                {"$set": {
                    "speaker_segments": self.transcript_log,
                    "captured_requests": self.captured_requests,
                    "updated_at": utc_now(),
                }},
            )

            logger.debug("Call %s: AI Response: '%s'", self.call_id, response_text)

            await self._speak(response_text, send_callback)

        except Exception:
            logger.exception("Call %s: Error in AI Phone Agent", self.call_id)
            self.consecutive_failures += 1
            if self.consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                self.should_hangup = True
                try:
                    apology_audio = await self.ai_service.synthesize_speech(phrase("technical_issue", self.language))
                    if apology_audio and apology_audio.get("audio_base64"):
                        await self.stream_audio_to_telnyx(apology_audio["audio_base64"], send_callback)
                except Exception:
                    logger.exception("Call %s: apology speech also failed", self.call_id)
        finally:
            self.is_processing = False

    async def _advance_conversation(self, transcript: str) -> str:
        """Manages conversation flow. Drives multi-turn meeting scheduling when requested;
        otherwise delegates to _plain_chat_reply to answer business inquiries, capture
        structured requests for team follow-up, or offer meeting slots."""
        if self.phase == "idle":
            is_scheduling = _looks_like_scheduling_request(transcript, self.language)
            is_affirmative_followup = self.offered_scheduling_in_last_turn and _looks_affirmative(transcript, self.language)
            if is_scheduling or is_affirmative_followup:
                self.offered_scheduling_in_last_turn = False
                return await self._offer_next_slot()
            self.offered_scheduling_in_last_turn = False
            return await self._plain_chat_reply(transcript)

        if self.phase == "offering_slot":
            if _looks_affirmative(transcript, self.language):
                self.phase = "collecting_name"
                return phrase("ask_name", self.language)
            if _looks_negative(transcript, self.language):
                # Don't just give up — try the next open slot instead, up to a few
                # attempts, so one "no" doesn't end the whole conversation.
                if self.proposed_slot:
                    self.declined_slots.add(f"{self.proposed_slot['date']} {self.proposed_slot['time']}")
                return await self._offer_next_slot()
            # Didn't parse as yes/no — re-ask once rather than guessing.
            when = _friendly_slot(self.proposed_slot["date"], self.proposed_slot["time"], self.language)
            return phrase("confirm_reask", self.language, when=when)

        if self.phase == "collecting_name":
            self.caller_name = transcript.strip()
            self.phase = "collecting_email"
            return phrase("ask_email", self.language, name=self.caller_name)

        if self.phase == "collecting_email":
            candidate = _clean_spoken_email(transcript)
            if not _looks_like_valid_email(candidate) and self.email_attempts < 1:
                self.email_attempts += 1
                return phrase("ask_email_spell", self.language)
            self.caller_email = candidate
            self.phase = "confirming"
            when = _friendly_slot(self.proposed_slot["date"], self.proposed_slot["time"], self.language)
            email_line = f" — {self.caller_email}" if self.caller_email else ""
            return phrase("confirm_send", self.language, email_line=email_line, when=when, name=self.caller_name)

        if self.phase == "confirming":
            if _looks_affirmative(transcript, self.language):
                when = _friendly_slot(self.proposed_slot["date"], self.proposed_slot["time"], self.language) if self.proposed_slot else ""
                res = await self._submit_pending_request()
                self.phase = "idle"
                outcome = (res or {}).get("booking_outcome", "pending")
                if outcome == "booked":
                    return phrase("meeting_booked_direct", self.language, when=when)
                elif outcome == "conflict":
                    if self.proposed_slot:
                        self.declined_slots.add(f"{self.proposed_slot['date']} {self.proposed_slot['time']}")
                    return await self._offer_next_slot()
                else:
                    return phrase("sent_to_team", self.language, when=when)
            if _looks_negative(transcript, self.language):
                self.phase = "idle"
                self.proposed_slot = None
                return phrase("declined_send", self.language)
            return phrase("confirm_reask_yesno", self.language)

        # Shouldn't happen, but never leave the caller stuck.
        self.phase = "idle"
        return await self._plain_chat_reply(transcript)

    MAX_SLOT_OFFERS = 3

    async def _offer_next_slot(self) -> str:
        self.slot_offer_attempts += 1
        if self.slot_offer_attempts > self.MAX_SLOT_OFFERS:
            self.phase = "idle"
            self.proposed_slot = None
            return phrase("gave_up_after_retries", self.language)

        slot = await self.flow_service.find_next_available_slot(
            self.user_id, exclude_datetimes=self.declined_slots
        )
        if not slot:
            self.phase = "idle"
            self.proposed_slot = None
            return phrase("no_slots_this_week", self.language)

        self.proposed_slot = slot
        self.phase = "offering_slot"
        when = _friendly_slot(slot["date"], slot["time"], self.language)
        if self.slot_offer_attempts > 1:
            return phrase("offer_slot_retry", self.language, when=when)
        return phrase("offer_slot_first", self.language, when=when)

    async def _submit_pending_request(self) -> dict:
        """Attempts direct calendar booking when available, falling back to creating
        a pending meeting request if manual approval is required or info is missing."""
        if not self.proposed_slot or not self.user_id:
            return {"booking_outcome": "pending"}
        try:
            # The slot is business-local (e.g. "09:00" in the org's own timezone) —
            # convert to the UTC instant calendar_events/call_meeting_requests store.
            starts_at = await self.flow_service.localize_business_slot(
                self.user_id, self.proposed_slot["date"], self.proposed_slot["time"]
            )
        except ValueError:
            logger.warning("Call %s: could not parse proposed slot %s", self.call_id, self.proposed_slot)
            return {"booking_outcome": "pending"}
        from datetime import timedelta

        hours = await self.flow_service.get_business_hours(self.user_id)
        ends_at = starts_at + timedelta(minutes=hours.get("slot_minutes", 60))

        if not self.caller_phone:
            call_log = await self.flow_service.db.call_logs.find_one({"twilio_call_sid": self.call_id})
            if call_log:
                self.caller_phone = call_log.get("from_number") or call_log.get("phone_number")

        try:
            res = await self.flow_service.book_or_request_meeting_for_user(
                self.user_id,
                call_sid=self.call_id,
                caller_name=self.caller_name or "Phone caller",
                caller_email=self.caller_email,
                caller_phone=self.caller_phone,
                requested_start=starts_at,
                requested_end=ends_at,
            )
            return res or {"booking_outcome": "pending"}
        except Exception:
            logger.exception("Call %s: failed to process meeting booking/request", self.call_id)
            return {"booking_outcome": "pending"}

    async def _plain_chat_reply(self, transcript: str) -> str:
        """General conversation — answers questions using verified business facts, captures
        structured action/document requests into captured_requests for team follow-up, and
        offers meeting scheduling without making false claims of real-time document creation."""
        if self.business_name is None:
            self.business_name = await self._get_business_name()
        business_context = (
            f"You are the phone assistant for \"{self.business_name}\" — a real business, "
            "not the software vendor. Speak as their assistant, not as a product called GoCustify. "
            if self.business_name
            else "You are a business's phone assistant. "
        )
        language_instruction = (
            "" if self.language == call_phrases.DEFAULT_LANGUAGE
            else f"Reply only in this language (ISO code \"{self.language}\") — the caller is speaking it, not English. "
        )
        info = await self._get_business_info()
        facts = [f"- {label}: {value}" for label, value in (
            ("Business Name", self.business_name),
            ("Industry / Category", info.get("industry")),
            ("Services / About", info.get("services_text")),
            ("Operating Hours", info.get("hours_text")),
            ("Office Address / Location", info.get("address_text")),
            ("Contact Phone", info.get("phone_number")),
            ("Official Website", info.get("website")),
            ("Contact Email", info.get("email")),
        ) if value]

        facts_block = "\n".join(facts) if facts else "No explicit business profile records on file yet."

        facts_instruction = (
            "VERIFIED BUSINESS FACTS:\n"
            f"{facts_block}\n\n"
            "FALLBACK & EXPLANATION STRATEGY FOR MISSING / UNKNOWN DETAILS:\n"
            "- Operating Hours: If hours are not listed in FACTS, state warmly that operating hours vary, and offer to take their details or preferred time for a team member to confirm.\n"
            "- Location / Address: If address is not listed in FACTS, state warmly that you can log their request so the office team can send full location/directions.\n"
            "- Pricing / Rates: If asked about prices or rates, explain warmly that pricing depends on their specific project or service requirements, and offer to request a custom quote or schedule a call.\n"
            "- Services: Use known facts. If asked for a specific service not listed, explain warmly what is known, and offer to note their requirement for a specialist to confirm.\n"
            "- STRICT NON-HALLUCINATION RULE: DO NOT invent street addresses, specific operating hours, prices, or unlisted guarantees under any circumstances.\n"
        )
        from app.workflows.intent_utils import infer_intent_from_command
        detected_intent = infer_intent_from_command(transcript)
        if detected_intent and detected_intent not in ("call", "calendar"):
            from app.utils.audio import utc_now
            self.captured_requests.append({
                "intent": detected_intent,
                "transcript": transcript,
                "timestamp": utc_now().isoformat(),
            })

        orchestrator_instruction = (
            "YOUR ROLE AS AN INTELLIGENT AI RECEPTIONIST AND ORCHESTRATOR:\n"
            "1. GENERAL INQUIRIES & FACTS: If the caller asks about business hours, address, phone number, website, or services, answer using ONLY the REAL facts provided above.\n"
            "2. ACTION & DOCUMENT REQUESTS (Invoices, Agreements, Leases, Quotes, Service Requests, Messages):\n"
            "   - Respond warmly and reassure the caller that you have logged their request for the team to process and send out right away.\n"
            "   - If key details are missing (such as their account name, email, or invoice number), ask the caller to provide them so the team has complete information.\n"
            "   - ABSOLUTELY NEVER state, claim, or pretend that an invoice, agreement, or lease document has ALREADY been generated or sent during the call. Be 100% honest that their request has been logged for team execution.\n"
            "3. MEETING SCHEDULING: If they want to schedule a call or meeting, offer to set a time.\n"
            "Keep your reply to 1 to 2 short natural spoken sentences."
        )

        try:
            reply, _tokens = await self.ai_service._generate_with_openai(
                f"{business_context}{language_instruction}{facts_instruction}\n{orchestrator_instruction}\n"
                f"The caller said: \"{transcript}\".",
                None,
            )
            if reply:
                lowered_reply = reply.lower()
                if any(w in lowered_reply for w in ["schedule", "meeting", "call", "appointment", "slot", "meet", "time"]):
                    self.offered_scheduling_in_last_turn = True
                return reply
        except Exception:
            logger.warning("Call %s: plain chat reply failed", self.call_id, exc_info=True)
        return phrase("did_not_understand", self.language)

    async def stream_audio_to_telnyx(self, audio_base64: str, send_callback: Callable):
        """
        Sends audio back to Telnyx in the required format.
        OpenAI WAV is 24kHz 16-bit PCM. Telnyx's PCMU codec needs 8kHz 8-bit Mu-law,
        the same encoding Twilio used — the audio pipeline is unchanged by the provider swap.
        """
        if not self.stream_sid:
            return

        from app.utils.audio import pcm_to_mulaw

        # 1. Extract PCM from WAV
        audio_data = base64.b64decode(audio_base64)
        with io.BytesIO(audio_data) as buf:
            with wave.open(buf, "rb") as wav_file:
                # OpenAI returns 24000Hz mono 16-bit
                pcm_data = wav_file.readframes(wav_file.getnframes())

        # 2. Downsample 24kHz -> 8kHz (Keep 1 out of every 3 samples)
        # Each sample is 2 bytes (16-bit)
        downsampled_pcm = bytearray()
        for i in range(0, len(pcm_data), 6):  # 6 bytes = 3 samples of 2 bytes each
            downsampled_pcm.extend(pcm_data[i:i + 2])

        # 3. Convert to Mu-law
        mulaw_data = pcm_to_mulaw(bytes(downsampled_pcm))

        # 4. Stream to Telnyx in chunks of 160 bytes (20ms) with precise timing
        chunk_size = 160
        logger.debug(
            "Call %s: streaming %d bytes of mu-law audio to Telnyx (%d chunks)",
            self.call_id, len(mulaw_data), len(mulaw_data) // chunk_size,
        )
        self.is_speaking = True
        try:
            import time
            start_time = time.perf_counter()
            chunk_index = 0
            for i in range(0, len(mulaw_data), chunk_size):
                chunk = mulaw_data[i:i + chunk_size]
                # Telnyx outbound media: ONLY "event" and "media" keys — any extra key
                # (e.g. stream_id, track) causes stream_error 100002 and drops the stream.
                message = {
                    "event": "media",
                    "media": {
                        "payload": base64.b64encode(chunk).decode("utf-8")
                    }
                }
                await send_callback(message)
                chunk_index += 1
                if self.barge_in_triggered:
                    logger.debug("Call %s: barge-in detected, cutting AI speech short.", self.call_id)
                    break
                target_time = start_time + (chunk_index * 0.02)
                sleep_needed = target_time - time.perf_counter()
                if sleep_needed > 0:
                    await asyncio.sleep(sleep_needed)
            logger.debug("Call %s: finished streaming audio to Telnyx.", self.call_id)
        finally:
            self.is_speaking = False
            if self.barge_in_triggered:
                # Caller interrupted — keep the speech captured during the interrupt as
                # the start of their next utterance instead of wiping it.
                self.barge_in_triggered = False
            else:
                # Clear any inbound echo or noise buffered while AI was speaking
                self.audio_buffer.clear()

    async def finalize_session(self):
        """Saves the accumulated transcript and AI summary to the call log."""
        if not self.user_id or not self.transcript_log:
            logger.debug("Call %s: Finalizing session (no transcript to save).", self.call_id)
            return

        from app.utils.audio import utc_now
        logger.info("Call %s: Saving %d transcript turns...", self.call_id, len(self.transcript_log))

        summary = self.ai_service.summarize_call(self.transcript_log)

        await self.flow_service.db.call_logs.update_one(
            {"twilio_call_sid": self.call_id, "user_id": self.user_id},
            {
                "$set": {
                    "speaker_segments": self.transcript_log,
                    "ai_summary": summary,
                    "ended_at": utc_now(),
                }
            },
        )
        logger.info("Call %s: Summary saved — %s", self.call_id, summary.get("status"))

    def _mulaw_to_wav(self, mulaw_data: bytes) -> bytes:
        """
        Converts mu-law data to standard 16-bit PCM WAV header for Whisper.
        """
        from app.utils.audio import mulaw_to_pcm
        pcm_data = mulaw_to_pcm(mulaw_data)

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)  # 2 bytes per sample for 16-bit PCM
            wav_file.setframerate(SAMPLE_RATE)
            wav_file.writeframes(pcm_data)
        return buf.getvalue()
