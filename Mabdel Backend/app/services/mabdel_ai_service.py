from __future__ import annotations

import base64
import binascii
from collections.abc import Iterable
from io import BytesIO

from app.core.config import settings
from app.core.exceptions import AppException
from app.workflows.graph import run_assistant_workflow


class MabdelAIService:
    system_prompt = (
        "You are Mabdel, a business operations assistant for SmartFlow. "
        "Help with sales, revenue summaries, quarterly analysis, discrepancy checks, "
        "margin comparisons, projections, tax reports, project updates, and email drafting. "
        "When the user message came from voice, it has already been transcribed for you. "
        "Respond normally to the request itself. Do not say you can only assist through text, "
        "do not claim you cannot hear audio, and do not mention platform limitations unless the user asks."
    )

    voice_presets = [
        {"id": "male_exec", "label": "Male Executive", "gender": "male", "style": "clear and confident", "provider_voice": "ash"},
        {"id": "male_warm", "label": "Male Warm", "gender": "male", "style": "warm and calm", "provider_voice": "verse"},
        {"id": "female_exec", "label": "Female Executive", "gender": "female", "style": "professional and polished", "provider_voice": "sage"},
        {"id": "female_warm", "label": "Female Warm", "gender": "female", "style": "friendly and supportive", "provider_voice": "coral"},
        {"id": "neutral_assistant", "label": "Neutral Assistant", "gender": "neutral", "style": "balanced and steady", "provider_voice": "alloy"},
    ]

    def generate_response(self, user_text: str, history: Iterable[dict] | None = None) -> dict:
        normalized = user_text.lower().strip()
        history_list = list(history or [])
        workflow_state = run_assistant_workflow(user_text, history=history_list)
        if workflow_state.intent != "unknown":
            command_type = workflow_state.intent
            navigation = self._navigation_for_intent(workflow_state.intent, user_text)
            return {
                "state": "responded",
                "content": workflow_state.summary or self._workflow_response_text(workflow_state.intent),
                "command_type": command_type,
                "workflow": {
                    "engine": workflow_state.output.get("workflow_engine"),
                    "intent": workflow_state.intent,
                    "summary": workflow_state.summary,
                    "output": workflow_state.output,
                },
                "navigation": navigation,
            }

        llm_response = self._generate_with_openai(user_text, history)
        if llm_response:
            return {
                "state": "responded",
                "content": llm_response,
                "command_type": self._infer_command_type(normalized),
                "workflow": None,
                "navigation": self._navigation_for_intent(self._infer_command_type(normalized), user_text),
            }

        if "tax" in normalized:
            summary = "Prepared a tax reporting outline with deductions, liabilities, and filing checkpoints."
            command_type = "report"
        elif "email" in normalized or "draft" in normalized:
            summary = "Drafted a business-ready email with concise next steps."
            command_type = "email"
        elif "invoice" in normalized:
            summary = "Prepared an invoice workflow response with follow-up and status guidance."
            command_type = "invoice"
        elif "sales" in normalized or "revenue" in normalized or "margin" in normalized:
            summary = "Generated a revenue summary with notable variance signals and target comparisons."
            command_type = "report"
        elif "project" in normalized or "update" in normalized:
            summary = "Prepared a project update with blockers, completed work, and next actions."
            command_type = "message"
        else:
            summary = "Processed the request and prepared an operations-focused response."
            command_type = "message"

        return {
            "state": "responded",
            "content": f"{summary} Context turns reviewed: {len(history_list)}. Request: {user_text.strip()}",
            "command_type": command_type,
            "workflow": None,
            "navigation": self._navigation_for_intent(command_type, user_text),
        }

    def list_voice_presets(self) -> list[dict]:
        return list(self.voice_presets)

    def transcribe_voice(
        self,
        transcript: str | None = None,
        audio_url: str | None = None,
        audio_base64: str | None = None,
        audio_mime_type: str = "audio/wav",
        audio_filename: str = "voice.wav",
    ) -> dict:
        if transcript and transcript.strip():
            text = transcript.strip()
            source = "text"
            status = "provided"
            error = None
        elif audio_base64:
            text, error = self._transcribe_audio_with_openai(audio_base64, audio_mime_type, audio_filename)
            source = "audio"
            status = "transcribed" if text else "transcription_failed"
        elif audio_url:
            text = f"Transcribed voice request from {audio_url}"
            source = "audio_url"
            status = "placeholder"
            error = None
        else:
            text = None
            source = "unknown"
            status = "missing_input"
            error = "No transcript or audio input was provided."

        if not text:
            raise AppException(
                status_code=400,
                code="VOICE_TRANSCRIPTION_FAILED",
                message="Could not understand the voice input. Please try again with a clearer recording.",
                details={"status": status, "source": source, "error": error, "mime_type": audio_mime_type},
            )

        return {
            "state": "responded",
            "transcript": text,
            "source": source,
            "status": status,
        }

    def synthesize_speech(self, text: str, voice_id: str | None = None) -> dict | None:
        preset = self._resolve_voice_preset(voice_id)
        if not settings.OPENAI_API_KEY:
            return {
                "voice_id": preset["id"],
                "provider_voice": preset["provider_voice"],
                "mime_type": "audio/mpeg",
                "audio_base64": None,
                "preview_text": text,
                "status": "unavailable_without_openai_key",
            }

        try:
            from openai import OpenAI
        except ImportError:
            return {
                "voice_id": preset["id"],
                "provider_voice": preset["provider_voice"],
                "mime_type": "audio/mpeg",
                "audio_base64": None,
                "preview_text": text,
                "status": "openai_package_missing",
            }

        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            speech = client.audio.speech.create(
                model="tts-1",
                voice=preset["provider_voice"],
                input=text,
                response_format="wav",
            )
            audio_bytes = speech.read()
            return {
                "voice_id": preset["id"],
                "provider_voice": preset["provider_voice"],
                "mime_type": "audio/wav",
                "audio_base64": base64.b64encode(audio_bytes).decode("utf-8"),
                "status": "generated",
            }
        except Exception as exc:
            return {
                "voice_id": preset["id"],
                "provider_voice": preset["provider_voice"],
                "mime_type": "audio/mpeg",
                "audio_base64": None,
                "preview_text": text,
                "status": "generation_failed",
                "error": str(exc)[:240],
            }

    def _generate_with_openai(self, user_text: str, history: Iterable[dict] | None) -> str | None:
        if not settings.OPENAI_API_KEY:
            return None

        try:
            from openai import OpenAI
        except ImportError:
            return None

        messages = [{"role": "system", "content": self.system_prompt}]
        for item in list(history or [])[-8:]:
            role = "assistant" if item.get("direction") == "outbound" else "user"
            content = str(item.get("content", "")).strip()
            if content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user_text})

        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.chat.completions.create(model=settings.OPENAI_MODEL, messages=messages)
            text = response.choices[0].message.content.strip()
            return text or None
        except Exception:
            return None

    def _transcribe_audio_with_openai(self, audio_base64: str, audio_mime_type: str, audio_filename: str) -> tuple[str | None, str | None]:
        if not settings.OPENAI_API_KEY:
            return None, "OPENAI_API_KEY is not configured."

        try:
            from openai import OpenAI
        except ImportError:
            return None, "openai package is not installed."

        try:
            audio_bytes = base64.b64decode(audio_base64)
        except (binascii.Error, ValueError):
            return None, "Audio payload could not be decoded."

        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            buffer = BytesIO(audio_bytes)
            buffer.name = audio_filename or self._filename_from_mime(audio_mime_type)
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=buffer,
            )
            text = getattr(transcription, "text", "").strip()
            return (text or None), None if text else "OpenAI returned an empty transcript."
        except Exception as exc:
            return None, str(exc)[:240]

    def _resolve_voice_preset(self, voice_id: str | None) -> dict:
        if voice_id:
            for preset in self.voice_presets:
                if preset["id"] == voice_id:
                    return preset
        return self.voice_presets[0]

    @staticmethod
    def _filename_from_mime(audio_mime_type: str) -> str:
        if "mpeg" in audio_mime_type or "mp3" in audio_mime_type:
            return "voice.mp3"
        if "webm" in audio_mime_type:
            return "voice.webm"
        if "ogg" in audio_mime_type:
            return "voice.ogg"
        return "voice.wav"

    @staticmethod
    def _infer_command_type(normalized: str) -> str:
        if "tax" in normalized or "sales" in normalized or "revenue" in normalized or "margin" in normalized:
            return "report"
        if "bulk" in normalized and ("email" in normalized or "mail" in normalized or "message" in normalized or "sms" in normalized):
            return "bulk_message"
        if "email" in normalized or "draft" in normalized:
            return "email"
        if "invoice" in normalized:
            return "invoice"
        if "lease" in normalized or "rental agreement" in normalized or "rent agreement" in normalized:
            return "lease"
        if "agreement" in normalized or "contract" in normalized or "nda" in normalized:
            return "agreement"
        return "message"

    @staticmethod
    def _workflow_response_text(intent: str) -> str:
        messages = {
            "invoice": "Sure, opening the invoice creator now.",
            "email": "Sure, opening the email draft workflow now.",
            "bulk_message": "Sure, opening the bulk email workflow now.",
            "calendar": "Sure, opening the scheduling workflow now.",
            "lease": "Sure, opening the lease creator now.",
            "agreement": "Sure, opening the agreement creator now.",
            "group": "Sure, opening the group workflow now.",
            "call": "Sure, opening the call workflow now.",
        }
        return messages.get(intent, "Sure, I found the right workflow.")

    navigation_registry = [
        {
            "intent": "invoice",
            "action": "create",
            "entity": "invoice",
            "screen": "CreateInvoice",
            "path": "/invoices/create",
            "route_name": "invoice_create",
            "label": "Create Invoice",
            "aliases": ["invoice", "bill"],
            "action_keywords": ["create", "new", "make", "generate", "draft", "add", "prepare"]
        },
        {
            "intent": "invoice",
            "action": "list",
            "entity": "invoice",
            "screen": "InvoiceList",
            "path": "/invoices",
            "route_name": "invoice_list",
            "label": "Invoices",
            "aliases": ["invoice", "bill", "invoices"],
            "action_keywords": ["show", "view", "list", "open", "go to", "display", "check", "see"]
        },
        {
            "intent": "lease",
            "action": "create",
            "entity": "lease",
            "screen": "CreateLease",
            "path": "/leases/create",
            "route_name": "lease_create",
            "label": "Create Lease",
            "aliases": ["lease", "rental agreement", "leases"],
            "action_keywords": ["create", "new", "make", "generate", "draft", "add", "prepare"]
        },
        {
            "intent": "lease",
            "action": "list",
            "entity": "lease",
            "screen": "LeaseList",
            "path": "/leases",
            "route_name": "lease_list",
            "label": "Leases",
            "aliases": ["lease", "rental agreement", "leases"],
            "action_keywords": ["show", "view", "list", "open", "go to", "display", "check", "see"]
        },
        {
            "intent": "agreement",
            "action": "create",
            "entity": "agreement",
            "screen": "CreateAgreement",
            "path": "/agreements/create",
            "route_name": "agreement_create",
            "label": "Create Agreement",
            "aliases": ["agreement", "contract", "service agreement", "agreements"],
            "action_keywords": ["create", "new", "make", "generate", "draft", "add", "prepare"]
        },
        {
            "intent": "agreement",
            "action": "list",
            "entity": "agreement",
            "screen": "AgreementList",
            "path": "/agreements",
            "route_name": "agreement_list",
            "label": "Agreements",
            "aliases": ["agreement", "contract", "service agreement", "agreements"],
            "action_keywords": ["show", "view", "list", "open", "go to", "display", "check", "see"]
        },
        {
            "intent": "email",
            "action": "create",
            "entity": "email",
            "screen": "EmailDraft",
            "path": "/email/draft",
            "route_name": "email_draft",
            "label": "Draft Email",
            "aliases": ["email", "mail"],
            "action_keywords": ["draft", "write", "create", "new", "send", "compose"]
        },
        {
            "intent": "bulk_message",
            "action": "create",
            "entity": "bulk_message",
            "screen": "CreateBulkMessage",
            "path": "/bulk-messages/create",
            "route_name": "bulk_message_create",
            "label": "Create Bulk Email",
            "aliases": ["bulk email", "bulk message", "broadcast", "bulk mail"],
            "action_keywords": ["create", "new", "send", "draft", "compose", "write", "bulk"]
        },
        {
            "intent": "calendar",
            "action": "create",
            "entity": "event",
            "screen": "CreateCalendarEvent",
            "path": "/calendar/events/create",
            "route_name": "calendar_create",
            "label": "Schedule Meeting",
            "aliases": ["meeting", "event", "calendar", "schedule", "appointment"],
            "action_keywords": ["schedule", "create", "new", "book", "make", "add"]
        },
        {
            "intent": "calendar",
            "action": "list",
            "entity": "event",
            "screen": "Calendar",
            "path": "/calendar/events",
            "route_name": "calendar_view",
            "label": "Calendar",
            "aliases": ["meeting", "event", "calendar", "schedule", "appointment"],
            "action_keywords": ["show", "view", "list", "open", "go to", "display", "check", "see"]
        },
        {
            "intent": "group",
            "action": "create",
            "entity": "group",
            "screen": "CreateGroup",
            "path": "/groups/create",
            "route_name": "group_create",
            "label": "Create Group",
            "aliases": ["group", "community", "groups"],
            "action_keywords": ["create", "new", "make", "start"]
        },
        {
            "intent": "group",
            "action": "list",
            "entity": "group",
            "screen": "GroupsHome",
            "path": "/groups",
            "route_name": "group_home",
            "label": "Groups",
            "aliases": ["group", "community", "groups"],
            "action_keywords": ["show", "view", "list", "open", "go to", "display", "home"]
        },
        {
            "intent": "chat",
            "action": "list",
            "entity": "chat",
            "screen": "AllChat",
            "path": "/chat",
            "route_name": "chat_home",
            "label": "All Chats",
            "aliases": ["chat", "chats", "message", "messages", "inbox"],
            "action_keywords": ["show", "view", "list", "open", "go to", "display", "check", "see"]
        },
        {
            "intent": "chat",
            "action": "message",
            "entity": "chat",
            "screen": "SingleChat",
            "path": "/chat/single",
            "route_name": "chat_single",
            "label": "Chat",
            "aliases": ["chat", "message", "conversation", "client", "clients"],
            "action_keywords": ["message", "chat with", "text", "send message to", "contact"]
        },
        {
            "intent": "contacts",
            "action": "list",
            "entity": "contact",
            "screen": "Contacts",
            "path": "/contacts",
            "route_name": "contacts_list",
            "label": "Contacts",
            "aliases": ["contact", "contacts", "clients", "client", "tenant", "tenants"],
            "action_keywords": ["show", "view", "list", "open", "go to", "display", "check", "see"]
        },
        {
            "intent": "contacts",
            "action": "create",
            "entity": "contact",
            "screen": "AddContact",
            "path": "/contacts/create",
            "route_name": "contacts_create",
            "label": "Add Contact",
            "aliases": ["contact", "contacts", "client", "tenant"],
            "action_keywords": ["create", "new", "add", "save", "make"]
        },
        {
            "intent": "profile",
            "action": "view",
            "entity": "profile",
            "screen": "ProfileHome",
            "path": "/profile",
            "route_name": "profile_home",
            "label": "Profile",
            "aliases": ["profile", "my profile", "account", "settings"],
            "action_keywords": ["show", "view", "open", "go to", "display", "check"]
        },
        {
            "intent": "profile",
            "action": "business",
            "entity": "profile",
            "screen": "ProfileBusiness",
            "path": "/profile/business",
            "route_name": "profile_business",
            "label": "Business Profile",
            "aliases": ["business profile", "business settings", "company profile"],
            "action_keywords": ["show", "view", "open", "go to", "display", "check", "manage"]
        },
        {
            "intent": "profile",
            "action": "update",
            "entity": "profile",
            "screen": "ProfileEdit",
            "path": "/profile/edit",
            "route_name": "profile_edit",
            "label": "Edit Profile",
            "aliases": ["profile", "my profile", "account", "settings"],
            "action_keywords": ["edit", "update", "change", "modify"]
        },
        {
            "intent": "call",
            "action": "list",
            "entity": "call",
            "screen": "CallHistory",
            "path": "/calls",
            "route_name": "call_history",
            "label": "Open Calls",
            "aliases": ["call", "calls", "phone"],
            "action_keywords": ["show", "view", "list", "open", "go to", "display", "check"]
        }
    ]

    @staticmethod
    def _navigation_for_intent(intent: str, user_text: str) -> dict:
        normalized = user_text.lower().strip()
        best_match = None
        best_score = -1.0

        for entry in MabdelAIService.navigation_registry:
            score = 0.0

            # 1. Intent Match
            if entry["intent"] == intent:
                score += 1.5

            # 2. Alias Match
            alias_matched = False
            for alias in entry["aliases"]:
                if alias in normalized:
                    alias_matched = True
                    if " " in alias:
                        score += 3.0
                    else:
                        score += 1.5
                    break

            # 3. Action Keyword Match
            action_kws_in_prompt = [kw for kw in entry["action_keywords"] if kw in normalized]
            score += 1.0 * len(action_kws_in_prompt)

            # 4. Strict Action Context matching
            is_create = any(x in normalized for x in ["create", "new", "make", "generate", "draft", "add", "prepare", "schedule", "book", "start"])
            is_list = any(x in normalized for x in ["show", "view", "list", "open", "go to", "display", "check", "see", "history", "all "])
            is_update = any(x in normalized for x in ["edit", "update", "change", "modify"])
            is_business = "business" in normalized or "company" in normalized

            if entry["action"] == "create" and is_create:
                score += 2.0
            elif entry["action"] == "create" and is_list:
                score -= 2.0

            if entry["action"] == "list" and is_list:
                score += 2.0
            elif entry["action"] == "list" and is_create:
                score -= 2.0

            if entry["action"] == "update" and is_update:
                score += 2.0

            if entry["action"] == "business" and is_business:
                score += 2.5
            elif entry["action"] == "business" and not is_business:
                score -= 1.5

            if score > best_score:
                best_score = score
                best_match = entry

        # Calculate final confidence
        if best_match and best_score >= 1.5:
            # High confidence if intent matches or strong alias+action matches
            if best_score >= 4.0:
                confidence = 0.95
            else:
                confidence = 0.75
            should_redirect = confidence >= 0.70
            reason = f"Matched intent '{best_match['intent']}' and action '{best_match['action']}' based on prompt keywords."

            return {
                "should_redirect": should_redirect,
                "intent": best_match["intent"],
                "action": best_match["action"],
                "entity": best_match["entity"],
                "screen": best_match["screen"],
                "path": best_match["path"],
                "route_name": best_match["route_name"],
                "label": best_match["label"],
                "confidence": confidence,
                "reason": reason,
                "params": {
                    "source": "mabdel_ai",
                    "prefill_prompt": user_text.strip(),
                    "intent": best_match["intent"],
                },
            }
        else:
            return {
                "should_redirect": True,
                "intent": "chatbot",
                "action": "chat",
                "entity": "chatbot",
                "screen": "MicConversation",
                "path": "/ai/chat",
                "route_name": "chatbot",
                "label": "AI Chatbot",
                "confidence": 0.30,
                "reason": "No strong navigation match found. Redirecting to AI chatbot for conversational response.",
                "params": {
                    "source": "mabdel_ai",
                    "prefill_prompt": user_text.strip(),
                    "chatbot_fallback": True,
                },
            }

