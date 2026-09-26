import json
import unittest

from .helpers import FakeClient, audio, load_pipeline, pipeline, tone_wav


class ChunkTextTest(unittest.TestCase):
    def test_packs_whole_sentences_under_limit(self):
        text = " ".join(f"Sentence number {i} is here." for i in range(60))
        chunks = pipeline.chunk_text(text, 200)
        self.assertTrue(all(len(c) <= 200 for c in chunks))
        self.assertTrue(all(c.endswith(".") for c in chunks))
        self.assertEqual(" ".join(chunks), text)

    def test_splits_on_danda(self):
        chunks = pipeline.chunk_text("पहला वाक्य। दूसरा वाक्य।", 14)
        self.assertEqual(chunks, ["पहला वाक्य।", "दूसरा वाक्य।"])

    def test_hard_splits_a_sentence_longer_than_limit(self):
        chunks = pipeline.chunk_text("word " * 100, 50)
        self.assertTrue(all(len(c) <= 50 for c in chunks))
        self.assertEqual(" ".join(chunks).split(), ["word"] * 100)


class TranscribeTest(unittest.TestCase):
    def test_long_story_is_chunked_and_joined_in_order(self):
        client = FakeClient()
        story = tone_wav(60, silences=[(25.0, 25.5), (50.0, 50.5)])  # pauses decide the cuts
        result = load_pipeline(client).transcribe(story.to_bytes(), "ta-IN")
        self.assertEqual(result["source"], "sarvam")
        self.assertEqual(result["chunks"], 3)
        self.assertEqual(len([c for c in client.calls if c[0] == "transcribe"]), 3)
        self.assertTrue(result["transcript"].startswith("part-"))
        self.assertEqual(len(result["transcript"].split()), 3)

    def test_falls_back_to_demo_transcript_when_sarvam_fails(self):
        app = load_pipeline(FakeClient(fail=True))
        result = app.transcribe(tone_wav(5).to_bytes(), "hi-IN")
        self.assertEqual(result["source"], "fallback")
        self.assertEqual(result["language"], "hi-IN")
        self.assertEqual(result["transcript"], app.fallbacks["story"]["hi-IN"])
        self.assertIn("Network error", result["notice"])

    def test_unknown_fallback_language_uses_english(self):
        result = load_pipeline(None).transcribe(tone_wav(5).to_bytes(), "bn-IN")
        self.assertEqual(result["language"], "en-IN")

    def test_question_mode_never_serves_the_story(self):
        with self.assertRaises(pipeline.Unavailable):
            load_pipeline(None).transcribe(tone_wav(3).to_bytes(), "ta-IN", story_fallback=False)

    def test_simulated_offline_skips_sarvam(self):
        client = FakeClient()
        result = load_pipeline(client).transcribe(tone_wav(5).to_bytes(), "ta-IN", offline=True)
        self.assertEqual(result["source"], "fallback")
        self.assertEqual(client.calls, [])

    def test_cap_is_enforced_before_any_call(self):
        client = FakeClient()
        with self.assertRaises(audio.AudioError):
            load_pipeline(client).transcribe(tone_wav(95).to_bytes(), "ta-IN")
        self.assertEqual(client.calls, [])


