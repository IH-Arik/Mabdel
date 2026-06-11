import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from app.utils.audio import linear_to_ulaw, ulaw_to_linear, pcm_to_mulaw, mulaw_to_pcm
import struct

def test_mulaw_cycle():
    # Test a single sample
    original_sample = 1000
    ulaw = linear_to_ulaw(original_sample)
    recovered = ulaw_to_linear(ulaw)
    print(f"Original: {original_sample}, U-law: {ulaw}, Recovered: {recovered}")
    assert abs(original_sample - recovered) < 100 # Mu-law is lossy but should be close

    # Test bulk conversion
    samples = [0, 100, -100, 3000, -3000, 32000, -32000]
    pcm_data = bytearray()
    for s in samples:
        pcm_data.extend(struct.pack("<h", s))
    
    mulaw_data = pcm_to_mulaw(bytes(pcm_data))
    recovered_pcm = mulaw_to_pcm(mulaw_data)
    
    for i in range(len(samples)):
        rec_s = struct.unpack("<h", recovered_pcm[i*2:i*2+2])[0]
        print(f"Sample {i}: Orig {samples[i]}, Recov {rec_s}")

if __name__ == "__main__":
    test_mulaw_cycle()
