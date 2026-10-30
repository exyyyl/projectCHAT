import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTimer, normalizeTimer, normalizeWidgetOrder, pauseTimer, resetTimer, startTimer, timerRemaining } from '../ui/panel/src/domain/streamer-widgets.ts';

test('streamer timer continues across remounts and pauses at its remaining time', () => {
  const started = startTimer(defaultTimer, 10_000);
  assert.equal(timerRemaining(started, 71_000), 239);
  const restored = normalizeTimer(JSON.parse(JSON.stringify(started)), 71_000);
  assert.equal(timerRemaining(restored, 71_000), 239);
  const paused = pauseTimer(restored, 71_000);
  assert.equal(timerRemaining(paused, 200_000), 239);
  assert.equal(timerRemaining(resetTimer(paused), 200_000), 300);
  assert.equal(normalizeTimer(started, 400_000).remaining, 0);
});

test('streamer widget order accepts known widgets once and preserves an empty layout', () => {
  assert.deepEqual(normalizeWidgetOrder(['timer', 'notes', 'timer', 'unknown']), ['timer', 'notes']);
  assert.deepEqual(normalizeWidgetOrder([]), []);
  assert.deepEqual(normalizeWidgetOrder(['unknown']), ['activity', 'timer', 'counter', 'notes', 'archive']);
});
