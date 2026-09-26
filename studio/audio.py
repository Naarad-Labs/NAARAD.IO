"""WAV helpers for the ingestion pipeline (stdlib only).

The browser normalises every recording or upload to 16 kHz mono 16-bit WAV
before sending it, so the server can check the 90-second story cap exactly
and split the audio for Sarvam's synchronous speech-to-text API, which
rejects anything over 30 seconds.
"""

import io
import sys
import wave
from array import array
from dataclasses import dataclass

MAX_STORY_SECONDS = 90.0
# Browsers pad encoded audio slightly, so allow half a second over the cap.
CAP_TOLERANCE_SECONDS = 0.5
MIN_STORY_SECONDS = 0.5

# Sarvam's REST STT limit is 30 s; keep headroom and cut at the quietest
# moment between CHUNK_MIN and CHUNK_MAX so words are not split in half.
CHUNK_MAX_SECONDS = 28.0
CHUNK_MIN_SECONDS = 18.0
PAUSE_WINDOW_SECONDS = 0.05


class AudioError(ValueError):
    """The upload is not usable audio; the message is safe to show the user."""


@dataclass
class Wav:
    channels: int
    sample_width: int
    rate: int
    frames: bytes

    @property
    def frame_size(self):
        return self.channels * self.sample_width

    @property
    def n_frames(self):
        return len(self.frames) // self.frame_size

    @property
    def duration(self):
        return self.n_frames / self.rate

    def slice(self, start, end):
        fs = self.frame_size
        return Wav(self.channels, self.sample_width, self.rate, self.frames[start * fs:end * fs])

    def to_bytes(self):
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(self.channels)
            w.setsampwidth(self.sample_width)
            w.setframerate(self.rate)
            w.writeframes(self.frames)
        return buf.getvalue()


def parse_wav(data):
    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            wav = Wav(w.getnchannels(), w.getsampwidth(), w.getframerate(), w.readframes(w.getnframes()))
    except (wave.Error, EOFError) as exc:
        raise AudioError("Audio must be a PCM WAV file.") from exc
    if wav.sample_width != 2:
        raise AudioError("Audio must be 16-bit PCM.")
    if wav.rate <= 0 or wav.n_frames == 0:
        raise AudioError("The recording is empty.")
    return wav


def check_story_length(wav):
    """Enforce NAARAD's 90-second narration cap."""
    if wav.duration < MIN_STORY_SECONDS:
        raise AudioError("The recording is too short to transcribe.")
    if wav.duration > MAX_STORY_SECONDS + CAP_TOLERANCE_SECONDS:
        raise AudioError(
            f"The recording is {wav.duration:.0f} s long. NAARAD stories are capped at "
            f"{MAX_STORY_SECONDS:.0f} s; trim it and try again."
        )


def split_at_pauses(wav, max_seconds=CHUNK_MAX_SECONDS, min_seconds=CHUNK_MIN_SECONDS):
    """Split into chunks no longer than max_seconds, cutting at the quietest window."""
    max_frames = int(max_seconds * wav.rate)
    min_frames = int(min_seconds * wav.rate)
    window = max(1, int(PAUSE_WINDOW_SECONDS * wav.rate))
    chunks, start = [], 0
    while wav.n_frames - start > max_frames:
        cut = _quietest_frame(wav, start + min_frames, start + max_frames, window)
        chunks.append(wav.slice(start, cut))
        start = cut
    chunks.append(wav.slice(start, wav.n_frames))
    return chunks


def _quietest_frame(wav, lo, hi, window):
    samples = array("h")
    samples.frombytes(wav.frames[lo * wav.frame_size:hi * wav.frame_size])
    if sys.byteorder == "big":
        samples.byteswap()
    step = window * wav.channels
    best_offset, best_energy = 0, None
    for offset in range(0, len(samples) - step + 1, step):
        energy = sum(s * s for s in samples[offset:offset + step])
        if best_energy is None or energy < best_energy:
            best_offset, best_energy = offset, energy
    return lo + best_offset // wav.channels + window // 2


def concat_wavs(blobs):
    """Join WAV files that share one format (used to stitch TTS chunks)."""
    parts = [parse_wav(b) for b in blobs]
    first = parts[0]
    for p in parts[1:]:
        if (p.channels, p.sample_width, p.rate) != (first.channels, first.sample_width, first.rate):
            raise AudioError("Cannot join WAV files with different formats.")
    return Wav(first.channels, first.sample_width, first.rate, b"".join(p.frames for p in parts)).to_bytes()
