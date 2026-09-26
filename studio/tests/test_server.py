import json
import threading
import unittest
import urllib.error
import urllib.request

from .helpers import FakeClient, audio, load_pipeline, tone_wav

import server  # noqa: E402  (helpers put studio/ on sys.path)


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.make_server("127.0.0.1", 0, app=load_pipeline(FakeClient(chat_replies=[
            {"answer": "It rises about 66 metres.", "citations": ["F2"]}])))
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def request(self, path, body=None, headers=None, json_body=None):
        headers = dict(headers or {})
        if json_body is not None:
            body = json.dumps(json_body).encode()
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(self.base + path, data=body, headers=headers,
                                     method="POST" if body is not None else "GET")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status, dict(resp.headers), resp.read()
        except urllib.error.HTTPError as exc:
            return exc.code, dict(exc.headers), exc.read()

    def test_health_reports_models_and_cap(self):
        status, _, body = self.request("/api/health")
        data = json.loads(body)
        self.assertEqual(status, 200)
        self.assertEqual(data["sarvam"], "live")
        self.assertEqual(data["models"]["tts"], "bulbul:v3")
        self.assertEqual(data["max_story_seconds"], 90)
        self.assertIn("ta-IN", data["languages"])

    def test_graph(self):
        status, _, body = self.request("/api/graph")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["stops"][0]["id"], "thanjavur-big-temple")

    def test_transcribe_wav_body(self):
        status, _, body = self.request("/api/transcribe?language=ta-IN", tone_wav(3).to_bytes(),
                                       {"Content-Type": "audio/wav"})
        data = json.loads(body)
        self.assertEqual((status, data["source"], data["chunks"]), (200, "sarvam", 1))

    def test_transcribe_rejects_bad_audio_and_over_cap(self):
        status, _, body = self.request("/api/transcribe?language=ta-IN", b"nope")
        self.assertEqual(status, 400)
        self.assertIn("WAV", json.loads(body)["error"])
        status, _, body = self.request("/api/transcribe?language=ta-IN", tone_wav(92).to_bytes())
        self.assertEqual(status, 400)
        self.assertIn("90", json.loads(body)["error"])

    def test_question_audio_offline_is_503_not_the_story(self):
        status, _, body = self.request("/api/transcribe?language=hi-IN&purpose=question", tone_wav(2).to_bytes(),
                                       {"X-Naarad-Offline": "1"})
        self.assertEqual(status, 503)
        self.assertIn("Type your question", json.loads(body)["error"])

    def test_body_size_limit(self):
        status, _, _ = self.request("/api/translate", b"x" * (server.MAX_JSON_BYTES + 1),
                                    {"Content-Type": "application/json"})
        self.assertEqual(status, 413)

    def test_translate_and_invalid_json(self):
        status, _, body = self.request("/api/translate", json_body={
            "text": "Hello.", "source_language": "en-IN", "target_language": "ta-IN"})
        self.assertEqual((status, json.loads(body)["translation"]), (200, "<ta-IN>Hello."))
        status, _, _ = self.request("/api/translate", b"{broken", {"Content-Type": "application/json"})
        self.assertEqual(status, 400)
        status, _, _ = self.request("/api/translate", json_body=["not", "an", "object"])
        self.assertEqual(status, 400)

    def test_speak_returns_wav_with_provenance_headers(self):
        status, headers, body = self.request("/api/speak", json_body={"text": "Vanakkam.", "language": "ta-IN"})
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "audio/wav")
        self.assertEqual(headers["X-Naarad-Source"], "sarvam")
        self.assertGreater(audio.parse_wav(body).duration, 0)

    def test_speak_offline_tells_browser_to_use_device_voice(self):
        status, _, body = self.request("/api/speak", json_body={"text": "Something new.", "language": "en-IN"},
                                       headers={"X-Naarad-Offline": "1"})
        self.assertEqual(status, 503)
        self.assertEqual(json.loads(body)["fallback"], "browser-tts")

    def test_ask(self):
        status, _, body = self.request("/api/ask", json_body={"question": "How tall is the tower?", "language": "en-IN"})
        data = json.loads(body)
        self.assertEqual(status, 200)
        self.assertEqual(data["answer"], "It rises about 66 metres.")
        self.assertEqual(data["citations"][0]["id"], "F2")

    def test_unknown_routes_and_static_files(self):
        self.assertEqual(self.request("/api/nope")[0], 404)
        self.assertEqual(self.request("/api/nope", json_body={})[0], 404)
        status, headers, body = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn(b"NAARAD Studio", body)
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(self.request("/samples/")[0], 404)  # no directory listings


if __name__ == "__main__":
    unittest.main()
