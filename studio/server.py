#!/usr/bin/env python3
"""NAARAD Studio: local prototype server for the Sarvam creator -> traveller pipeline.

    SARVAM_API_KEY=... python3 studio/server.py          # http://127.0.0.1:8000

Serves the UI from public/ and a small JSON API under /api/. The Sarvam key
stays on this machine. With no key, or with the UI's "Simulate Wi-Fi drop"
switch on, every stage uses its offline fallback so the demo keeps running.
Standard library only: nothing to pip install.
"""

import argparse
import json
import logging
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import audio
import graph
import pipeline
from sarvam import Models, SarvamClient

ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
DATA_DIR = ROOT / "data"
MAX_AUDIO_BYTES = 6 * 1024 * 1024  # 90 s of 16 kHz mono 16-bit WAV is about 2.9 MB
MAX_JSON_BYTES = 64 * 1024
OFFLINE_HEADER = "X-Naarad-Offline"

log = logging.getLogger("naarad.studio")


class RequestError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def build_pipeline(api_key):
    client = SarvamClient(api_key) if api_key else None
    with open(DATA_DIR / "fallbacks.json", encoding="utf-8") as fh:
        fallbacks = json.load(fh)
    return pipeline.Pipeline(client, graph.CulturalGraph.load(DATA_DIR / "cultural_graph.json"), fallbacks)


class StudioHandler(SimpleHTTPRequestHandler):
    app = None  # a pipeline.Pipeline, bound by make_server()
    server_version = "NAARADStudio/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    # ── Routing ───────────────────────────────────────────────────────────

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/health":
            self._send_json(200, self._health())
        elif path == "/api/graph":
            self._send_json(200, {"stops": list(self.app.graph.stops.values())})
        elif path.startswith("/api/"):
            self._send_json(404, {"error": "Not found."})
        else:
            super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        routes = {
            "/api/transcribe": self._transcribe,
            "/api/translate": self._translate,
            "/api/speak": self._speak,
            "/api/moderate": self._moderate,
            "/api/ask": self._ask,
        }
        route = routes.get(path)
        if route is None:
            self._send_json(404, {"error": "Not found."})
            return
        try:
            route()
        except (pipeline.InputError, audio.AudioError) as exc:
            self._send_json(400, {"error": str(exc)})
        except RequestError as exc:
            self._send_json(exc.status, {"error": str(exc)})
        except Exception:
            log.exception("Unhandled error on %s", path)
            self._send_json(500, {"error": "Internal error. Check the server log."})

    # ── API handlers ──────────────────────────────────────────────────────

    def _health(self):
        client = self.app.client
        models = client.models if client else Models()
        return {
            "status": "ok",
            "sarvam": "live" if client else "offline",
            "models": models.as_dict(),
            "languages": pipeline.LANGUAGES,
            "speakers": pipeline.SPEAKERS,
            "max_story_seconds": audio.MAX_STORY_SECONDS,
        }

    def _transcribe(self):
        query = parse_qs(urlsplit(self.path).query)
        language = (query.get("language") or ["ta-IN"])[0]
        is_question = (query.get("purpose") or ["story"])[0] == "question"
        body = self._read_body(MAX_AUDIO_BYTES)
        try:
            result = self.app.transcribe(body, language, offline=self._offline(), story_fallback=not is_question)
        except pipeline.Unavailable as exc:
            self._send_json(503, {"error": f"Voice input unavailable ({exc}). Type your question instead."})
            return
        self._send_json(200, result)

    def _translate(self):
        req = self._read_json()
        self._send_json(200, self.app.translate(
            req.get("text"), req.get("source_language"), req.get("target_language"), offline=self._offline()))

    def _speak(self):
        req = self._read_json()
        try:
            wav, meta = self.app.speak(req.get("text"), req.get("language"), req.get("speaker"),
                                       offline=self._offline())
        except pipeline.Unavailable as exc:
            self._send_json(503, {"error": f"Voice synthesis unavailable ({exc}).", "fallback": "browser-tts"})
            return
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(wav)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Naarad-Source", meta["source"])
        self.send_header("X-Naarad-Model", meta.get("model") or "")
        self.send_header("X-Naarad-Latency-Ms", str(meta["latency_ms"]))
        self.end_headers()
        self.wfile.write(wav)

    def _moderate(self):
        req = self._read_json()
        self._send_json(200, self.app.moderate(
            req.get("text"), req.get("language"), req.get("stop_id"), offline=self._offline()))

    def _ask(self):
        req = self._read_json()
        history = req.get("history") if isinstance(req.get("history"), list) else []
        self._send_json(200, self.app.ask(
            req.get("question"), req.get("language"), stop_id=req.get("stop_id"),
            narration=req.get("narration") or "", narration_language=req.get("narration_language") or "en-IN",
            mode=req.get("mode") or "fast", history=history, offline=self._offline()))

    # ── Plumbing ──────────────────────────────────────────────────────────

    def _offline(self):
        return self.headers.get(OFFLINE_HEADER) == "1"

    def _read_body(self, limit):
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            raise RequestError(411, "Content-Length is required.")
        if length > limit:
            raise RequestError(413, f"Request body is larger than {limit // 1024} KB.")
        return self.rfile.read(length)

    def _read_json(self):
        try:
            data = json.loads(self._read_body(MAX_JSON_BYTES).decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise RequestError(400, "Request body must be JSON.")
        if not isinstance(data, dict):
            raise RequestError(400, "Request body must be a JSON object.")
        return data

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404, "Not found")
        return None

    def log_message(self, fmt, *args):
        log.info("%s %s", self.address_string(), fmt % args)


def make_server(host, port, api_key=None, app=None):
    handler = type("BoundStudioHandler", (StudioHandler,), {"app": app or build_pipeline(api_key)})
    return ThreadingHTTPServer((host, port), handler)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run the NAARAD Studio prototype server.")
    parser.add_argument("--host", default=os.environ.get("NAARAD_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")))
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    api_key = os.environ.get("SARVAM_API_KEY", "").strip()
    server = make_server(args.host, args.port, api_key)
    mode = "live Sarvam calls" if api_key else "offline fallbacks only (set SARVAM_API_KEY for live calls)"
    print(f"NAARAD Studio on http://{args.host}:{args.port}  ·  {mode}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
