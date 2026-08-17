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
        audio_result = await self.ai_service.synthesize_speech(greeting_text)
        if audio_result and audio_result.get("audio_base64"):
            await self.stream_audio_to_telnyx(audio_result["audio_base64"], send_callback)

    async def _get_business_name(self) -> str | None:
        if not self.user_id or self.user_id == "guest":
            return None
        try:
            profile = await self.flow_service.db.business_profiles.find_one({"user_id": self.user_id})
        except Exception:
            logger.warning("Call %s: could not look up business name", self.call_id, exc_info=True)
            return None
        name = (profile or {}).get("business_name")
        return name.strip() if name and name.strip() else None

    async def _get_business_info(self) -> dict:
        """Real address/phone/hours the caller might ask about — fetched once and
        cached, so "what are your hours?" is answered from actual business_profiles /
        organizations.business_hours data instead of the LLM guessing."""
        if self.business_info is not None:
            return self.business_info
        info: dict = {"address_text": None, "phone_number": None, "website": None, "hours_text": None}
        if self.user_id and self.user_id != "guest":
            try:
                profile = await self.flow_service.db.business_profiles.find_one({"user_id": self.user_id})
            except Exception:
                logger.warning("Call %s: could not look up business profile", self.call_id, exc_info=True)
                profile = None
            if profile:
                address = profile.get("office_address") or {}
                info["address_text"] = profile.get("office_address_text") or self.flow_service._business_address_text(address)
                info["phone_number"] = profile.get("phone_number")
                info["website"] = profile.get("website")
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
        print(f"DEBUG_AGENT: Received media chunk of {len(audio_chunk)} bytes. Buffer size: {len(self.audio_buffer)}", flush=True)

    async def process_and_respond(self, send_callback: Callable):
        if self.is_processing or not self.audio_buffer:
            return

        self.is_processing = True
        print(f"DEBUG_AGENT: process_and_respond called with buffer size: {len(self.audio_buffer)}", flush=True)

        try:
            wav_data = self._mulaw_to_wav(self.audio_buffer)
            self.audio_buffer = bytearray()

            audio_b64 = base64.b64encode(wav_data).decode("utf-8")
            transcript, detected_language, error = self.ai_service._transcribe_with_language(
                audio_base64=audio_b64,
                audio_mime_type="audio/wav",
                audio_filename=f"call_{self.call_id}.wav",
            )
            print(f"DEBUG_AGENT: Whisper transcript: '{transcript}', lang='{detected_language}', error='{error}'", flush=True)

            if not transcript or len(transcript.strip()) < 2:
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
                {"$set": {"speaker_segments": self.transcript_log, "updated_at": utc_now()}},
            )

            logger.debug("Call %s: AI Response: '%s'", self.call_id, response_text)

            audio_result = await self.ai_service.synthesize_speech(response_text)
            if audio_result and audio_result.get("audio_base64"):
                await self.stream_audio_to_telnyx(audio_result["audio_base64"], send_callback)

        except Exception:
            logger.exception("Call %s: Error in AI Phone Agent", self.call_id)
        finally:
            self.is_processing = False

    async def _advance_conversation(self, transcript: str) -> str:
        """The scheduling micro-flow. Anything outside of it (small talk, questions)
        gets a plain conversational reply — no other business action is ever taken
        on a call."""
        if self.phase == "idle":
            if _looks_like_scheduling_request(transcript, self.language):
                return await self._offer_next_slot()
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
                await self._submit_pending_request()
                self.phase = "idle"
                return phrase("sent_to_team", self.language)
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

    async def _submit_pending_request(self) -> None:
        if not self.proposed_slot or not self.user_id:
            return
        try:
            # The slot is business-local (e.g. "09:00" in the org's own timezone) —
            # convert to the UTC instant calendar_events/call_meeting_requests store.
            starts_at = await self.flow_service.localize_business_slot(
                self.user_id, self.proposed_slot["date"], self.proposed_slot["time"]
            )
        except ValueError:
            logger.warning("Call %s: could not parse proposed slot %s", self.call_id, self.proposed_slot)
            return
        from datetime import timedelta

        hours = await self.flow_service.get_business_hours(self.user_id)
        ends_at = starts_at + timedelta(minutes=hours.get("slot_minutes", 60))

        try:
            await self.flow_service.create_pending_call_meeting_request(
                self.user_id,
                call_sid=self.call_id,
                caller_name=self.caller_name or "Phone caller",
                caller_email=self.caller_email,
                caller_phone=self.caller_phone,
                requested_start=starts_at,
                requested_end=ends_at,
            )
        except Exception:
            logger.exception("Call %s: failed to create pending meeting request", self.call_id)

    async def _plain_chat_reply(self, transcript: str) -> str:
        """Ordinary conversation — deliberately bypasses the general command workflow
        (invoice/lease/agreement/bulk_message/... intents) since none of those actually
        execute anything real yet; a call should never sound like it did something it
        didn't."""
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
            ("Hours", info["hours_text"]),
            ("Address", info["address_text"]),
            ("Phone", info["phone_number"]),
            ("Website", info["website"]),
        ) if value]
        if facts:
            facts_instruction = (
                "Here are this business's REAL facts — if the caller asks about hours, "
                "location/address, phone number, or website, answer using ONLY these "
                "values, stated plainly (do not invent or guess anything not listed here):\n"
                + "\n".join(facts) + "\n"
            )
        else:
            facts_instruction = (
                "You don't have this business's hours or address on file — if asked, say "
                "you're not sure and a team member will follow up with the details. Never "
                "guess or invent hours or an address. "
            )
        try:
            reply, _tokens = await self.ai_service._generate_with_openai(
                f"{business_context}{language_instruction}{facts_instruction}You are on a live phone call. The caller said: \"{transcript}\". "
                "Reply naturally in one or two short sentences, as if speaking. If they "
                "want something you can't do over the phone (like creating a document or "
                "invoice), say a team member will follow up, and offer to schedule a "
                "meeting with them instead.",
                None,
            )
            if reply:
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
        print(f"DEBUG_AGENT: Streaming {len(mulaw_data)} bytes of mu-law audio to Telnyx ({len(mulaw_data)//chunk_size} chunks)...", flush=True)
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
                target_time = start_time + (chunk_index * 0.02)
                sleep_needed = target_time - time.perf_counter()
                if sleep_needed > 0:
                    await asyncio.sleep(sleep_needed)
            print("DEBUG_AGENT: Finished streaming audio to Telnyx.", flush=True)
        finally:
            self.is_speaking = False
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
