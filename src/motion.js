export const PLAYBACK_MAX_DEG = 160;

export function createMotionLoop({ getAngle, setAngle, min = 0, max = PLAYBACK_MAX_DEG, step = 2, intervalMs = 55, setTimer = globalThis.setInterval, clearTimer = globalThis.clearInterval, onPlayingChange = () => {} }) {
  let timer = null;
  let direction = 1;

  function stop() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    direction = 1;
    onPlayingChange(false);
  }

  function start() {
    if (timer !== null) return;
    direction = 1;
    onPlayingChange(true);
    timer = setTimer(() => {
      let angle = Number(getAngle()) + direction * step;
      if (angle >= max || angle <= min) direction *= -1;
      angle = Math.max(min, Math.min(max, angle));
      setAngle(angle);
    }, intervalMs);
  }

  return { start, stop, toggle: () => (timer === null ? start() : stop()), isPlaying: () => timer !== null };
}
