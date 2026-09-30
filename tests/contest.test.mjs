import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContest } from '../server/contest.mjs';

async function fixture(t) {
  let time = 1_000_000;
  const directory = await mkdtemp(join(tmpdir(), 'projectchat-contest-'));
  const contest = await createContest(join(directory, 'contest.json'), {
    now: () => time,
    randomInt: maximum => Math.min(1, maximum - 1),
  });
  t.after(() => contest.drain());
  return {
    contest,
    now: () => time,
    advance: value => { time += value; },
    message: (viewerId, viewerName, text, eventId = crypto.randomUUID(), roles = ['viewer']) => ({ broadcasterId: 'channel', viewerId, viewerName, roles, eventId, text, sentAt: time }),
  };
}

test('contest collects exact unique keyword messages and closes on timer', async t => {
  const f = await fixture(t);
  await f.contest.command({ type: 'start', broadcasterId: 'channel', setup: { keyword: 'Приз', duration: 10 } });
  const id = f.contest.snapshot().contest.id;
  assert.equal('title' in f.contest.snapshot().contest, false);
  await f.contest.chat(f.message('a', 'Alice', 'ПРИЗ', 'a1'));
  await f.contest.chat(f.message('a', 'Alice', 'приз', 'a2'));
  await f.contest.chat(f.message('b', 'Bob', 'хочу приз', 'b1'));
  await f.contest.chat({ ...f.message('c', 'Carol', 'приз', 'c1'), broadcasterId: 'other' });
  assert.deepEqual(f.contest.snapshot().contest.participants.map(item => item.name), ['Alice']);
  f.advance(10_000);
  await f.contest.tick();
  assert.equal(f.contest.snapshot().contest.status, 'ready');
  await f.contest.chat(f.message('d', 'Dan', 'приз'));
  assert.equal(f.contest.snapshot().contest.participants.length, 1);
  assert.equal(f.contest.snapshot().contest.id, id);
});

test('roulette selects once and keeps only winner messages', async t => {
  const f = await fixture(t);
  await f.contest.command({ type: 'start', broadcasterId: 'channel', setup: { keyword: 'go', duration: 30 } });
  const id = f.contest.snapshot().contest.id;
  await f.contest.chat(f.message('a', 'Alice', 'go', 'a1'));
  await f.contest.chat(f.message('b', 'Bob', 'go', 'b1'));
  await f.contest.command({ type: 'close', contestId: id });
  await f.contest.command({ type: 'draw', contestId: id });
  assert.equal(f.contest.snapshot().contest.winner.name, 'Bob');
  await f.contest.chat(f.message('a', 'Alice', 'я здесь', 'a2'));
  await f.contest.chat(f.message('b', 'Bob', 'я здесь', 'b2'));
  assert.deepEqual(f.contest.snapshot().contest.winnerMessages.map(item => item.text), ['go', 'я здесь']);
});

test('demo contest works without Twitch and produces participants and winner chat', async t => {
  const f = await fixture(t);
  await f.contest.command({ type: 'start', setup: { keyword: 'go', duration: 30, source: 'test' } });
  const id = f.contest.snapshot().contest.id;
  await f.contest.command({ type: 'demo', contestId: id });
  await f.contest.command({ type: 'demo', contestId: id });
  assert.equal(f.contest.snapshot().contest.participants.length, 2);
  await f.contest.command({ type: 'close', contestId: id });
  await f.contest.command({ type: 'draw', contestId: id });
  await f.contest.command({ type: 'demo', contestId: id });
  assert.equal(f.contest.snapshot().contest.source, 'test');
  assert.equal(f.contest.snapshot().contest.winnerMessages.length, 2);
});

test('active mode admits any chatter and manual eligibility controls the draw', async t => {
  const f = await fixture(t);
  await f.contest.command({
    type: 'start',
    broadcasterId: 'channel',
    setup: { mode: 'active', duration: 30 },
  });
  const id = f.contest.snapshot().contest.id;
  await f.contest.chat(f.message('a', 'Alice', 'Привет', 'a1'));
  await f.contest.chat(f.message('b', 'Bob', 'Я тоже здесь', 'b1'));
  await f.contest.command({ type: 'eligibility', contestId: id, participantId: 'b', eligible: false });
  const before = f.contest.snapshot().contest;
  assert.equal(before.mode, 'active');
  assert.deepEqual(before.participants.map(item => [item.name, item.eligible]), [
    ['Alice', true],
    ['Bob', false],
  ]);
  await f.contest.command({ type: 'draw', contestId: id });
  assert.equal(f.contest.snapshot().contest.winner.name, 'Alice');
});

