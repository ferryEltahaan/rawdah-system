import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from faster_whisper import WhisperModel

files = [
    r"C:\Users\ferry\Downloads\WhatsApp Ptt 2026-09-27 at 3.50.24 PM.ogg",
    r"C:\Users\ferry\Downloads\WhatsApp Ptt 2026-09-27 at 3.51.42 PM.ogg",
]

model = WhisperModel("small", device="cpu", compute_type="int8")

for f in files:
    print("=" * 60)
    print("FILE:", f.split("\\")[-1])
    print("=" * 60)
    segments, info = model.transcribe(f, language="ar", vad_filter=False)
    print(f"[duration: {info.duration:.0f}s]")
    for seg in segments:
        print(f"[{seg.start:6.1f} -> {seg.end:6.1f}] {seg.text.strip()}")
    print()
