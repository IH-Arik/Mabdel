import base64
import json
import asyncio
from typing import Any, Callable
from datetime import datetime, timezone, timedelta
import wave
import io

from app.services.mabdel_ai_service import MabdelAIService
from app.services.smartflow_service import SmartFlowService
from app.schemas.call import CallStreamEvent, TwilioStreamMessage

# Mu-law constants
MU_LAW_SILENCE = 0xFF
SAMPLE_RATE = 8000

class AIPhoneAgent:
    """
    Handles a single live phone call session.
    """
    def __init__(self, call_id: str, ai_service: MabdelAIService, flow_service: SmartFlowService):
        self.call_id = call_id
        self.ai_service = ai_service
        self.flow_service = flow_service
        self.audio_buffer = bytearray()
        self.is_processing = False
        self.stream_sid = None
        self.last_audio_time = 0
        self.silence_threshold = 1.5 
        self.greeted = False
        self.user_id = None # Will be set during session start
        self.conversation_state = {} # e.g. {"phase": "scheduling", "proposed_slot": "15:00"}
        
    async def greet(self, send_callback: Callable):
        if self.greeted:
            return
        self.greeted = True
        greeting_text = "Hello, I am Mabdel, your business operations assistant. How can I help you today?"
        audio_result = self.ai_service.synthesize_speech(greeting_text)
        if audio_result and audio_result.get("audio_base64"):
            await self.stream_audio_to_twilio(audio_result["audio_base64"], send_callback)

    async def handle_media(self, payload_base64: str, stream_sid: str, send_callback: Callable):
        self.stream_sid = stream_sid
        audio_chunk = base64.b64decode(payload_base64)
        self.audio_buffer.extend(audio_chunk)
        
        # In a real-world app, we would use a more sophisticated VAD (Voice Activity Detection).
        # For this implementation, we rely on the fact that Twilio streams are real-time.
        # We'll trigger processing if we have enough audio and there's a pause in the user's intent 
        # (or just simple timing for this demo).
        
        # Trigger processing if buffer is large enough (e.g. 3 seconds of audio)
        # or if we detect silence (implied here by not receiving non-silence for a while).
        if len(self.audio_buffer) > SAMPLE_RATE * 5: # 5 seconds max before forced processing
            await self.process_and_respond(send_callback)

    async def process_and_respond(self, send_callback: Callable):
        if self.is_processing or not self.audio_buffer:
            return
            
        self.is_processing = True
        print(f"Call {self.call_id}: Processing {len(self.audio_buffer)} bytes of audio...")
        
        try:
            # 1. Convert Mu-law buffer to WAV for Whisper
            wav_data = self._mulaw_to_wav(self.audio_buffer)
            self.audio_buffer = bytearray() # Clear buffer
            
            # 2. Transcribe
            audio_b64 = base64.b64encode(wav_data).decode("utf-8")
            transcript, error = self.ai_service._transcribe_audio_with_openai(
                audio_base64=audio_b64,
                audio_mime_type="audio/wav",
                audio_filename=f"call_{self.call_id}.wav"
            )
            
            if not transcript or len(transcript.strip()) < 2:
                self.is_processing = False
                return

            print(f"Call {self.call_id}: Transcript: '{transcript}'")
            
            # 3. Generate AI Response
            # We check if we are in a special conversation state (like scheduling)
            if self.conversation_state.get("phase") == "awaiting_confirmation":
                if "yes" in transcript.lower() or "sure" in transcript.lower() or "ok" in transcript.lower():
                    # Create the meeting request
                    slot_hour = int(slot.split(":")[0])
                    start_time = datetime(2026, 5, 11, slot_hour, 0, tzinfo=timezone.utc)
                    end_time = start_time + timedelta(hours=1)
                    
                    await self.flow_service.create_calendar_event(self.user_id, {
                        "title": f"Meeting with caller ({self.call_id})",
                        "starts_at": start_time,
                        "ends_at": end_time,
                        "status": "pending",
                        "description": "Automatically scheduled by AI Phone Agent. Awaiting your approval.",
                    })
                    response_text = f"Perfect. I've scheduled a meeting request for {slot}. Anything else?"
                    self.conversation_state = {}
                else:
                    response_text = "No problem. Would you like to pick another time or should I help with something else?"
                    self.conversation_state = {}
            else:
                ai_response = self.ai_service.generate_response(transcript)
                response_text = ai_response.get("content", "I'm sorry, could you repeat that?")
                
                # Check if the AI wants to schedule a meeting
                if ai_response.get("command_type") == "calendar" or "schedule" in transcript.lower():
                    from datetime import date
                    slots = await self.flow_service.find_free_slots(self.user_id, date(2026, 5, 11))
                    if slots:
                        proposed = slots[0]
                        response_text = f"I see you're free at {proposed}. Should I schedule a meeting request for you at that time?"
                        self.conversation_state = {"phase": "awaiting_confirmation", "proposed_slot": proposed}
                    else:
                        response_text = "I'm sorry, it looks like there are no free slots available today."

            print(f"Call {self.call_id}: AI Response: '{response_text}'")
            
            # 4. Synthesize Speech
            audio_result = self.ai_service.synthesize_speech(response_text)
            
            if audio_result and audio_result.get("audio_base64"):
                await self.stream_audio_to_twilio(audio_result["audio_base64"], send_callback)
                
        except Exception as e:
            print(f"Error in AI Phone Agent: {e}")
        finally:
            self.is_processing = False

    async def stream_audio_to_twilio(self, audio_base64: str, send_callback: Callable):
        """
        Sends audio back to Twilio in the required format.
        OpenAI WAV is 24kHz 16-bit PCM. Twilio needs 8kHz 8-bit Mu-law.
        """
        if not self.stream_sid:
            return

        from app.utils.audio import pcm_to_mulaw
        import wave
        import io

        # 1. Extract PCM from WAV
        audio_data = base64.b64decode(audio_base64)
        with io.BytesIO(audio_data) as buf:
            with wave.open(buf, "rb") as wav_file:
                # OpenAI returns 24000Hz mono 16-bit
                pcm_data = wav_file.readframes(wav_file.getnframes())
        
        # 2. Downsample 24kHz -> 8kHz (Keep 1 out of every 3 samples)
        # Each sample is 2 bytes (16-bit)
        downsampled_pcm = bytearray()
        for i in range(0, len(pcm_data), 6): # 6 bytes = 3 samples of 2 bytes each
            downsampled_pcm.extend(pcm_data[i:i+2])
            
        # 3. Convert to Mu-law
        mulaw_data = pcm_to_mulaw(bytes(downsampled_pcm))
        
        # 4. Stream to Twilio in chunks of 160 bytes (20ms)
        chunk_size = 160
        for i in range(0, len(mulaw_data), chunk_size):
            chunk = mulaw_data[i:i + chunk_size]
            message = {
                "event": "media",
                "streamSid": self.stream_sid,
                "media": {
                    "payload": base64.b64encode(chunk).decode("utf-8")
                }
            }
            await send_callback(message)

    async def finalize_session(self):
        """
        Saves the final transcript and generates a summary.
        """
        if not self.user_id:
            return
            
        # 1. Update the final transcript in the database
        # (Assuming the transcript was being built, but for now we'll just log)
        # In a real app, we'd accumulate 'transcript' and 'ai_response' in a session log.
        print(f"Call {self.call_id}: Finalizing session...")

    def _mulaw_to_wav(self, mulaw_data: bytes) -> bytes:
        """
        Converts mu-law data to standard 16-bit PCM WAV header for Whisper.
        """
        from app.utils.audio import mulaw_to_pcm
        pcm_data = mulaw_to_pcm(mulaw_data)
        
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2) # 2 bytes per sample for 16-bit PCM
            wav_file.setframerate(SAMPLE_RATE)
            wav_file.writeframes(pcm_data)
        return buf.getvalue()