class TranslateTest(unittest.TestCase):
    def test_live_translation_is_cached(self):
        client = FakeClient()
        app = load_pipeline(client)
        first = app.translate("Hello there.", "en-IN", "hi-IN")
        second = app.translate("Hello there.", "en-IN", "hi-IN")
        self.assertEqual(first["source"], "sarvam")
        self.assertEqual(second["source"], "cache")
        self.assertEqual(second["translation"], "<hi-IN>Hello there.")
        self.assertEqual(len(client.calls), 1)

    def test_long_text_stays_under_mayura_limit(self):
        client = FakeClient()
        text = " ".join(f"This is sentence {i} of the narration." for i in range(80))
        load_pipeline(client).translate(text, "en-IN", "ta-IN")
        sent = [call[1][0] for call in client.calls]
        self.assertGreater(len(sent), 1)
        self.assertTrue(all(len(t) <= pipeline.TRANSLATE_CHUNK_CHARS for t in sent))

    def test_same_language_is_passthrough(self):
        client = FakeClient()
        result = load_pipeline(client).translate("வணக்கம்", "ta-IN", "ta-IN")
        self.assertEqual(result["source"], "passthrough")
        self.assertEqual(client.calls, [])

    def test_offline_serves_pretranslated_demo_story(self):
        app = load_pipeline(None)
        result = app.translate(app.fallbacks["story"]["ta-IN"], "ta-IN", "en-IN")
        self.assertEqual(result["source"], "fallback")
        self.assertEqual(result["translation"], app.fallbacks["story"]["en-IN"])
        self.assertEqual(result["language"], "en-IN")

    def test_offline_edited_text_shows_original(self):
        result = load_pipeline(None).translate("An edited story.", "en-IN", "hi-IN")
        self.assertEqual(result["translation"], "An edited story.")
        self.assertEqual(result["language"], "en-IN")

    def test_rejects_unsupported_language(self):
        with self.assertRaises(pipeline.InputError):
            load_pipeline(None).translate("Hello", "en-IN", "xx-IN")


class SpeakTest(unittest.TestCase):
    def test_chunks_are_joined_into_one_wav_and_cached(self):
        client = FakeClient()
        app = load_pipeline(client)
        text = " ".join(f"Line {i} of a long narration." for i in range(120))
        wav, meta = app.speak(text, "en-IN", "kavitha")
        self.assertEqual(meta["source"], "sarvam")
        self.assertEqual(audio.parse_wav(wav).duration, 0.5 * meta["chunks"])
        _, again = app.speak(text, "en-IN", "kavitha", offline=True)
        self.assertEqual(again["source"], "cache")  # already-paid-for audio replays offline

    def test_offline_without_cache_defers_to_the_browser(self):
        with self.assertRaises(pipeline.Unavailable):
            load_pipeline(FakeClient()).speak("Hello", "en-IN", offline=True)

    def test_rejects_unknown_speaker(self):
        with self.assertRaises(pipeline.InputError):
            load_pipeline(FakeClient()).speak("Hello", "en-IN", "meera")


class ModerateTest(unittest.TestCase):
    def moderate(self, reply, text="The Big Temple of Thanjavur was built by Rajaraja Chola."):
        return load_pipeline(FakeClient(chat_replies=[reply])).moderate(text, "en-IN")

    def test_clean_story_is_approved_with_graph_entities(self):
        result = self.moderate({"verdict": "approve", "safety": {"safe": True, "categories": []},
                                "entities": ["rajaraja-chola-i"], "claims": [
                                    {"claim": "Built by Rajaraja Chola", "status": "supported", "fact_id": "F1"}],
                                "summary": "Looks good."})
        self.assertEqual(result["verdict"], "approve")
        ids = {e["id"]: e["via"] for e in result["entities"]}
        self.assertEqual(ids["rajaraja-chola-i"], ["graph", "sarvam"])
        self.assertEqual(ids["thanjavur"], ["graph"])

    def test_unsafe_is_rejected_even_if_model_says_approve(self):
        result = self.moderate({"verdict": "approve", "safety": {"safe": False, "categories": ["personal data"]}})
        self.assertEqual(result["verdict"], "reject")

    def test_contradicted_or_unverified_claims_need_review(self):
        for status in ("contradicted", "unverified"):
            result = self.moderate({"verdict": "approve", "safety": {"safe": True},
                                    "claims": [{"claim": "Built in 1850", "status": status, "fact_id": "F1"}]})
            self.assertEqual(result["verdict"], "review", status)

    def test_bare_review_without_evidence_is_approved(self):
        result = self.moderate({"verdict": "review", "safety": {"safe": True},
                                "claims": [{"claim": "A legend", "status": "legend"}]})
        self.assertEqual(result["verdict"], "approve")

    def test_missing_safety_verdict_needs_review(self):
        self.assertEqual(self.moderate({"verdict": "approve"})["verdict"], "review")

    def test_hallucinated_ids_are_dropped(self):
        result = self.moderate({"safety": {"safe": True}, "entities": ["taj-mahal"],
                                "claims": [{"claim": "x", "status": "made-up", "fact_id": "F99"}]})
        self.assertNotIn("taj-mahal", [e["id"] for e in result["entities"]])
        self.assertEqual(result["claims"][0]["status"], "unverified")
        self.assertIsNone(result["claims"][0]["fact_id"])

    def test_unparseable_reply_fails_closed(self):
        result = self.moderate("this is not json")
        self.assertEqual((result["source"], result["verdict"]), ("fallback", "review"))

    def test_offline_still_matches_entities_locally(self):
        result = load_pipeline(None).moderate("தஞ்சாவூர் பெரிய கோவிலில் நந்தி உள்ளது.", "ta-IN")
        self.assertEqual(result["verdict"], "review")
        self.assertEqual({e["id"] for e in result["entities"]}, {"thanjavur", "brihadeeswarar-temple", "nandi"})


