import wave
import io
import struct
from datetime import datetime, timezone

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def linear_to_ulaw(sample: int) -> int:
    """
    Converts a 16-bit signed integer sample to 8-bit u-law.
    """
    BIAS = 0x84
    CLIP = 32635
    
    sign = (sample >> 8) & 0x80
    if sample < 0:
        sample = -sample
    if sample > CLIP:
        sample = CLIP
    sample += BIAS
    
    exponent = 7
    while exponent > 0 and not (sample & (0x4000 >> (7 - exponent))):
        exponent -= 1
        
    mantissa = (sample >> (exponent + 3)) & 0x0F
    return ~(sign | (exponent << 4) | mantissa) & 0xFF

def ulaw_to_linear(ulaw_byte: int) -> int:
    """
    Converts an 8-bit u-law sample to a 16-bit signed integer.
    """
    ulaw_byte = ~ulaw_byte & 0xFF
    sign = (ulaw_byte & 0x80)
    exponent = (ulaw_byte >> 4) & 0x07
    mantissa = ulaw_byte & 0x0F
    
    sample = (mantissa << (exponent + 3)) + (0x84 << exponent) - 0x84
    if sign:
        sample = -sample
    return sample

def mulaw_to_pcm(mulaw_data: bytes) -> bytes:
    """
    Converts 8-bit mu-law to 16-bit PCM (little endian).
    """
    pcm = bytearray()
    for b in mulaw_data:
        sample = ulaw_to_linear(b)
        pcm.extend(struct.pack("<h", sample))
    return bytes(pcm)

def pcm_to_mulaw(pcm_bytes: bytes) -> bytes:
    """
    Converts 16-bit PCM (little endian) to 8-bit mu-law.
    """
    mulaw = bytearray()
    for i in range(0, len(pcm_bytes), 2):
        if i + 1 >= len(pcm_bytes):
            break
        sample = struct.unpack("<h", pcm_bytes[i:i+2])[0]
        mulaw.append(linear_to_ulaw(sample))
    return bytes(mulaw)

def wav_to_mulaw(wav_bytes: bytes) -> bytes:
    """
    Extracts PCM from WAV and converts to mu-law.
    Assumes mono 16-bit PCM.
    """
    with io.BytesIO(wav_bytes) as buf:
        with wave.open(buf, "rb") as wav_file:
            pcm_data = wav_file.readframes(wav_file.getnframes())
            return pcm_to_mulaw(pcm_data)
