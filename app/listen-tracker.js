// Tracks honest audio listening time by counting seconds of actual playback.
// First draft by Aider (qwen3.5-397b via FreeLLMAPI); the sleep cap and the missing-item guard are Claude's.

// A background tab's timer can be throttled to about once a minute, so a step a little over 60 s is real playback.
const MAX_STEP_SECONDS = 120;

export function createListenTracker({ record, flushEverySeconds = 5, now = Date.now, setTimer = setInterval, clearTimer = clearInterval }) {
  let currentItemId = null;
  let lastCountedTime = null;
  let timerId = null;

  /* Record the whole seconds played since the last count. A gap longer than the cap (a laptop that slept) is
     dropped, not carried forward, so it can never be credited as listening later. */
  function flush() {
    if (currentItemId === null || lastCountedTime === null) return;
    const current = now();
    const seconds = Math.floor((current - lastCountedTime) / 1000);
    if (seconds <= 0) return;
    if (seconds > MAX_STEP_SECONDS) {
      lastCountedTime = current;
      return;
    }
    record(currentItemId, seconds);
    lastCountedTime += seconds * 1000;
  }

  function update(player) {
    const itemId = player?.playing ? player.item?.id ?? null : null;

    if (itemId === null) {
      flush();
      if (timerId !== null) clearTimer(timerId);
      timerId = null;
      currentItemId = null;
      lastCountedTime = null;
      return;
    }

    if (currentItemId !== itemId) {
      flush();
      currentItemId = itemId;
      lastCountedTime = now();
    }
    if (timerId === null) timerId = setTimer(flush, flushEverySeconds * 1000);
  }

  return { update, flush };
}
