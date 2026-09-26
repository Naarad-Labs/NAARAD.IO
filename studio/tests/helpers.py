"""Shared fixtures: synthetic audio and a fake Sarvam client (no network)."""

import json
import math
import sys
import threading
from array import array
from pathlib import Path

STUDIO = Path(__file__).resolve().parent.parent
if str(STUDIO) not in sys.path:
    sys.path.insert(0, str(STUDIO))

import audio  # noqa: E402
import graph  # noqa: E402
import pipeline  # noqa: E402
from sarvam import Models, SarvamError  # noqa: E402

RATE = 16000


def tone_wav(seconds, rate=RATE, silences=()):
    """A 440 Hz tone with silent gaps at the given (start, end) second ranges."""
    samples = array("h")
    for i in range(int(seconds * rate)):
        t = i / rate
        silent = any(start <= t < end for start, end in silences)
        samples.append(0 if silent else int(8000 * math.sin(2 * math.pi * 440 * t)))
    if sys.byteorder == "big":
        samples.byteswap()
    return audio.Wav(1, 2, rate, samples.tobytes())


def load_pipeline(client):
    fallbacks = json.loads((STUDIO / "data" / "fallbacks.json").read_text(encoding="utf-8"))
    return pipeline.Pipeline(client, graph.CulturalGraph.load(STUDIO / "data" / "cultural_graph.json"), fallbacks)


class FakeClient:
    """Stands in for SarvamClient. Set `fail` to make every call raise."""

    def __init__(self, chat_replies=None, fail=False):
        self.models = Models(stt="saaras:v3", translate="mayura:v1", tts="bulbul:v3",
                             speaker="priya", chat="sarvam-105b", think_effort="low")
        self.fail = fail
        self.chat_replies = list(chat_replies or [])
        self.calls = []
        self._lock = threading.Lock()

    def _record(self, name, *args):
        with self._lock:
            self.calls.append((name, args))
        if self.fail:
            raise SarvamError("Network error calling Sarvam: simulated")

    def transcribe(self, wav_bytes, language):
        self._record("transcribe", language)
        seconds = audio.parse_wav(wav_bytes).duration
        return f"part-{seconds:.0f}s"

    def translate(self, text, source, target):
        self._record("translate", text, source, target)
        return f"<{target}>{text}"

    def speak(self, text, language, speaker=None):
        self._record("speak", text, language, speaker)
        return [tone_wav(0.5).to_bytes()]

    def chat(self, messages, think=False, json_mode=False, max_tokens=800, temperature=None):
        self._record("chat", messages, think, json_mode)
        reply = self.chat_replies.pop(0) if self.chat_replies else "{}"
        content = reply if isinstance(reply, str) else json.dumps(reply)
        return {"content": content, "reasoning": "step by step" if think else "", "usage": {}}