test('audience groups admit only selected Twitch roles', async t => {
  const f = await fixture(t);
  await f.contest.command({
    type: 'start',
    broadcasterId: 'channel',
    setup: { keyword: 'go', duration: 30, allowedRoles: ['subscriber', 'vip'] },
  });
  await f.contest.chat(f.message('a', 'Viewer', 'go', 'a1', ['viewer']));
  await f.contest.chat(f.message('b', 'Subscriber', 'go', 'b1', ['subscriber']));
  await f.contest.chat(f.message('c', 'Moderator', 'go', 'c1', ['moderator']));
  await f.contest.chat(f.message('d', 'VIP subscriber', 'go', 'd1', ['vip', 'subscriber']));
  assert.deepEqual(f.contest.snapshot().contest.participants.map(item => item.name), ['Subscriber', 'VIP subscriber']);
});

test('contest requires at least one audience group', async t => {
  const f = await fixture(t);
  await assert.rejects(
    f.contest.command({
      type: 'start',
      broadcasterId: 'channel',
      setup: { keyword: 'go', duration: 30, allowedRoles: [] },
    }),
    /хотя бы одну группу/i,
  );
});

test('keyword anti-spam excludes repeats and clearing eligibility starts a fresh pool', async t => {
  const f = await fixture(t);
  await f.contest.command({
    type: 'start',
    broadcasterId: 'channel',
    setup: { keyword: 'go', duration: 30, antiSpam: true },
  });
  const id = f.contest.snapshot().contest.id;
  await f.contest.chat(f.message('a', 'Alice', 'go', 'a1'));
  await f.contest.chat(f.message('a', 'Alice', 'GO', 'a2'));
  assert.equal(f.contest.snapshot().contest.participants[0].eligible, false);
  assert.equal(f.contest.snapshot().contest.participants[0].excludedReason, 'repeat');
  await f.contest.command({ type: 'clear', contestId: id });
  assert.equal(f.contest.snapshot().contest.participants.length, 0);
  await f.contest.chat(f.message('a', 'Alice', 'go', 'a3'));
  assert.equal(f.contest.snapshot().contest.participants[0].eligible, true);
});

test('reroll never selects an earlier winner', async t => {
  const f = await fixture(t);
  await f.contest.command({
    type: 'start',
    broadcasterId: 'channel',
    setup: { keyword: 'go', duration: 30 },
  });
  const id = f.contest.snapshot().contest.id;
  await f.contest.chat(f.message('a', 'Alice', 'go', 'a1'));
  await f.contest.chat(f.message('b', 'Bob', 'go', 'b1'));
  await f.contest.chat(f.message('c', 'Carol', 'go', 'c1'));
  await f.contest.command({ type: 'draw', contestId: id });
  assert.equal(f.contest.snapshot().contest.winner.name, 'Bob');
  await f.contest.command({ type: 'draw', contestId: id });
  const result = f.contest.snapshot().contest;
  assert.equal(result.winner.name, 'Carol');
  assert.deepEqual(result.winnerHistory, ['b', 'c']);
});

test('saved contests migrate to eligibility and keyword mode', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'projectchat-contest-legacy-'));
  const filename = join(directory, 'contest.json');
  await writeFile(filename, JSON.stringify({
    schema: 1,
    revision: 4,
    serverNow: 100,
    contest: {
      id: 'legacy',
      status: 'ready',
      title: 'Старый конкурс',
      keyword: 'go',
      participants: [{ id: 'a', name: 'Alice', messageId: 'm', message: 'go', joinedAt: 90 }],
      winner: null,
      winnerMessages: [],
    },
  }));
  const contest = await createContest(filename, { now: () => 200 });
  t.after(() => contest.drain());
  const saved = contest.snapshot().contest;
  assert.equal('title' in saved, false);
  assert.equal(saved.mode, 'keyword');
  assert.equal(saved.participants[0].eligible, true);
  assert.equal(saved.participants[0].login, 'Alice');
  assert.deepEqual(saved.participants[0].roles, ['viewer']);
  assert.deepEqual(saved.allowedRoles, ['viewer', 'subscriber', 'vip', 'moderator']);
  assert.deepEqual(saved.winnerHistory, []);
});

