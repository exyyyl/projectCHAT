import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyCommand, defaultWidget, initialState, validateDraft, validateStoredState, publicState } from '../server/polls.mjs';
import { createStore } from '../server/store.mjs';
import { percentages } from '../public/shared.js';

function start(config = {}) {
  const state = initialState();
  return applyCommand(state, { type: 'start', draft: { ...state.draft, ...config }, draftRevision: 0 }, 1000).state;
}
function vote(state, changes = {}, now = 2000) { return applyCommand(state, { type: 'vote', pollId: state.poll.id, viewerId: 'viewer-1', eventId: 'event-1', message: 'майн', ...changes }, now); }

test('normalizes exact keywords, rejects duplicates and substring matches', () => {
  const state = start();
  assert.equal(vote(state, { message: '  МАЙН  ' }).state.poll.options[0].votes, 1);
  assert.equal(vote(state, { message: 'давайте майн' }).outcome, 'unmatched');
  assert.throws(() => validateDraft({ ...state.draft, options: [{ name: 'A', word: 'a' }, { name: 'B', word: 'Ａ' }] }), /различаться/);
});
test('one viewer cannot inflate counts or change choice by default', () => {
  const state = vote(start()).state;
  assert.equal(vote(state).outcome, 'duplicate-event');
  assert.equal(vote(state, { eventId: 'event-2', message: 'вало' }).outcome, 'already-voted');
  assert.equal(publicState(state).poll.voters, undefined);
  assert.equal(state.poll.options.reduce((s, o) => s + o.votes, 0), 1);
});
test('optional re-voting transfers one vote and prevents replay', () => {
  let state = vote(start({ allowChange: true })).state;
  state = vote(state, { eventId: 'event-2', message: 'вало' }).state;
  assert.deepEqual(state.poll.options.map(o => o.votes), [0, 1, 0]);
  assert.equal(vote(state, { message: 'майн' }).outcome, 'duplicate-event');
});
test('redelivery of an earlier no-op vote does not undo a later choice', () => {
  let state = vote(start({ allowChange: true })).state;
  state = vote(state, { eventId: 'same-choice' }).state;
  state = vote(state, { eventId: 'new-choice', message: 'вало' }).state;
  const replay = vote(state, { eventId: 'same-choice' });
  assert.equal(replay.outcome, 'duplicate-event');
  assert.deepEqual(replay.state.poll.options.map(o => o.votes), [0, 1, 0]);
});
test('deadline closes poll even if vote arrives before next timer tick', () => {
  const state = start({ duration: 10 });
  const result = vote(state, {}, 11000);
  assert.equal(result.outcome, 'closed');
  assert.equal(result.state.poll.status, 'ended');
  assert.equal(result.state.poll.endedAt, 11000);
  assert.equal(result.state.poll.options[0].votes, 0);
});
test('extension persists and cannot reopen an ended poll', () => {
  let state = start();
  state = applyCommand(state, { type: 'extend', pollId: state.poll.id }, 2000).state;
  assert.equal(state.poll.deadline, 91000);
  state = applyCommand(state, { type: 'finish', pollId: state.poll.id }, 5000).state;
  assert.throws(() => applyCommand(state, { type: 'extend', pollId: state.poll.id }, 6000), /завершён/);
});
test('hiding overlay preserves vote acceptance and counters', () => {
  let state = start();
  state = applyCommand(state, { type: 'visibility', pollId: state.poll.id, visible: false }, 2000).state;
  state = vote(state).state;
  assert.equal(state.poll.visible, false);
  assert.equal(state.poll.options[0].votes, 1);
});
test('panel-only poll starts hidden, counts votes, reveals and ends without resetting', () => {
  let state = start({ showOverlay: false, secret: true });
  assert.equal(state.poll.visible, false);
  state = vote(state).state;
  const deadline = state.poll.deadline;
  state = applyCommand(state, { type: 'visibility', pollId: state.poll.id, visible: true }, 3000).state;
  assert.equal(state.poll.options[0].votes, 1);
  assert.equal(state.poll.deadline, deadline);
  state = applyCommand(state, { type: 'visibility', pollId: state.poll.id, visible: false }, 4000).state;
  state = applyCommand(state, { type: 'finish', pollId: state.poll.id }, 5000).state;
  assert.equal(state.poll.visible, false);
  assert.equal(publicState(state).poll.options[0].votes, 1);
  state = applyCommand(state, { type: 'clear', pollId: state.poll.id }, 6000).state;
  assert.equal(state.draft.showOverlay, false);
});
test('legacy saved data migrates to test mode and visible default', () => {
  const state = start(); delete state.draft.source; delete state.draft.showOverlay; delete state.poll.source; delete state.poll.showOverlay; delete state.poll.activity;
  const result = validateStoredState(state);
  assert.equal(result.draft.source, 'test'); assert.equal(result.draft.showOverlay, true);
  assert.equal(result.poll.source, 'test');
  assert.deepEqual(result.poll.activity, []);
});
test('Twitch and demo votes are isolated and a live poll stays bound to channel and time', () => {
  const initial = initialState();
  let state = applyCommand(initial, { type: 'start', draftRevision: 0, draft: { ...initial.draft, source: 'twitch', showOverlay: false }, broadcasterId: '123' }, 1000).state;
  assert.equal(vote(state).outcome, 'wrong-source');
  const live = { source: 'twitch', broadcasterId: '123', sentAt: 1500, viewerName: 'Viewer' };
  assert.equal(vote(state, { ...live, broadcasterId: '456' }).outcome, 'wrong-channel-or-time');
  assert.equal(vote(state, { ...live, sentAt: 999 }).outcome, 'wrong-channel-or-time');
  state = vote(state, live).state;
  assert.equal(state.poll.options[0].votes, 1);
  assert.deepEqual(state.poll.activity, [{ id: 'event-1', viewerId: 'viewer-1', viewerName: 'Viewer', avatarUrl: '', optionId: '1', at: 1500 }]);
  assert.equal(vote(state, live).outcome, 'duplicate-event');
  const repeated = vote(state, { ...live, eventId: 'event-2', message: 'вало' });
  assert.equal(repeated.outcome, 'already-voted');
  assert.equal(repeated.state.poll.activity.length, 1);
  assert.equal(vote(start(), live).outcome, 'wrong-source');
});
test('Twitch re-vote updates one viewer row and marks the previous choice', () => {
  const initial = initialState();
  let state = applyCommand(initial, { type: 'start', draftRevision: 0, draft: { ...initial.draft, source: 'twitch', allowChange: true }, broadcasterId: '123' }, 1000).state;
  state = vote(state, { source: 'twitch', broadcasterId: '123', sentAt: 1500, viewerName: 'Viewer' }).state;
  state = vote(state, { source: 'twitch', broadcasterId: '123', sentAt: 1600, viewerName: 'Viewer', eventId: 'event-2', message: 'вало' }).state;
  assert.deepEqual(state.poll.options.map(option => option.votes), [0, 1, 0]);
  assert.equal(state.poll.activity.length, 1);
  assert.deepEqual(state.poll.activity[0], { id: 'event-2', viewerId: 'viewer-1', viewerName: 'Viewer', avatarUrl: '', optionId: '2', previousOptionId: '1', at: 1600 });
  state = applyCommand(state, { type: 'activity-avatar', pollId: state.poll.id, eventId: 'event-2', avatarUrl: 'https://static-cdn.jtvnw.net/avatar.png' }, 1700).state;
  const visible = publicState(state).poll.activity[0];
  assert.equal(visible.avatarUrl, 'https://static-cdn.jtvnw.net/avatar.png');
  assert.equal(visible.viewerId, undefined);
});
test('presets can be created, applied, updated, reordered and deleted', () => {
  let state = initialState();
  state = applyCommand(state, { type: 'preset-create', name: 'Игры', draft: { ...state.draft, question: 'Первая игра?' } }, 1000).state;
  state = applyCommand(state, { type: 'preset-create', name: 'Перерыв', draft: { ...state.draft, question: 'Когда перерыв?' } }, 2000).state;
  const [games, pause] = state.presets;
  assert.equal(games.name, 'Игры');
  assert.equal(games.draft.question, 'Первая игра?');
  state = applyCommand(state, { type: 'preset-move', presetId: pause.id, direction: -1 }, 3000).state;
  assert.deepEqual(state.presets.map(item => item.name), ['Перерыв', 'Игры']);
  state = applyCommand(state, { type: 'preset-update', presetId: games.id, name: 'Выбор игры', draft: { ...state.draft, duration: 180 } }, 4000).state;
  assert.equal(state.presets[1].name, 'Выбор игры');
  assert.equal(state.presets[1].draft.duration, 180);
  state = applyCommand(state, { type: 'preset-apply', presetId: games.id, draftRevision: state.draftRevision }, 5000).state;
  assert.equal(state.draft.duration, 180);
  assert.equal(state.draftRevision, 1);
  const nextPreset = applyCommand(state, { type: 'preset-next' }, 5500);
  assert.equal(nextPreset.outcome, 'Перерыв');
  state = nextPreset.state;
  assert.equal(state.draft.question, 'Когда перерыв?');
  assert.equal(state.draftRevision, 2);
  state = applyCommand(state, { type: 'preset-delete', presetId: pause.id }, 6000).state;
  assert.deepEqual(state.presets.map(item => item.id), [games.id]);
});
test('presets can be pinned, reordered inside their group and applied after a finished poll', () => {
  let state = initialState();
  state = applyCommand(state, { type: 'preset-create', name: 'Игры', draft: { ...state.draft, question: 'Во что играем?' } }, 1000).state;
  state = applyCommand(state, { type: 'preset-create', name: 'Перерыв', draft: { ...state.draft, question: 'Когда перерыв?' } }, 2000).state;
  state = applyCommand(state, { type: 'preset-create', name: 'Еда', draft: { ...state.draft, question: 'Что заказать?' } }, 3000).state;
  const [games, pause, food] = state.presets;
  state = applyCommand(state, { type: 'preset-toggle-pin', presetId: pause.id, pinned: true }, 4000).state;
  assert.deepEqual(state.presets.map(item => [item.name, item.pinned]), [['Перерыв', true], ['Игры', false], ['Еда', false]]);
  state = applyCommand(state, { type: 'preset-reorder', presetId: food.id, targetId: games.id, position: 'before' }, 5000).state;
  assert.deepEqual(state.presets.map(item => item.name), ['Перерыв', 'Еда', 'Игры']);
  assert.throws(() => applyCommand(state, { type: 'preset-reorder', presetId: pause.id, targetId: games.id, position: 'before' }), /своей группы/);
  state = applyCommand(state, { type: 'start', draftRevision: 0, draft: state.draft }, 6000).state;
  state = applyCommand(state, { type: 'finish', pollId: state.poll.id }, 7000).state;
  state = applyCommand(state, { type: 'preset-apply', presetId: food.id, draftRevision: state.draftRevision }, 8000).state;
  assert.equal(state.poll, null);
  assert.equal(state.draft.question, 'Что заказать?');
});
test('preset validation rejects invalid names, stale ids and unsafe stored content', () => {
  const state = initialState();
  assert.throws(() => applyCommand(state, { type: 'preset-create', name: ' ', draft: state.draft }), /Название/);
  assert.throws(() => applyCommand(state, { type: 'preset-apply', presetId: 'missing', draftRevision: 0 }), /удалён/);
  assert.throws(() => applyCommand(state, { type: 'preset-move', presetId: 'missing', direction: 2 }), /перемещение/);
  const damaged = structuredClone(state); damaged.presets = [{ id: '1', name: 'X', draft: { ...state.draft, options: [] } }];
  assert.throws(() => validateStoredState(damaged), /вариантов/);
});
test('settings import replaces the draft and presets without importing runtime state', () => {
  let state = initialState();
  const importedDraft = { ...state.draft, question: 'Что запускаем?', source: 'twitch' };
  state = applyCommand(state, {
    type: 'settings-import',
    draftRevision: 0,
    settings: {
      schema: 1,
      app: 'projectCHAT',
      draft: importedDraft,
      presets: [{ name: 'Игры', draft: { ...importedDraft, question: 'Во что играем?' } }],
      poll: { unsafe: true },
    },
  }, 5000).state;
  assert.equal(state.draft.question, 'Что запускаем?');
  assert.equal(state.presets.length, 1);
  assert.equal(state.presets[0].name, 'Игры');
  assert.equal(state.presets[0].pinned, false);
  assert.equal(state.presets[0].createdAt, 5000);
  assert.equal(state.poll, null);
  assert.equal(state.draftRevision, 1);
});
test('settings import rejects active polls and malformed backups', () => {
  const initial = initialState();
  assert.throws(() => applyCommand(initial, { type: 'settings-import', draftRevision: 0, settings: { schema: 2 } }), /не поддерживается/);
  const running = start();
  assert.throws(() => applyCommand(running, { type: 'settings-import', draftRevision: 1, settings: { schema: 1, app: 'projectCHAT', draft: initial.draft, presets: [] } }), /закройте/);
});
test('widget settings are validated, migrated, persisted and included in imports', () => {
  const initial = initialState();
  const widget = { accent: '#a970ff', surface: 'glass', density: 'compact', radius: 'large', titleSize: 'small', width: 'wide', opacity: 85, font: 'mono', optionStyle: 'cards', optionSize: 'large', keywordStyle: 'filled', barSize: 'thick', showTimer: false, showKeywords: false, showBars: false, showVotes: false, showPercentages: false };
  let state = applyCommand(initial, { type: 'widget-update', widget }).state;
  assert.deepEqual(state.widget, widget);
  assert.throws(() => applyCommand(state, { type: 'widget-update', widget: { ...widget, accent: 'purple' } }), /цвет/);
  state = applyCommand(initial, { type: 'settings-import', draftRevision: 0, settings: { schema: 1, app: 'projectCHAT', draft: initial.draft, presets: [], widget } }).state;
  assert.deepEqual(state.widget, widget);
  const legacy = { accent: '#d3fb75', surface: 'solid', density: 'comfortable', showTimer: true, showKeywords: true };
  assert.deepEqual(validateStoredState({ ...initialState(), widget: legacy }).widget, defaultWidget());
});
test('stale panel cannot replace a newer draft or mutate a different poll', () => {
  const original = initialState();
  const updated = applyCommand(original, { type: 'save-draft', draftRevision: 0, draft: { ...original.draft, question: 'Новый вопрос' } }).state;
  assert.throws(() => applyCommand(updated, { type: 'start', draftRevision: 0, draft: original.draft }), /другой панели/);
  const state = start();
  assert.throws(() => vote(state, { pollId: 'old-poll' }), /сменился/);
  assert.throws(() => applyCommand(state, { type: 'clear', pollId: state.poll.id }, 2000), /завершите/);
});
test('percentage rounding totals 100 and handles zero and ties', () => {
  assert.deepEqual(percentages([{ votes: 0 }, { votes: 0 }]), [0, 0]);
  assert.deepEqual(percentages([{ votes: 1 }, { votes: 1 }]), [50, 50]);
  assert.equal(percentages([{ votes: 1 }, { votes: 1 }, { votes: 1 }]).reduce((a, b) => a + b), 100);
});
test('serialized durable writes retain concurrent votes after restarting store', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'stream-polls-store-')), 'state.json');
  let now = 1000;
  const store = await createStore(path, { now: () => now });
  const initial = store.snapshot();
  await store.command({ type: 'preset-create', name: 'Любимый', draft: { ...initial.draft, question: 'Сохранённый вопрос' } });
  await store.command({ type: 'start', draftRevision: 0, draft: initial.draft });
  const pollId = store.snapshot().poll.id;
  await Promise.all(Array.from({ length: 30 }, (_, i) => store.command({ type: 'vote', pollId, viewerId: 'u' + i, eventId: 'e' + i, message: 'майн' })));
  await store.command({ type: 'visibility', pollId, visible: false });
  const restored = await createStore(path, { now: () => now });
  assert.equal(restored.snapshot().poll.options[0].votes, 30);
  assert.equal(restored.snapshot().poll.visible, false);
  assert.equal(restored.snapshot().presets[0].name, 'Любимый');
  assert.equal(restored.snapshot().presets[0].draft.question, 'Сохранённый вопрос');
  assert.equal((await restored.command({ type: 'vote', pollId, viewerId: 'u0', eventId: 'e-new', message: 'вало' })).outcome, 'already-voted');
  now = 100000;
  const expired = await createStore(path, { now: () => now });
  assert.equal(expired.snapshot().poll.status, 'ended');
  assert.equal(JSON.parse(await readFile(path, 'utf8')).poll.status, 'ended');
});
test('corrupt state is preserved and cannot silently reset a poll', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'stream-polls-corrupt-')), 'state.json');
  await writeFile(path, '{broken');
  await assert.rejects(createStore(path), /Исходный файл сохранён/);
  assert.equal(await readFile(path, 'utf8'), '{broken');
});
