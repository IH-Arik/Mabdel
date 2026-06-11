import asyncio
import os
import base64
from pathlib import Path
import sys

# Add project root to sys.path
root = Path(__file__).parent.parent
sys.path.append(str(root))

from app.services.mabdel_ai_service import MabdelAIService

async def test_audio():
    print("Testing Audio Synthesis...")
    service = MabdelAIService()
    
    test_text = "Hello Arik, I have prepared your invoice for the month of May."
    print(f"Synthesizing: '{test_text}'")
    
    result = service.synthesize_speech(test_text)
    
    if result and result.get("audio_base64"):
        print("  [PASS] Audio generated successfully.")
        print(f"  - Format: {result.get('format')}")
        print(f"  - Size: {len(result.get('audio_base64'))} characters (base64)")
        
        # Save to file to verify
        audio_data = base64.b64decode(result.get("audio_base64"))
        output_file = root / "test_audio.mp3"
        with open(output_file, "wb") as f:
            f.write(audio_data)
        print(f"  - Audio saved to: {output_file}")
    else:
        print("  [FAIL] Audio generation failed.")

if __name__ == "__main__":
    asyncio.run(test_audio())
