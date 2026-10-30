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

test('timer extension preserves a running deadline and a paused timer stays paused', async () => {
  const { extendTimer } = await import('../ui/panel/src/domain/streamer-widgets.ts');
  const running = startTimer(defaultTimer, 1000);
  const extended = extendTimer(running, 30, 61000);
  assert.equal(timerRemaining(extended, 61000), 270);
  assert.equal(extended.duration, 300);
  const paused = extendTimer(pauseTimer(extended, 61000), 30, 90000);
  assert.equal(paused.remaining, 300);
  assert.equal(paused.deadline, null);
  assert.equal(extendTimer({ duration: 36000, remaining: 36000, deadline: null }, 30, 0).remaining, 36000);
});

test('counter settings migrate existing values, bound direct edits and preserve a reset baseline', async () => {
  const { normalizeCounter, counterValue, normalizeActivities } = await import('../ui/panel/src/domain/streamer-widgets.ts');
  assert.deepEqual(normalizeCounter({ label: 'Deaths', value: 42 }), { label: 'Deaths', value: 42, step: 1, reset: 0 });
  assert.deepEqual(normalizeCounter({ label: 'Score', value: -10, step: 50, reset: 100 }), { label: 'Score', value: -10, step: 50, reset: 100 });
  assert.equal(normalizeCounter({ value: '42', step: -3 }).value, 0);
  assert.equal(normalizeCounter({ value: 4, step: -3 }).step, 1);
  assert.equal(counterValue(1000001), 1000000);
  assert.equal(counterValue(-1000001), -1000000);
  assert.deepEqual(normalizeActivities(['polls', 'polls', 'unknown', 'decision-wheel']), ['polls', 'decision-wheel']);
  assert.deepEqual(normalizeActivities([]), []);
});
