import unittest

from .helpers import audio, tone_wav


class ParseWavTest(unittest.TestCase):
    def test_round_trip(self):
        wav = audio.parse_wav(tone_wav(1.5).to_bytes())
        self.assertEqual((wav.channels, wav.sample_width, wav.rate), (1, 2, 16000))
        self.assertAlmostEqual(wav.duration, 1.5, places=3)

    def test_rejects_non_wav(self):
        with self.assertRaisesRegex(audio.AudioError, "PCM WAV"):
            audio.parse_wav(b"definitely not audio")

    def test_rejects_8_bit(self):
        wav = audio.Wav(1, 1, 8000, b"\x80" * 8000)
        with self.assertRaisesRegex(audio.AudioError, "16-bit"):
            audio.parse_wav(wav.to_bytes())


class StoryCapTest(unittest.TestCase):
    def test_accepts_exactly_90_seconds(self):
        audio.check_story_length(audio.Wav(1, 2, 16000, b"\x00\x00" * 16000 * 90))

    def test_rejects_over_90_seconds(self):
        wav = audio.Wav(1, 2, 16000, b"\x00\x00" * 16000 * 92)
        with self.assertRaisesRegex(audio.AudioError, "capped at 90 s"):
            audio.check_story_length(wav)

    def test_rejects_near_empty(self):
        with self.assertRaisesRegex(audio.AudioError, "too short"):
            audio.check_story_length(audio.Wav(1, 2, 16000, b"\x00\x00" * 100))


class SplitAtPausesTest(unittest.TestCase):
    def test_short_clip_is_one_chunk(self):
        self.assertEqual(len(audio.split_at_pauses(tone_wav(20))), 1)

    def test_chunks_fit_sarvam_limit_and_keep_every_frame(self):
        wav = tone_wav(89)
        chunks = audio.split_at_pauses(wav)
        self.assertGreaterEqual(len(chunks), 4)
        self.assertTrue(all(c.duration <= audio.CHUNK_MAX_SECONDS for c in chunks))
        self.assertEqual(sum(c.n_frames for c in chunks), wav.n_frames)
        self.assertEqual(b"".join(c.frames for c in chunks), wav.frames)

    def test_cuts_inside_a_pause(self):
        wav = tone_wav(50, silences=[(23.0, 23.6)])
        first = audio.split_at_pauses(wav)[0]
        self.assertGreater(first.duration, 23.0)
        self.assertLess(first.duration, 23.6)


class ConcatTest(unittest.TestCase):
    def test_joins_same_format(self):
        joined = audio.parse_wav(audio.concat_wavs([tone_wav(1).to_bytes(), tone_wav(2).to_bytes()]))
        self.assertAlmostEqual(joined.duration, 3.0, places=3)

    def test_refuses_mixed_rates(self):
        with self.assertRaises(audio.AudioError):
            audio.concat_wavs([tone_wav(1).to_bytes(), tone_wav(1, rate=22050).to_bytes()])


if __name__ == "__main__":
    unittest.main()
