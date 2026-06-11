import asyncio
import os
import base64
from pathlib import Path
import sys

# Add project root to sys.path
root = Path(".").absolute()
sys.path.append(str(root))

from app.services.mabdel_ai_service import MabdelAIService

async def test_transcription():
    print("Testing Audio Transcription...")
    service = MabdelAIService()
    
    # Path to the previously generated audio
    # Note: I'll search for it since the previous path was a bit complex
    audio_files = list(Path(".").rglob("test_audio.mp3"))
    if not audio_files:
        print("  [FAIL] test_audio.mp3 not found. Run test_voice.py first.")
        return
        
    audio_path = audio_files[0]
    print(f"Reading: '{audio_path}'")
    
    with open(audio_path, "rb") as f:
        audio_content = f.read()
    
    audio_base64 = base64.b64encode(audio_content).decode("utf-8")
    
    # Test transcribe_voice
    transcript, error = service._transcribe_audio_with_openai(
        audio_base64=audio_base64,
        audio_mime_type="audio/mpeg",
        audio_filename="test_audio.mp3"
    )
    
    if transcript:
        print(f"  [PASS] Transcription successful: '{transcript}'")
    else:
        print(f"  [FAIL] Transcription failed: {error}")

if __name__ == "__main__":
    asyncio.run(test_transcription())
