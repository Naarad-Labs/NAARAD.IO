"""NAARAD's Sarvam pipeline, with a fallback at every stage.

    Saaras STT -> creator verification (UI) -> Sarvam-105B publish gate
    -> Mayura translation -> Bulbul voice -> Sarvam-105B "Ask NAARAD"

Every public method returns a result dict whose "source" says where the
answer came from: "sarvam" (live), "cache" (already paid for), "passthrough"
(nothing to do) or "fallback" (offline safety net). A demo keeps working if
the venue Wi-Fi drops, and the UI shows which stage fell back.
"""

import json
import logging
import re
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor

import audio
import graph
from sarvam import SarvamError

log = logging.getLogger("naarad.studio")

# Languages covered by all three of Saaras, Mayura and Bulbul.
LANGUAGES = {
    "en-IN": "English",
    "hi-IN": "Hindi",
    "bn-IN": "Bengali",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
    "kn-IN": "Kannada",
    "ml-IN": "Malayalam",
    "mr-IN": "Marathi",
    "gu-IN": "Gujarati",
    "pa-IN": "Punjabi",
    "od-IN": "Odia",
}
SPEAKERS = [
    "priya", "kavitha", "ritu", "neha", "pooja", "simran", "kavya", "ishita", "shreya", "roopa",
    "tanya", "shruti", "suhani", "rupali", "shubh", "aditya", "rahul", "rohan", "amit", "dev",
    "ratan", "varun", "manan", "sumit", "kabir", "aayan", "ashutosh", "advait", "anand", "tarun",
    "sunny", "mani", "gokul", "vijay", "mohit", "rehan", "soham",
]

TRANSLATE_CHUNK_CHARS = 900   # Mayura accepts 1,000 characters per request
TTS_CHUNK_CHARS = 1500        # Bulbul REST accepts 2,500 characters per request
MAX_TEXT_CHARS = 5000
MAX_QUESTION_CHARS = 500
MAX_HISTORY_TURNS = 6
CLAIM_STATUSES = {"supported", "contradicted", "legend", "unverified"}

_SENTENCE_END = re.compile(r"(?<=[.!?।॥])\s+|\n+")
_INLINE_CITATION = re.compile(r"\s*\[(F\d+(?:\s*,\s*F\d+)*)\]")

MODERATION_PROMPT = """You are the publishing gate for NAARAD, an audio heritage-tour app. A local creator recorded an oral narration for the stop below. It was transcribed by speech-to-text and corrected by the creator. Review it before it is translated and voiced for travellers.

Check two things.
1. Safety. Flag hate or communal content, harassment, defamation of real people, sexual content, dangerous instructions, personal data such as phone numbers or home addresses, and advertising or spam.
2. Accuracy against the Cultural Graph below. Folklore is welcome. For each claim, set status to:
   - "legend" when the narration attributes it to someone else or frames it as belief or story ("my grandmother said", "the elders say", "people believe", "it is only a story"), whether or not the graph covers it. Every detail inside such a framed story is legend too.
   - "supported" when the narration states it as fact and a graph fact backs it,
   - "contradicted" when the narration states it as fact and it conflicts with a graph fact,
   - "unverified" when the narration states it as fact and the graph does not cover it.

{context}

Reply with JSON only, in this shape:
{{"verdict": "approve" | "review" | "reject",
 "safety": {{"safe": true | false, "categories": [string]}},
 "entities": [ids of graph entities the narration mentions],
 "claims": [{{"claim": string, "status": "supported" | "contradicted" | "legend" | "unverified", "fact_id": string or null, "note": string}}],
 "summary": one English sentence for the creator}}

Set the verdict by these rules exactly: "reject" if the narration is unsafe; otherwise "review" if any claim is "contradicted" or "unverified"; otherwise "approve". Legends never need review. Write claims, notes and the summary in English."""

