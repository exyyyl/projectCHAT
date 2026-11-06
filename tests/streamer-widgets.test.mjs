import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTimer, normalizeTimer, normalizeWidgetOrder, restoreDashboardBlocks, pauseTimer, resetTimer, startTimer, timerRemaining } from '../ui/panel/src/domain/streamer-widgets.ts';

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

test('streamer widget order pins the essential live block and preserves optional choices', () => {
  assert.deepEqual(normalizeWidgetOrder(['timer', 'notes', 'timer', 'unknown']), ['activity', 'timer', 'notes']);
  assert.deepEqual(normalizeWidgetOrder([]), ['activity']);
  assert.deepEqual(normalizeWidgetOrder(['unknown']), ['activity', 'timer', 'counter', 'notes', 'todos', 'archive']);
});

test('splitting notes exposes legacy tasks once and preserves independent visibility after saving', () => {
  assert.deepEqual(restoreDashboardBlocks(['timer', 'notes', 'archive']), ['activity', 'timer', 'notes', 'todos', 'archive']);
  assert.deepEqual(restoreDashboardBlocks(['timer']), ['activity', 'timer']);
  assert.deepEqual(restoreDashboardBlocks([]), ['activity']);
  for (const order of [[], ['notes'], ['todos'], ['todos', 'notes']])
    assert.deepEqual(restoreDashboardBlocks(JSON.parse(JSON.stringify({ version: 2, order }))), ['activity', ...order]);
  assert.deepEqual(restoreDashboardBlocks(['notes', 'todos', 'notes']), ['activity', 'notes', 'todos']);
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
  assert.equal(extendTimer({ duration: 86400, remaining: 86400, deadline: null }, 30, 0).remaining, 86400);
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

test('timer input follows hours, minutes, seconds from the left and permits at most one day', async () => {
  const { parseTimerDuration, formatTimerInput } = await import('../ui/panel/src/domain/streamer-widgets.ts');
  for (const [input, seconds] of [['5', 18000], ['05:30', 19800], ['0:10', 600], ['00:01', 60], ['00:00:01', 1], ['1:02:03', 3723], ['10:00:01', 36001], ['23:59:59', 86399], ['24:00:00', 86400]])
    assert.equal(parseTimerDuration(input), seconds, input);
  assert.equal(parseTimerDuration(formatTimerInput('013000')), 5400);
  assert.equal(parseTimerDuration(formatTimerInput('240000')), 86400);
  for (const value of ['', ' ', '0', '0:00', '00:00:00', '5:60', '1:99:00', '00:00:60', '-2', '5.5', '600:01', '24:00:01', '24:01', '25', '99:00:00', 'abc'])
    assert.equal(parseTimerDuration(value), null, value);
});

test('day-long timers survive restoration and extensions stop at the day limit', async () => {
  const { extendTimer } = await import('../ui/panel/src/domain/streamer-widgets.ts');
  const day = {duration: 86400, remaining: 86400, deadline: null};
  const running = startTimer(day, 1000);
  assert.deepEqual(normalizeTimer(JSON.parse(JSON.stringify(running)), 11000), running);
  assert.equal(timerRemaining(running, 11000), 86390);
  const extended = extendTimer(running, 30, 11000);
  assert.equal(timerRemaining(extended, 11000), 86400);
  assert.deepEqual(normalizeTimer({duration: 86401, remaining: 86401, deadline: null}, 0), defaultTimer);
});

test('timer input fills the clock from the left without shifting typed digits', async () => {
  const { formatTimerInput } = await import('../ui/panel/src/domain/streamer-widgets.ts');
  let value = '';
  for (const expected of ['2', '22', '22:2', '22:22', '22:22:2', '22:22:22']) {
    value = formatTimerInput(value + '2');
    assert.equal(value, expected);
  }
  for (const [input, expected] of [['', ''], ['abc', ''], ['0', '0'], ['05:30', '05:30'], ['1:02:03', '1:02:03'], ['000005', '00:00:05'], ['12:', '12:'], ['12:3', '12:3'], ['1234', '12:34'], ['100000', '10:00:00']]) {
    assert.equal(formatTimerInput(input), expected);
  }
});

test('saved layouts cannot hide, duplicate or move the live console below optional blocks', () => {
  for (const saved of [[], ['activity'], ['timer', 'activity', 'notes'], ['timer', 'notes'], ['activity', 'activity']]) {
    const restored = restoreDashboardBlocks({version: 2, order: saved});
    assert.equal(restored[0], 'activity');
    assert.equal(restored.filter(id => id === 'activity').length, 1);
    assert.deepEqual(normalizeWidgetOrder(restored), restored);
    assert.deepEqual(restored.slice(1), [...new Set(saved.filter(id => id !== 'activity'))]);
  }
});

test('held block reordering inserts between optional blocks without moving the live console or hidden entries', async () => {
  const {reorderDashboardBlock} = await import('../ui/panel/src/domain/streamer-widgets.ts');
  const before=['activity','timer','notes','archive'];
  assert.deepEqual(reorderDashboardBlock(before,'archive','timer'),['activity','archive','timer','notes']);
  assert.deepEqual(reorderDashboardBlock(before,'timer','archive'),['activity','notes','archive','timer']);
  for(const [id,over] of [['activity','timer'],['timer','activity'],['counter','timer'],['timer','counter'],['timer','timer']])
    assert.deepEqual(reorderDashboardBlock(before,id,over),before);
  assert.deepEqual(before,['activity','timer','notes','archive']);
});
