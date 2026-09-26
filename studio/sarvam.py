"""Minimal Sarvam AI REST client (stdlib only, no SDK install needed on event Wi-Fi).

Each method makes exactly one HTTP call and raises SarvamError on any
failure. Chunking and fallbacks are the pipeline's job, not the client's.
"""

import base64
import json
import os
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, field

API_BASE = "https://api.sarvam.ai"
RETRY_STATUSES = {429, 500, 502, 503, 504}


class SarvamError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


def _env(name, default):
    return os.environ.get(name) or default


@dataclass
class Models:
    """Model IDs, overridable by env var. Defaults are the current successors of
    saarika:v1 / bulbul:v1 / sarvam-m, which Sarvam has deprecated."""
    stt: str = field(default_factory=lambda: _env("NAARAD_STT_MODEL", "saaras:v3"))
    translate: str = field(default_factory=lambda: _env("NAARAD_TRANSLATE_MODEL", "mayura:v1"))
    tts: str = field(default_factory=lambda: _env("NAARAD_TTS_MODEL", "bulbul:v3"))
    speaker: str = field(default_factory=lambda: _env("NAARAD_TTS_SPEAKER", "priya"))
    chat: str = field(default_factory=lambda: _env("NAARAD_CHAT_MODEL", "sarvam-105b"))
    think_effort: str = field(default_factory=lambda: _env("NAARAD_THINK_EFFORT", "low"))

    def as_dict(self):
        return dict(self.__dict__)


class SarvamClient:
    def __init__(self, api_key, models=None, base_url=API_BASE, urlopen=urllib.request.urlopen):
        self.api_key = api_key
        self.models = models or Models()
        self.base_url = base_url.rstrip("/")
        self._urlopen = urlopen

    # ── Endpoints ─────────────────────────────────────────────────────────

    def transcribe(self, wav_bytes, language_code):
        """Speech-to-text for one clip under 30 s. Returns the transcript string."""
        fields = {"model": self.models.stt, "language_code": language_code}
        if self.models.stt.startswith("saaras:v3"):
            fields["mode"] = "transcribe"
        body, content_type = _multipart(fields, {"file": ("clip.wav", "audio/wav", wav_bytes)})
        data = self._post("/speech-to-text", body, content_type, timeout=45)
        if "transcript" not in data:
            raise SarvamError("Speech-to-text response had no transcript")
        return data["transcript"]

    def translate(self, text, source_language, target_language):
        """Translate up to 1,000 characters with Mayura. Returns the translated string."""
        payload = {
            "input": text,
            "source_language_code": source_language,
            "target_language_code": target_language,
            "model": self.models.translate,
        }
        data = self._post_json("/translate", payload, timeout=30)
        if "translated_text" not in data:
            raise SarvamError("Translate response had no translated_text")
        return data["translated_text"]

    def speak(self, text, language_code, speaker=None):
        """Text-to-speech for up to 2,500 characters. Returns a list of WAV byte strings."""
        payload = {
            "text": text,
            "target_language_code": language_code,
            "model": self.models.tts,
            "speaker": speaker or self.models.speaker,
        }
        data = self._post_json("/text-to-speech", payload, timeout=60)
        audios = data.get("audios") or []
        if not audios:
            raise SarvamError("Text-to-speech response had no audio")
        return [base64.b64decode(a) for a in audios]

    def chat(self, messages, think=False, json_mode=False, max_tokens=800, temperature=None):
        """Chat completion. Thinking is on by default in Sarvam's API, so fast mode
        must send reasoning_effort=null explicitly."""
        payload = {
            "model": self.models.chat,
            "messages": messages,
            "max_tokens": max_tokens,
            "reasoning_effort": self.models.think_effort if think else None,
        }
        if temperature is not None:
            payload["temperature"] = temperature
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        data = self._post_json("/v1/chat/completions", payload, timeout=120 if think else 45)
        try:
            choice = data["choices"][0]
            message = choice["message"]
        except (KeyError, IndexError, TypeError) as exc:
            raise SarvamError("Chat response had no choices") from exc
        content = (message.get("content") or "").strip()
        if not content:
            raise SarvamError(f"Chat returned no content (finish_reason={choice.get('finish_reason')})")
        return {
            "content": content,
            "reasoning": message.get("reasoning_content") or "",
            "usage": data.get("usage") or {},
        }

    # ── Transport ─────────────────────────────────────────────────────────

    def _post_json(self, path, payload, timeout):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        return self._post(path, body, "application/json", timeout)

    def _post(self, path, body, content_type, timeout):
        headers = {"api-subscription-key": self.api_key, "Content-Type": content_type}
        for attempt in (1, 2):
            req = urllib.request.Request(self.base_url + path, data=body, headers=headers, method="POST")
            try:
                with self._urlopen(req, timeout=timeout) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                if exc.code in RETRY_STATUSES and attempt == 1:
                    time.sleep(0.8)
                    continue
                raise SarvamError(_error_message(exc), status=exc.code) from exc
            except OSError as exc:  # URLError, timeouts, connection resets
                # Network is down or slow: fail fast so the caller can fall back.
                raise SarvamError(f"Network error calling Sarvam: {exc}") from exc
            except ValueError as exc:
                raise SarvamError("Sarvam returned a non-JSON response") from exc
        raise SarvamError("Sarvam request failed")  # pragma: no cover


def _error_message(exc):
    try:
        data = json.loads(exc.read().decode("utf-8"))
    except Exception:
        return f"Sarvam HTTP {exc.code}"
    err = data.get("error") if isinstance(data, dict) else None
    if isinstance(err, dict) and err.get("message"):
        return f"Sarvam HTTP {exc.code}: {err['message']}"
    if isinstance(data, dict) and data.get("detail"):
        return f"Sarvam HTTP {exc.code}: {data['detail']}"
    return f"Sarvam HTTP {exc.code}"


def _multipart(fields, files):
    boundary = "naarad-" + uuid.uuid4().hex
    out = bytearray()
    for name, value in fields.items():
        out += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    for name, (filename, content_type, data) in files.items():
        out += (
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode()
        out += data + b"\r\n"
    out += f"--{boundary}--\r\n".encode()
    return bytes(out), f"multipart/form-data; boundary={boundary}"