ASK_PROMPT = """You are "Ask NAARAD", a heritage guide talking to a traveller who is standing at the stop below. Answer the traveller's question using the Cultural Graph facts and the creator's narration.

Rules:
- Reply in {language_name}, in two to four short sentences. The answer will be read aloud, so use plain spoken language: no lists, no markdown and no fact ids inside the answer text.
- Use only the material below. When a fact is marked (tradition) or (myth), or comes from a story in the narration, say so in the answer ("tradition says…"). If the material does not answer the question, say you don't know that yet and suggest asking the temple staff. Never invent dates, measurements or names.
- Put the ids of the facts you relied on in "citations".

{context}

Creator narration (verified by the creator, in {narration_language}):
{narration}

Reply with JSON only: {{"answer": string, "citations": [fact ids]}}"""


class Unavailable(Exception):
    """A stage failed and has no server-side fallback (TTS falls back in the browser)."""


class InputError(ValueError):
    """Bad request input; the message is safe to show the user."""


class _LRU:
    def __init__(self, size):
        self.size = size
        self._data = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            if key not in self._data:
                return None
            self._data.move_to_end(key)
            return self._data[key]

    def put(self, key, value):
        with self._lock:
            self._data[key] = value
            self._data.move_to_end(key)
            while len(self._data) > self.size:
                self._data.popitem(last=False)


def chunk_text(text, limit):
    """Pack whole sentences into chunks of at most `limit` characters."""
    chunks, current = [], ""
    for sentence in (s.strip() for s in _SENTENCE_END.split(text)):
        while len(sentence) > limit:
            cut = sentence.rfind(" ", 0, limit)
            cut = cut if cut > 0 else limit
            if current:
                chunks.append(current)
                current = ""
            chunks.append(sentence[:cut].strip())
            sentence = sentence[cut:].strip()
        if not sentence:
            continue
        candidate = f"{current} {sentence}".strip()
        if len(candidate) > limit:
            chunks.append(current)
            current = sentence
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def _parallel(fn, items):
    if len(items) == 1:
        return [fn(items[0])]
    with ThreadPoolExecutor(max_workers=min(3, len(items))) as pool:
        return list(pool.map(fn, items))


def _parse_json_reply(content):
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content)
    return json.loads(content)


def _normalise(text):
    return " ".join(text.split())


