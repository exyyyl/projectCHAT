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