test('number contest keeps the target hidden and awards the first exact guess', async t => {
  const f = await fixture(t);
  await f.contest.command({
    type: 'start',
    broadcasterId: 'channel',
    setup: { mode: 'number', numberMin: 1, numberMax: 3, duration: 30, allowedRoles: ['subscriber'] },
  });
  const started = f.contest.snapshot().contest;
  assert.equal(started.winningNumber, null);
  const id = started.id;
  await f.contest.chat(f.message('a', 'Viewer', '2', 'a1', ['viewer']));
  await f.contest.chat(f.message('b', 'Subscriber', '4', 'b1', ['subscriber']));
  await f.contest.chat(f.message('b', 'Subscriber', '1', 'b2', ['subscriber']));
  await f.contest.chat(f.message('b', 'Subscriber', '3', 'b3', ['subscriber']));
  assert.deepEqual(f.contest.snapshot().contest.guesses.map(entry => entry.text), ['1', '3']);
  await f.contest.chat(f.message('b', 'Subscriber', '2', 'b4', ['subscriber']));
  await f.contest.chat(f.message('c', 'Late', '2', 'c1', ['subscriber']));
  const result = f.contest.snapshot().contest;
  assert.equal(result.status, 'winner');
  assert.equal(result.winningNumber, 2);
  assert.equal(result.winner.name, 'Subscriber');
  assert.deepEqual(result.winnerMessages.map(entry => entry.text), ['2']);
  assert.deepEqual(result.participants.map(entry => entry.name), ['Subscriber']);
  assert.equal(result.participants[0].guessCount, 3);
  assert.equal(result.guessCount, 3);
  assert.deepEqual(result.guesses.map(entry => entry.text), ['1', '3', '2']);
  await assert.rejects(f.contest.command({ type: 'draw', contestId: id }), /первый зритель/i);
});

test('number contest reveals the answer when time runs out and validates bounds', async t => {
  const f = await fixture(t);
  await assert.rejects(f.contest.command({
    type: 'start', broadcasterId: 'channel',
    setup: { mode: 'number', numberMin: 5, numberMax: 5, duration: 30 },
  }), /диапазон/i);
  await assert.rejects(f.contest.command({
    type: 'start', broadcasterId: 'channel',
    setup: { mode: 'number', numberMin: null, numberMax: 10, duration: 30 },
  }), /диапазон/i);
  await f.contest.command({
    type: 'start', broadcasterId: 'channel',
    setup: { mode: 'number', numberMin: 0, numberMax: 10, duration: 10 },
  });
  await f.contest.chat(f.message('a', 'Alice', '1.0', 'a1'));
  await f.contest.chat(f.message('a', 'Alice', ' 0 ', 'a2'));
  assert.deepEqual(f.contest.snapshot().contest.guesses.map(entry => entry.text), ['0']);
  f.advance(10_000);
  await f.contest.tick();
  const ended = f.contest.snapshot().contest;
  assert.equal(ended.status, 'ready');
  assert.equal(ended.winningNumber, 1);
});

test('demo number contest produces guesses and eventually a winner', async t => {
  const f = await fixture(t);
  await f.contest.command({
    type: 'start', setup: { mode: 'number', numberMin: 1, numberMax: 100, duration: 30, source: 'test' },
  });
  const id = f.contest.snapshot().contest.id;
  for (let attempt = 0; attempt < 6; attempt += 1)
    await f.contest.command({ type: 'demo', contestId: id });
  const result = f.contest.snapshot().contest;
  assert.equal(result.status, 'winner');
  assert.equal(result.guesses.length, 6);
  assert.equal(result.winnerMessages[0].text, String(result.winningNumber));
});