class Pipeline:
    def __init__(self, client, cultural_graph, fallbacks):
        self.client = client  # SarvamClient, or None when no API key is configured
        self.graph = cultural_graph
        self.fallbacks = fallbacks
        self._translations = _LRU(128)
        self._speech = _LRU(16)

    # ── helpers ───────────────────────────────────────────────────────────

    def _live_client(self, offline):
        return None if offline else self.client

    def _offline_reason(self, offline):
        return "Wi-Fi drop simulated" if offline else "no SARVAM_API_KEY configured"

    @staticmethod
    def _check_language(code, field="language"):
        if code not in LANGUAGES:
            raise InputError(f"Unsupported {field} '{code}'.")

    @staticmethod
    def _check_text(text, limit=MAX_TEXT_CHARS, what="Text"):
        if not isinstance(text, str) or not text.strip():
            raise InputError(f"{what} is empty.")
        if len(text) > limit:
            raise InputError(f"{what} is longer than {limit} characters.")
        return text.strip()

    def _stop(self, stop_id):
        try:
            return self.graph.stop(stop_id)
        except KeyError as exc:
            raise InputError(str(exc)) from exc

    @staticmethod
    def _ms(started):
        return int((time.monotonic() - started) * 1000)

    # ── Stage 1 · Saaras speech-to-text ───────────────────────────────────

    def transcribe(self, wav_bytes, language, offline=False, story_fallback=True):
        """Transcribe a narration. With story_fallback=False (spoken traveller
        questions) a failure raises Unavailable instead of serving the demo story."""
        self._check_language(language)
        started = time.monotonic()
        wav = audio.parse_wav(wav_bytes)
        audio.check_story_length(wav)
        chunks = audio.split_at_pauses(wav)
        base = {"duration_s": round(wav.duration, 1), "chunks": len(chunks)}
        client = self._live_client(offline)
        if client:
            try:
                parts = _parallel(lambda c: client.transcribe(c.to_bytes(), language), chunks)
                text = " ".join(p.strip() for p in parts if p.strip())
                return {
                    **base, "transcript": text, "language": language, "source": "sarvam",
                    "model": client.models.stt, "latency_ms": self._ms(started),
                    "notice": "" if text else "No speech was detected. Try again closer to the microphone.",
                }
            except SarvamError as exc:
                log.warning("Saaras STT failed, serving fallback transcript: %s", exc)
                reason = str(exc)
        else:
            reason = self._offline_reason(offline)
        if not story_fallback:
            raise Unavailable(reason)
        stories = self.fallbacks["story"]
        fb_language = language if language in stories else "en-IN"
        return {
            **base, "transcript": stories[fb_language], "language": fb_language, "source": "fallback",
            "model": None, "latency_ms": self._ms(started),
            "notice": f"Speech-to-text unavailable ({reason}). Loaded the offline demo transcript so you can continue.",
        }

    # ── Stage 3 · Mayura translation ──────────────────────────────────────

    def translate(self, text, source, target, offline=False):
        text = self._check_text(text)
        self._check_language(source, "source language")
        self._check_language(target, "target language")
        started = time.monotonic()
        base = {"source_language": source, "language": target}
        if source == target:
            return {**base, "translation": text, "source": "passthrough", "model": None, "latency_ms": 0, "notice": ""}
        key = (text, source, target)
        cached = self._translations.get(key)
        if cached is not None:
            return {**base, "translation": cached, "source": "cache", "model": None,
                    "latency_ms": self._ms(started), "notice": ""}
        client = self._live_client(offline)
        if client:
            try:
                chunks = chunk_text(text, TRANSLATE_CHUNK_CHARS)
                translation = " ".join(_parallel(lambda c: client.translate(c, source, target), chunks))
                self._translations.put(key, translation)
                return {**base, "translation": translation, "source": "sarvam", "model": client.models.translate,
                        "chunks": len(chunks), "latency_ms": self._ms(started), "notice": ""}
            except SarvamError as exc:
                log.warning("Mayura translate failed, using fallback: %s", exc)
                reason = str(exc)
        else:
            reason = self._offline_reason(offline)
        stories = self.fallbacks["story"]
        if source in stories and target in stories and _normalise(text) == _normalise(stories[source]):
            return {**base, "translation": stories[target], "source": "fallback", "model": None,
                    "latency_ms": self._ms(started),
                    "notice": f"Translation unavailable ({reason}). Served the pre-translated copy of the demo story."}
        return {**base, "language": source, "translation": text, "source": "fallback", "model": None,
                "latency_ms": self._ms(started),
                "notice": f"Translation unavailable ({reason}). Showing the original narration."}

    # ── Stage 4 · Bulbul text-to-speech ───────────────────────────────────

    def speak(self, text, language, speaker=None, offline=False):
        """Return (wav_bytes, meta). Raises Unavailable so the browser can use its own voice."""
        text = self._check_text(text)
        self._check_language(language)
        if speaker is not None and speaker not in SPEAKERS:
            raise InputError(f"Unknown speaker '{speaker}'.")
        started = time.monotonic()
        client = self._live_client(offline)
        # Resolve the default voice even when offline so already-paid-for audio still replays.
        speaker = speaker or (self.client.models.speaker if self.client else None)
        key = (text, language, speaker)
        cached = self._speech.get(key)
        if cached is not None:
            return cached, {"source": "cache", "latency_ms": self._ms(started)}
        if not client:
            raise Unavailable(self._offline_reason(offline))
        try:
            chunks = chunk_text(text, TTS_CHUNK_CHARS)
            parts = _parallel(lambda c: client.speak(c, language, speaker), chunks)
            wav = audio.concat_wavs([blob for part in parts for blob in part])
        except (SarvamError, audio.AudioError) as exc:
            log.warning("Bulbul TTS failed: %s", exc)
            raise Unavailable(str(exc)) from exc
        self._speech.put(key, wav)
        return wav, {"source": "sarvam", "model": client.models.tts, "speaker": speaker,
                     "chunks": len(chunks), "latency_ms": self._ms(started)}

    # ── Stage 5a · Sarvam-105B publish gate ───────────────────────────────

    def moderate(self, text, language, stop_id=None, offline=False):
        text = self._check_text(text)
        self._check_language(language)
        stop = self._stop(stop_id)
        started = time.monotonic()
        local = graph.find_entities(stop, text)
        client = self._live_client(offline)
        if client:
            try:
                reply = client.chat(
                    [
                        {"role": "system", "content": MODERATION_PROMPT.format(context=graph.prompt_context(stop))},
                        {"role": "user", "content": f"Narration language: {LANGUAGES[language]} ({language})\n\nNarration:\n{text}"},
                    ],
                    json_mode=True, temperature=0.1, max_tokens=1500,
                )
                result = self._normalise_moderation(_parse_json_reply(reply["content"]), stop, local, language)
                return {**result, "source": "sarvam", "model": client.models.chat, "latency_ms": self._ms(started),
                        "notice": ""}
            except (SarvamError, ValueError, AttributeError, TypeError) as exc:
                log.warning("Sarvam-105B moderation failed, holding for review: %s", exc)
                reason = str(exc)
        else:
            reason = self._offline_reason(offline)
        # Fail closed: without the automated check a story is never auto-approved.
        return {
            "verdict": "review", "safe": None, "categories": [], "claims": [],
            "entities": self._entity_list(stop, [e["id"] for e in local], set(), language),
            "summary": "Automated check unavailable, so this story is held for a heritage editor.",
            "source": "fallback", "model": None, "latency_ms": self._ms(started),
            "notice": f"Moderation unavailable ({reason}). Cultural Graph matching still ran locally.",
        }

    def _normalise_moderation(self, parsed, stop, local, language):
        if not isinstance(parsed, dict):
            raise ValueError("Moderation reply was not a JSON object")
        fact_ids = {f["id"] for f in stop["facts"]}
        safety = parsed.get("safety") if isinstance(parsed.get("safety"), dict) else {}
        safe = safety.get("safe") if isinstance(safety.get("safe"), bool) else None
        categories = [str(c) for c in safety.get("categories") or [] if c][:5]
        claims = []
        for claim in (parsed.get("claims") or [])[:12]:
            if not isinstance(claim, dict) or not claim.get("claim"):
                continue
            status = claim.get("status") if claim.get("status") in CLAIM_STATUSES else "unverified"
            fact_id = claim.get("fact_id") if claim.get("fact_id") in fact_ids else None
            claims.append({"claim": str(claim["claim"]), "status": status, "fact_id": fact_id,
                           "note": str(claim.get("note") or "")})
        # Derive the verdict from the model's own evidence so it always matches the
        # reasons the creator sees. A bare "review" with no flagged claim gives an
        # editor nothing to check, so only an explicit "reject" can override.
        if safe is False or parsed.get("verdict") == "reject":
            verdict = "reject"
        elif safe is None or any(c["status"] in ("contradicted", "unverified") for c in claims):
            verdict = "review"  # low-confidence claims go to a heritage editor before publishing
        else:
            verdict = "approve"
        entity_ids = {e["id"] for e in stop["entities"]}
        model_ids = {e for e in parsed.get("entities") or [] if e in entity_ids}
        return {
            "verdict": verdict, "safe": safe, "categories": categories, "claims": claims,
            "entities": self._entity_list(stop, [e["id"] for e in local], model_ids, language),
            "summary": str(parsed.get("summary") or ""),
        }

    @staticmethod
    def _entity_list(stop, local_ids, model_ids, language):
        out = []
        for entity in stop["entities"]:
            via = [name for name, ids in (("graph", local_ids), ("sarvam", model_ids)) if entity["id"] in ids]
            if via:
                out.append({"id": entity["id"], "type": entity["type"], "label": graph.entity_label(entity),
                            "local_label": graph.entity_label(entity, language), "via": via})
        return out

    # ── Stage 5b · Sarvam-105B "Ask NAARAD" ───────────────────────────────

    def ask(self, question, language, stop_id=None, narration="", narration_language="en-IN",
            mode="fast", history=(), offline=False):
        question = self._check_text(question, MAX_QUESTION_CHARS, "Question")
        self._check_language(language)
        if mode not in ("fast", "think"):
            raise InputError("Mode must be 'fast' or 'think'.")
        stop = self._stop(stop_id)
        started = time.monotonic()
        client = self._live_client(offline)
        if client:
            try:
                system = ASK_PROMPT.format(
                    language_name=LANGUAGES[language], context=graph.prompt_context(stop),
                    narration=(narration or "(none)")[:MAX_TEXT_CHARS],
                    narration_language=LANGUAGES.get(narration_language, "English"),
                )
                messages = [{"role": "system", "content": system}]
                for turn in list(history)[-MAX_HISTORY_TURNS:]:
                    if isinstance(turn, dict) and turn.get("role") in ("user", "assistant") and isinstance(turn.get("content"), str):
                        messages.append({"role": turn["role"], "content": turn["content"][:1000]})
                messages.append({"role": "user", "content": question})
                think = mode == "think"
                reply = client.chat(messages, think=think, json_mode=True, temperature=0.3,
                                    max_tokens=4096 if think else 700)
                answer, cited = self._parse_answer(reply["content"], stop)
                return {
                    "answer": answer, "language": language, "mode": mode,
                    "citations": [{"id": f["id"], "confidence": f["confidence"], "text": graph.fact_text(f, language)}
                                  for f in stop["facts"] if f["id"] in cited],
                    "reasoning": reply["reasoning"] if think else "",
                    "source": "sarvam", "model": client.models.chat, "latency_ms": self._ms(started), "notice": "",
                }
            except SarvamError as exc:
                log.warning("Sarvam-105B Q&A failed, answering from the offline graph: %s", exc)
                reason = str(exc)
        else:
            reason = self._offline_reason(offline)
        facts = graph.retrieve_facts(stop, question, k=1)
        prefixes, no_answer = self.fallbacks["offline_answer_prefix"], self.fallbacks["offline_no_answer"]
        text_language = language if language in prefixes else "en-IN"
        if facts:
            answer = f"{prefixes[text_language]} {graph.fact_text(facts[0], text_language)}"
        else:
            answer = no_answer[text_language]
        return {
            "answer": answer, "language": text_language, "mode": mode,
            "citations": [{"id": f["id"], "confidence": f["confidence"], "text": graph.fact_text(f, text_language)}
                          for f in facts],
            "reasoning": "", "source": "fallback", "model": None, "latency_ms": self._ms(started),
            "notice": f"Live Q&A unavailable ({reason}). Answered from the stop's offline Cultural Graph notes.",
        }

    @staticmethod
    def _parse_answer(content, stop):
        fact_ids = {f["id"] for f in stop["facts"]}
        try:
            parsed = _parse_json_reply(content)
            answer = str(parsed.get("answer") or "").strip()
            cited = [str(c) for c in parsed.get("citations") or []]
        except (ValueError, AttributeError):
            answer, cited = content.strip(), []
        # Ids leaking into the spoken text ("[F4]") would be read aloud by Bulbul.
        for match in _INLINE_CITATION.finditer(answer):
            cited += re.findall(r"F\d+", match.group(1))
        answer = _INLINE_CITATION.sub("", answer).strip()
        if not answer:
            raise SarvamError("Q&A reply had no answer text")
        return answer, [c for c in dict.fromkeys(cited) if c in fact_ids]
