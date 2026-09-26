# NAARAD Studio: Sarvam pipeline prototype

A creator records a heritage story of up to 90 seconds. They correct the transcript, pass a safety and fact gate, and publish. A traveller then reads and hears it in their own language and can ask follow-up questions. Every stage has an offline fallback, so the demo keeps running when the venue Wi-Fi does not.

```
Creator                                            Traveller
Record ≤90 s ─► Saaras STT ─► Creator verifies ─► Sarvam-105B gate ─► Mayura ─► Bulbul ─► Ask NAARAD (Sarvam-105B)
```

## Run it

Only the Python standard library is needed (3.8+), so there is nothing to `pip install`.

```bash
SARVAM_API_KEY=your-key python3 studio/server.py      # → http://127.0.0.1:8000
```

The key stays in the server; the browser never sees it. Without a key, the Studio starts in offline-fallback mode. Use `--port` / `--host` to change where it listens. Recording needs `localhost` or HTTPS for microphone access.

Tests use `unittest` and a fake Sarvam client, so they make no network calls:

```bash
cd studio && python3 -m unittest
```

## Two-minute demo

1. **Record.** Click **Use sample narration** (a 66 s Tamil story), then **Transcribe with Saaras**. The audio goes to Saaras in 3 chunks, because the sync API takes clips under 30 s.
2. **Verify.** Select a misheard word and tap a Cultural Graph glossary term to replace it. Tick the review box, which is required. Click **Run publish check**: Sarvam-105B checks safety and tests every claim against the graph. Then publish.
3. **Translate and listen.** Pick a traveller language. Mayura translates, and **Voice it with Bulbul** plays the narration.
4. **Ask.** Tap a suggested question, or type or speak one. Switch to **Think** to show Sarvam-105B's reasoning.
5. **Kill the Wi-Fi.** Turn on **Simulate Wi-Fi drop** and run the flow again. Each stage falls back, as shown in the table below. Anything already translated or voiced replays from cache at no extra cost.

## Stages, in build order

| # | Stage | Code | Fallback when Sarvam is unreachable |
|---|---|---|---|
| 1 | Speech ingestion (`saaras:v3`) | `pipeline.transcribe`, `audio.py` | Hardcoded demo transcript (`data/fallbacks.json`) |
| 2 | Creator verification (human in the loop) | `public/studio.js` | Runs locally, so no fallback is needed |
| 3 | Translation (`mayura:v1`) | `pipeline.translate` | Pre-translated copy of the demo story, otherwise the original text |
| 4 | Voice (`bulbul:v3`) | `pipeline.speak` | Cached audio, otherwise the browser's own voice (Web Speech API) |
| 5a | Publish gate (`sarvam-105b`) | `pipeline.moderate`, `graph.py` | Fails closed ("held for editor review"). Graph entity matching still runs. |
| 5b | Ask NAARAD (`sarvam-105b`) | `pipeline.ask` | Best-matching Cultural Graph fact, in the traveller's language |

Guardrails worth pointing out:

- **90-second cap.** It is enforced in the browser, which stops recording at 90 s and rejects longer uploads. The server enforces it again from the WAV header.
- **Chunking.** Audio is cut at the quietest point between 18 s and 28 s, so words are not split.
- **Publish gate.** The verdict comes from the model's own evidence: an unsafe flag rejects, and any contradicted or unverified claim sends the story to review. It is also always shown next to those reasons. Entity and fact IDs the model invents are dropped.
- **Q&A grounding.** Answers must cite fact IDs. Traditions and myths are hedged in the answer ("tradition says…"). Off-graph questions get "I don't know yet".

## Model names (checked against the live API on 26 Sep 2026)

The original plan named models that Sarvam has since retired. The Studio uses their successors, and each one can be overridden with an env var:

| Planned | Status | Used instead | Env var |
|---|---|---|---|
| `saarika:v1` / `saaras:v1` | Deprecated / invalid | `saaras:v3` (`mode=transcribe`) | `NAARAD_STT_MODEL` |
| `mayura:v1` | Current | `mayura:v1` | `NAARAD_TRANSLATE_MODEL` |
| `bulbul:v1`, speaker `meera` | Deprecated; `meera` removed | `bulbul:v3`, speaker `priya` | `NAARAD_TTS_MODEL`, `NAARAD_TTS_SPEAKER` |
| `sarvam-m` | Deprecated | `sarvam-105b` | `NAARAD_CHAT_MODEL` |

Think mode sends `reasoning_effort` (`NAARAD_THINK_EFFORT`, default `low`). Fast mode sends `reasoning_effort: null`, because Sarvam turns thinking on by default. Expect fast answers in about 1–2 s and think answers in about 10–30 s.

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/health` | — | Mode, models, languages, speakers, cap |
| GET | `/api/graph` | — | The mock Cultural Graph |
| POST | `/api/transcribe?language=ta-IN[&purpose=question]` | 16-bit PCM WAV | `transcript`, `chunks`, `source` |
| POST | `/api/translate` | `{text, source_language, target_language}` | `translation`, `language`, `source` |
| POST | `/api/speak` | `{text, language, speaker}` | `audio/wav` with `X-Naarad-Source`, or 503 `{fallback: "browser-tts"}` |
| POST | `/api/moderate` | `{text, language, stop_id}` | `verdict`, `claims`, `entities`, `summary` |
| POST | `/api/ask` | `{question, language, mode, narration, narration_language, history}` | `answer`, `citations`, `reasoning` |

Send the header `X-Naarad-Offline: 1` to force a fallback, which is what the UI switch does. The `source` field on each result is `sarvam`, `cache`, `passthrough` or `fallback`.

## Known limits

- Translation and voice cover 11 languages, the set Saaras, Mayura and Bulbul share. `sarvam-translate:v1` would extend translation to all 22.
- The mock Cultural Graph (`data/cultural_graph.json`) has one stop. Its Tamil and Hindi text was drafted with Mayura and corrected by hand, because the drafts garbled local names (for example "சத்திய விஷா" for சதய விழா).
- The creator reviews the transcript, but nobody reviews the translation yet. In testing, Mayura rendered கேளுங்கள் ("listen") as "ask". Adding a back-translation check or an editor review of translations is the natural next step.
- The sample narration is a synthetic Bulbul voice, so real creator audio will transcribe less cleanly. That is the case the verification step exists for.