class AskTest(unittest.TestCase):
    def test_answer_with_citations_and_think_mode(self):
        client = FakeClient(chat_replies=[{"answer": "Tradition says it was hauled up a ramp.", "citations": ["F4", "F99"]}])
        result = load_pipeline(client).ask("How was the capstone lifted?", "en-IN", mode="think",
                                           history=[{"role": "user", "content": "hi"}, {"role": "system", "content": "x"}])
        self.assertEqual(result["source"], "sarvam")
        self.assertEqual([c["id"] for c in result["citations"]], ["F4"])
        self.assertEqual(result["reasoning"], "step by step")
        messages, think = client.calls[0][1][0], client.calls[0][1][1]
        self.assertTrue(think)
        self.assertEqual([m["role"] for m in messages], ["system", "user", "user"])  # system turn from history dropped

    def test_inline_fact_ids_are_stripped_from_spoken_text(self):
        client = FakeClient(chat_replies=["The vimana is about 66 metres tall [F2]."])
        result = load_pipeline(client).ask("How tall?", "en-IN")
        self.assertEqual(result["answer"], "The vimana is about 66 metres tall.")
        self.assertEqual([c["id"] for c in result["citations"]], ["F2"])

    def test_offline_answer_comes_from_graph_in_travellers_language(self):
        result = load_pipeline(None).ask("क्या सच में शिखर की छाया नहीं पड़ती?", "hi-IN")
        self.assertEqual(result["source"], "fallback")
        self.assertEqual(result["citations"][0]["id"], "F5")
        self.assertIn("मिथक", result["answer"])

    def test_offline_unknown_question_says_so(self):
        app = load_pipeline(None)
        result = app.ask("Where can I park my car?", "en-IN")
        self.assertEqual(result["answer"], app.fallbacks["offline_no_answer"]["en-IN"])
        self.assertEqual(result["citations"], [])

    def test_empty_model_answer_falls_back(self):
        result = load_pipeline(FakeClient(chat_replies=[json.dumps({"answer": ""})])).ask("Is it true the tower casts no shadow?", "en-IN")
        self.assertEqual(result["source"], "fallback")

    def test_validates_input(self):
        app = load_pipeline(None)
        with self.assertRaises(pipeline.InputError):
            app.ask("   ", "en-IN")
        with self.assertRaises(pipeline.InputError):
            app.ask("Why?", "en-IN", mode="slow")
        with self.assertRaises(pipeline.InputError):
            app.ask("Why?", "en-IN", stop_id="nowhere")


if __name__ == "__main__":
    unittest.main()
