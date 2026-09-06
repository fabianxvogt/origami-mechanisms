import test from "node:test";
import assert from "node:assert/strict";
import { createMotionLoop, PLAYBACK_MAX_DEG } from "./motion.js";

function fakeTimers() {
  const active = new Map();
  let nextId = 1;
  return {
    active,
    setTimer(callback) { const id = nextId++; active.set(id, callback); return id; },
    clearTimer(id) { active.delete(id); }
  };
}

test("stopping motion removes the old timer before a replacement draft can change", () => {
  const timers = fakeTimers();
  let angle = 38;
  const writes = [];
  const loop = createMotionLoop({ getAngle: () => angle, setAngle: (next) => { angle = next; writes.push(next); }, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

  loop.start();
  assert.equal(loop.isPlaying(), true);
  assert.equal(timers.active.size, 1);
  loop.stop();
  angle = 77;
  assert.equal(loop.isPlaying(), false);
  assert.equal(timers.active.size, 0);
  assert.deepEqual(writes, []);
});

test("motion reaches the 160 degree bound without a discontinuous jump", () => {
  const timers = fakeTimers();
  let angle = PLAYBACK_MAX_DEG - 1;
  const loop = createMotionLoop({ getAngle: () => angle, setAngle: (next) => { angle = next; }, setTimer: timers.setTimer, clearTimer: timers.clearTimer });

  loop.start();
  [...timers.active.values()][0]();
  assert.equal(angle, PLAYBACK_MAX_DEG);
  [...timers.active.values()][0]();
  assert.equal(angle, PLAYBACK_MAX_DEG - 2);
  loop.stop();
  loop.stop();
  assert.equal(timers.active.size, 0);
});
