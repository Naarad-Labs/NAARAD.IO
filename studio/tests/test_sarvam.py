import io
import json
import unittest
import urllib.error

from .helpers import Models, SarvamError

import sarvam  # noqa: E402


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class RecordingOpener:
    """Replays queued outcomes: a dict (JSON body), an int (HTTP error) or an exception."""

    def __init__(self, *outcomes):
        self.outcomes = list(outcomes)
        self.requests = []

    def __call__(self, req, timeout):
        self.requests.append(req)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, int):
            body = io.BytesIO(json.dumps({"error": {"message": "slow down"}}).encode())
            raise urllib.error.HTTPError(req.full_url, outcome, "err", {}, body)
        if isinstance(outcome, Exception):
            raise outcome
        return FakeResponse(json.dumps(outcome).encode())


def client(opener):
    return sarvam.SarvamClient("test-key", Models(think_effort="low"), urlopen=opener)


class SarvamClientTest(unittest.TestCase):
    def test_transcribe_sends_multipart_with_mode(self):
        opener = RecordingOpener({"transcript": "vanakkam"})
        self.assertEqual(client(opener).transcribe(b"RIFFdata", "ta-IN"), "vanakkam")
        req = opener.requests[0]
        self.assertTrue(req.full_url.endswith("/speech-to-text"))
        self.assertEqual(req.get_header("Api-subscription-key"), "test-key")
        self.assertIn("multipart/form-data; boundary=", req.get_header("Content-type"))
        for part in (b'name="model"\r\n\r\nsaaras:v3', b'name="language_code"\r\n\r\nta-IN',
                     b'name="mode"\r\n\r\ntranscribe', b'filename="clip.wav"', b"RIFFdata"):
            self.assertIn(part, req.data)

    def test_fast_chat_disables_reasoning_explicitly(self):
        opener = RecordingOpener({"choices": [{"message": {"content": "hi"}, "finish_reason": "stop"}]})
        client(opener).chat([{"role": "user", "content": "hi"}], json_mode=True)
        payload = json.loads(opener.requests[0].data)
        self.assertIn("reasoning_effort", payload)
        self.assertIsNone(payload["reasoning_effort"])
        self.assertEqual(payload["response_format"], {"type": "json_object"})

    def test_think_chat_sends_effort_and_returns_reasoning(self):
        opener = RecordingOpener({"choices": [{"message": {"content": "ok", "reasoning_content": "because"}}]})
        reply = client(opener).chat([{"role": "user", "content": "why"}], think=True)
        self.assertEqual(json.loads(opener.requests[0].data)["reasoning_effort"], "low")
        self.assertEqual(reply["reasoning"], "because")

    def test_empty_content_is_an_error(self):
        opener = RecordingOpener({"choices": [{"message": {"content": ""}, "finish_reason": "length"}]})
        with self.assertRaisesRegex(SarvamError, "finish_reason=length"):
            client(opener).chat([{"role": "user", "content": "hi"}])

    def test_retries_once_on_rate_limit(self):
        opener = RecordingOpener(429, {"translated_text": "नमस्ते"})
        self.assertEqual(client(opener).translate("Hello", "en-IN", "hi-IN"), "नमस्ते")
        self.assertEqual(len(opener.requests), 2)

    def test_client_errors_are_not_retried(self):
        opener = RecordingOpener(400)
        with self.assertRaisesRegex(SarvamError, "slow down") as ctx:
            client(opener).translate("Hello", "en-IN", "hi-IN")
        self.assertEqual(ctx.exception.status, 400)
        self.assertEqual(len(opener.requests), 1)

    def test_network_errors_fail_fast(self):
        opener = RecordingOpener(urllib.error.URLError("no route to host"))
        with self.assertRaisesRegex(SarvamError, "Network error"):
            client(opener).speak("Hello", "en-IN")
        self.assertEqual(len(opener.requests), 1)

    def test_speak_decodes_all_audio_parts(self):
        opener = RecordingOpener({"audios": ["UklGRg==", "UklGRg=="]})
        self.assertEqual(client(opener).speak("Hello", "en-IN", "kavitha"), [b"RIFF", b"RIFF"])
        self.assertEqual(json.loads(opener.requests[0].data)["speaker"], "kavitha")


if __name__ == "__main__":
    unittest.main()
