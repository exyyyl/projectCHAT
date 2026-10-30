import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTwitch, chatActivity, chatMessage, chatVote } from '../server/twitch.mjs';
import { createStore } from '../server/store.mjs';
import { PollError } from '../server/polls.mjs';

const clientId = 'testclient12345';
const tokens = { access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 14400 };
const account = { client_id: clientId, user_id: '123', login: 'streamer', scopes: ['user:read:chat', 'user:write:chat', 'moderator:read:shoutouts'], expires_in: 14400 };
const profile = { data: [{ id: '123', login: 'streamer', display_name: 'Streamer', profile_image_url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/streamer.png' }] };
const viewerProfile = { data: [{ id: '456', login: 'viewer', display_name: 'Viewer', profile_image_url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/viewer.png' }] };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
const welcome = id => ({ metadata: { message_type: 'session_welcome' }, payload: { session: { id, keepalive_timeout_seconds: 30 } } });
function notification(now, event = {}) {
  return { metadata: { message_type: 'notification', message_timestamp: new Date(now).toISOString() }, payload: { subscription: { type: 'channel.chat.message' }, event: { broadcaster_user_id: '123', chatter_user_id: '456', chatter_user_name: 'Viewer', message_id: 'message1', message: { text: 'МАЙН' }, ...event } } };
}
async function fixture(t, customFetch, saved) {
  let time = 1000000;
  const filename = join(await mkdtemp(join(tmpdir(), 'polls-twitch-')), 'twitch.json');
  if (saved) await writeFile(filename, JSON.stringify(saved));
  const timers = new Set(), calls = [], sockets = [];
  class Socket {
    handlers = {};
    constructor(url) { this.url = url; sockets.push(this); }
    addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
    async emit(name, data) { for (const fn of this.handlers[name] || []) await fn(data); }
    async message(data) { await this.emit('message', { data: JSON.stringify(data) }); }
    close() { this.closed = true; void this.emit('close'); }
  }
  const store = await createStore(join(filename, '../state.json'), { now: () => time });
  const twitch = await createTwitch({ filename, store, clientId, now: () => time, Socket,
    later(fn, delay) { const timer = { fn, delay }; timers.add(timer); return timer; }, cancel(timer) { timers.delete(timer); },
    async fetcher(url, options) {
      calls.push({ url, options });
      const custom = await customFetch?.(url, options); if (custom) return custom;
      if (url.endsWith('/device')) return response({ device_code: 'private-device', user_code: 'ABCD1234', verification_uri: 'https://www.twitch.tv/activate?public=true', expires_in: 1800, interval: 5 });
      if (url.endsWith('/token')) return response(tokens);
      if (url.endsWith('/validate')) return response(account);
      if (url.includes('/helix/users?')) return response(new URL(url).searchParams.get('id') === '456' ? viewerProfile : profile);
      if (url.endsWith('/subscriptions')) return response({ data: [{ id: 'sub' }] }, 202);
      throw new Error('Unexpected URL');
    },
  });
  t.after(() => twitch.close());
  return { twitch, store, sockets, calls, timers, filename, now: () => time,
    async advance(delay) { const timer = [...timers].find(x => x.delay === delay); assert.ok(timer, `timer ${delay} exists`); timers.delete(timer); time += delay; await timer.fn(); },
    async authorize() { await twitch.command({ type: 'connect' }); await this.advance(5000); await sockets.at(-1).message(welcome('session1')); },
  };
}
test('device login requests chat and shoutout scopes; public status never contains tokens', async t => {
  let pending = true;
  const f = await fixture(t, url => url.endsWith('/token') && pending ? (pending = false, response({ message: 'authorization_pending' }, 400)) : null);
  await f.twitch.command({ type: 'connect' });
  assert.equal(f.twitch.snapshot().phase, 'authorizing');
  assert.equal(f.twitch.snapshot().device.code, 'ABCD1234');
  await f.advance(5000); assert.equal(f.twitch.snapshot().phase, 'authorizing');
  await f.advance(5000); await f.sockets[0].message(welcome('session1'));
  assert.equal(f.twitch.snapshot().phase, 'connected');
  assert.equal(f.twitch.snapshot().userId, '123');
  assert.equal(f.twitch.snapshot().displayName, 'Streamer');
  assert.equal(f.twitch.snapshot().profileImageUrl, profile.data[0].profile_image_url);
  assert.equal(f.twitch.snapshot().canSend, true);
  assert.equal(f.twitch.snapshot().canShowShoutouts, true);
  assert.doesNotMatch(JSON.stringify(f.twitch.snapshot()), /private-access|private-refresh|private-device/);
  assert.equal('clientId' in f.twitch.snapshot(), false);
  const auth = f.calls.find(c => c.url.endsWith('/device'));
  assert.equal(auth.options.body.get('scopes'), 'user:read:chat user:write:chat moderator:read:shoutouts user:read:emotes');
  const sub = JSON.parse(f.calls.find(c => c.url.endsWith('/subscriptions')).options.body);
  assert.deepEqual(sub.condition, { broadcaster_user_id: '123', user_id: '123' });
  assert.equal(sub.transport.method, 'websocket');
  assert.deepEqual(f.calls.filter(c => c.url.endsWith('/subscriptions')).map(c => JSON.parse(c.options.body).type), [
    'channel.chat.message', 'channel.chat.notification', 'channel.shoutout.create', 'channel.shoutout.receive',
  ]);
  assert.equal(JSON.parse(await readFile(f.filename, 'utf8')).refreshToken, 'private-refresh');
});
test('chat send uses broadcaster identity and handles read-only legacy tokens', async t => {
  const f = await fixture(t, url => url.endsWith('/helix/chat/messages') ? response({ data: [{ message_id: 'sent-1', is_sent: true }] }) : null);
  await f.authorize();
  const sent = await f.twitch.sendMessage('Привет, чат!');
  assert.equal(sent.eventId, 'sent-1');
  assert.equal(sent.viewerId, 'twitch:123');
  const request = f.calls.find(call => call.url.endsWith('/helix/chat/messages'));
  assert.deepEqual(JSON.parse(request.options.body), { broadcaster_id: '123', sender_id: '123', message: 'Привет, чат!' });
  await assert.rejects(f.twitch.sendMessage('x'.repeat(501)), /500 символов/);

  const legacy = await fixture(t, url => url.endsWith('/validate') ? response({ ...account, scopes: ['user:read:chat'] }) : null);
  await legacy.authorize();
  assert.equal(legacy.twitch.snapshot().canSend, false);
  assert.equal(legacy.twitch.snapshot().canShowShoutouts, false);
  assert.deepEqual(legacy.calls.filter(c => c.url.endsWith('/subscriptions')).map(c => JSON.parse(c.options.body).type), ['channel.chat.message', 'channel.chat.notification']);
  await assert.rejects(legacy.twitch.sendMessage('Привет'), /Переподключите Twitch/);
});
test('real chat counts while hidden, deduplicates and excludes shared-channel and old messages', async t => {
  const f = await fixture(t); await f.authorize();
  const s = f.store.snapshot();
  await f.store.command({ type: 'start', draftRevision: s.draftRevision, draft: { ...s.draft, source: 'twitch', showOverlay: false }, broadcasterId: '123' });
  const ws = f.sockets[0];
  const voteAt = f.now();
  await ws.message(notification(voteAt)); await ws.message(notification(voteAt));
  await ws.message(notification(voteAt, { message_id: 'ordinary-chat', message: { text: 'Всем привет' } }));
  await ws.message(notification(voteAt, { message_id: 'shared', chatter_user_id: '789', source_broadcaster_user_id: '999' }));
  await ws.message(notification(voteAt - 1, { message_id: 'old', chatter_user_id: '789' }));
  await f.advance(75);
  assert.equal(f.store.snapshot().poll.options[0].votes, 1);
  assert.equal(f.store.snapshot().poll.visible, false);
  assert.deepEqual(f.store.snapshot().poll.activity, [{ id: 'message1', viewerName: 'Viewer', avatarUrl: viewerProfile.data[0].profile_image_url, optionId: '1', at: voteAt }]);
  assert.doesNotMatch(JSON.stringify(f.store.snapshot()), /twitch:456/);
  assert.equal(chatVote(notification(f.now()), { ...f.store.snapshot().poll, source: 'test' }, '123'), null);
});
test('generic chat messages are normalized with audience roles for other Twitch tools', () => {
  const message = chatMessage(notification(1000, {
    message: { text: 'участвую' },
    badges: [{ set_id: 'subscriber', id: '12' }, { set_id: 'vip', id: '1' }],
    color: '#A1B2C3',
  }), '123');
  assert.equal(message.viewerName, 'Viewer');
  assert.equal(message.viewerLogin, 'Viewer');
  assert.equal(message.text, 'участвую');
  assert.deepEqual(message.roles, ['subscriber', 'vip']);
  assert.deepEqual(message.badges, [{ setId: 'subscriber', id: '12' }, { setId: 'vip', id: '1' }]);
  assert.equal(message.nameColor, '#A1B2C3');
  assert.equal(chatMessage(notification(1000, { cheer: { bits: 250 } }), '123').cheerBits, 250);
  assert.equal(message.broadcasterId, '123');
  assert.deepEqual(chatMessage(notification(1000), '123').roles, ['viewer']);
  assert.equal(chatMessage(notification(1000, { color: 'red', badges: [{ set_id: '<script>', id: '1' }] }), '123').nameColor, '');
  assert.deepEqual(chatMessage(notification(1000, { badges: [{ set_id: '<script>', id: '1' }] }), '123').badges, []);
  assert.equal(chatMessage(notification(1000, { source_broadcaster_user_id: '999' }), '123'), null);
});
test('chat badge catalog combines global and channel versions and caches the result', async t => {
  const f = await fixture(t, url => {
    if (url.endsWith('/helix/chat/badges/global')) return response({ data: [
      { set_id: 'vip', versions: [{ id: '1', title: 'VIP', image_url_2x: 'https://static-cdn.jtvnw.net/badges/vip.png' }] },
      { set_id: 'subscriber', versions: [{ id: '12', title: 'Global', image_url_1x: 'https://static-cdn.jtvnw.net/badges/global.png' }] },
    ] });
    if (url.includes('/helix/chat/badges?')) return response({ data: [
      { set_id: 'subscriber', versions: [{ id: '12', title: 'Подписчик', image_url_2x: 'https://static-cdn.jtvnw.net/badges/channel.png' }] },
      { set_id: 'unsafe', versions: [{ id: '1', title: 'External', image_url_2x: 'https://example.com/image.png' }] },
    ] });
  });
  await f.authorize();
  const badges = await f.twitch.badges();
  assert.deepEqual(badges['subscriber/12'], { url: 'https://static-cdn.jtvnw.net/badges/channel.png', title: 'Подписчик' });
  assert.equal(badges['vip/1'].title, 'VIP');
  assert.equal(badges['unsafe/1'], undefined);
  assert.deepEqual(await f.twitch.badges(), badges);
  assert.equal(f.calls.filter(call => call.url.includes('/helix/chat/badges')).length, 2);
});
test('chat activity normalizes raid, subscription, announcement and shoutout notices', () => {
  const wrap = (type, event, id = 'activity-1') => ({
    metadata: { message_type: 'notification', message_timestamp: new Date(1000).toISOString(), message_id: id },
    payload: { subscription: { type }, event: { broadcaster_user_id: '123', ...event } },
  });
  const raid = chatActivity(wrap('channel.chat.notification', { notice_type: 'raid', message_id: 'raid-1', raid: { user_id: '456', user_name: 'Raider', user_login: 'raider', viewer_count: 42 } }), '123');
  assert.equal(raid.activityType, 'raid');
  assert.equal(raid.viewerId, 'twitch:456');
  assert.equal(raid.text, 'привёл 42 зрителей');
  const sub = chatActivity(wrap('channel.chat.notification', { notice_type: 'resub', message_id: 'resub-1', chatter_user_id: '456', chatter_user_name: 'Viewer', color: '#12AB34', resub: { cumulative_months: 8 } }), '123');
  assert.equal(sub.text, 'продлил подписку · 8 мес.');
  assert.equal(sub.nameColor, '#12AB34');
  const announcement = chatActivity(wrap('channel.chat.notification', { notice_type: 'announcement', message_id: 'announcement-1', chatter_user_id: '123', chatter_user_name: 'Streamer', message: { text: 'Начинаем!' } }), '123');
  assert.equal(announcement.text, 'Начинаем!');
  const shoutout = chatActivity(wrap('channel.shoutout.create', { to_broadcaster_user_id: '789', to_broadcaster_user_name: 'Guest', to_broadcaster_user_login: 'guest' }), '123');
  assert.equal(shoutout.viewerId, 'twitch:789');
  assert.equal(shoutout.text, 'получил шотаут');
  assert.equal(chatActivity(wrap('channel.chat.notification', { notice_type: 'sub', message_id: 'shared', source_broadcaster_user_id: '999' }), '123'), null);
  assert.equal(chatActivity(wrap('channel.chat.notification', { notice_type: 'unknown', message_id: 'unknown' }), '123'), null);
});
test('Twitch session migration keeps old connection until welcome without resubscribing', async t => {
  const f = await fixture(t); await f.authorize(); const old = f.sockets[0];
  await old.message({ metadata: { message_type: 'session_reconnect' }, payload: { session: { reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?reconnect=example' } } });
  assert.equal(f.sockets.length, 2); assert.equal(old.closed, undefined);
  await f.sockets[1].message(welcome('session2'));
  assert.equal(old.closed, true); assert.equal(f.twitch.snapshot().phase, 'connected');
  assert.equal(f.calls.filter(c => c.url.endsWith('/subscriptions')).length, 4);
});
test('network loss resubscribes, reports gap, and disconnect cancels retries', async t => {
  const f = await fixture(t); await f.authorize();
  f.sockets[0].close(); assert.equal(f.twitch.snapshot().phase, 'reconnecting');
  await f.advance(1000);
  await f.sockets[1].message(welcome('fresh-session'));
  assert.equal(f.calls.filter(c => c.url.endsWith('/subscriptions')).length, 8);
  assert.equal(f.twitch.snapshot().phase, 'connected');
  assert.ok(f.twitch.snapshot().lastGapAt);
  f.sockets[1].close();
  await f.twitch.command({ type: 'disconnect' });
  assert.equal(f.twitch.snapshot().phase, 'disconnected');
  assert.equal(f.timers.size, 0);
  for (const ws of f.sockets) assert.equal(ws.closed, true);
  assert.deepEqual(JSON.parse(await readFile(f.filename, 'utf8')), {});
});
test('expired token refreshes once without a client secret and saves rotated refresh token', async t => {
  let validations = 0;
  const f = await fixture(t, (url, options) => {
    if (url.endsWith('/validate') && validations++ === 0) return response({ message: 'invalid access token' }, 401);
    if (url.endsWith('/token')) { assert.equal(options.body.get('client_secret'), null); assert.equal(options.body.get('refresh_token'), 'old-refresh'); return response(tokens); }
  }, { clientId, accessToken: 'expired-access', refreshToken: 'old-refresh' });
  await f.twitch.start(); await f.sockets[0].message(welcome('restored'));
  assert.equal(f.twitch.snapshot().phase, 'connected');
  assert.equal(f.calls.filter(c => c.url.endsWith('/token')).length, 1);
  assert.equal(JSON.parse(await readFile(f.filename, 'utf8')).refreshToken, 'private-refresh');
});
test('revocation stops listening, and cancel removes pending device authorization', async t => {
  const f = await fixture(t); await f.authorize();
  await f.sockets[0].message({ metadata: { message_type: 'revocation' }, payload: {} });
  assert.equal(f.twitch.snapshot().phase, 'error'); assert.equal(f.timers.size, 0);
  await f.twitch.command({ type: 'connect' });
  await f.twitch.command({ type: 'disconnect' });
  assert.equal(f.timers.size, 0); assert.equal(f.twitch.snapshot().device, null);
});

test('oversized Unicode and invalid IDs do not disconnect chat or block a subsequent vote', async t => {
  const f = await fixture(t); await f.authorize();
  const s = f.store.snapshot();
  await f.store.command({ type: 'start', draftRevision: s.draftRevision, draft: { ...s.draft, source: 'twitch' }, broadcasterId: '123' });
  const ws = f.sockets[0];
  for (const event of [
    { message: { text: '😀'.repeat(251) } },
    { message_id: '' }, { message_id: 'x'.repeat(129) },
    { chatter_user_id: '' }, { chatter_user_id: 'x'.repeat(122) },
    { message: { text: { code: 'malformed' } } },
  ]) {
    await ws.message(notification(f.now(), event));
    assert.equal(f.twitch.snapshot().phase, 'connected');
    assert.notEqual(ws.closed, true);
  }
  await ws.message(notification(f.now()));
  assert.equal(f.store.snapshot().poll.options[0].votes, 1);
  assert.equal(f.sockets.length, 1);
});

test('chat vote bounds include the viewer prefix and preserve supported text literally', () => {
  const poll = { id: 'poll', status: 'running', source: 'twitch', broadcasterId: '123', startedAt: 1000, deadline: 2000 };
  const message = notification(1000, { chatter_user_id: 'x'.repeat(121), message_id: 'e'.repeat(128), message: { text: '😀'.repeat(250) } });
  const vote = chatVote(message, poll, '123');
  assert.equal(vote.viewerId.length, 128);
  assert.equal(vote.eventId.length, 128);
  assert.equal(vote.message, message.payload.event.message.text);
  const markup = '<img src=x onerror=alert(1)>';
  assert.equal(chatVote(notification(1000, { message: { text: markup } }), poll, '123').message, markup);
});

for (const status of [400, 409]) {
  test(`a rejected queued vote (${status}) does not reset Twitch or replay the vote`, async t => {
    const f = await fixture(t); await f.authorize();
    const s = f.store.snapshot();
    await f.store.command({ type: 'start', draftRevision: s.draftRevision, draft: { ...s.draft, source: 'twitch' }, broadcasterId: '123' });
    const command = f.store.command.bind(f.store);
    let votes = 0;
    f.store.command = data => {
      if (data.type === 'vote' && ++votes === 1) throw new PollError('Rejected vote', status);
      return command(data);
    };
    const ws = f.sockets[0];
    await ws.message(notification(f.now(), { message_id: 'rejected' }));
    assert.equal(f.twitch.snapshot().phase, 'connected');
    assert.equal(f.store.snapshot().poll.options[0].votes, 0);
    await ws.message(notification(f.now()));
    assert.equal(f.store.snapshot().poll.options[0].votes, 1);
    assert.equal(votes, 2);
    assert.notEqual(ws.closed, true);
  });
}

for (const error of [new Error('Disk failed'), new PollError('Storage failed', 500)]) {
  test(`unexpected vote failure still enters an error state: ${error.message}`, async t => {
    const f = await fixture(t); await f.authorize();
    const s = f.store.snapshot();
    await f.store.command({ type: 'start', draftRevision: s.draftRevision, draft: { ...s.draft, source: 'twitch' }, broadcasterId: '123' });
    f.store.command = () => { throw error; };
    await f.sockets[0].message(notification(f.now()));
    assert.equal(f.twitch.snapshot().phase, 'error');
    assert.equal(f.sockets[0].closed, true);
  });
}

test('personal Twitch emotes use permission-scoped pagination and preserve valid animated IDs', async t => {
  const f = await fixture(t, url => {
    if (url.endsWith('/validate')) return response({ ...account, scopes: [...account.scopes, 'user:read:emotes'] });
    if (url.includes('/helix/chat/emotes/user?')) {
      const query = new URL(url).searchParams;
      assert.equal(query.get('user_id'), '123');
      assert.equal(query.get('broadcaster_id'), '123');
      return query.has('after') ? response({ data: [{ id: 'emotesv2_test', name: 'customWave' }], pagination: {} }) : response({ data: [{ id: '25', name: 'Kappa' }, { id: '../bad', name: 'bad' }], pagination: { cursor: 'next' } });
    }
  });
  await f.authorize();
  assert.equal(f.twitch.snapshot().canReadEmotes, true);
  const result = await f.twitch.emotes();
  assert.equal(result.requiresReconnect, false);
  assert.deepEqual(result.emotes.map(emote => emote.code), ['Kappa', 'customWave']);
  assert.equal(f.calls.filter(call => call.url.includes('/emotes/user?')).length, 2);
  await f.twitch.command({ type: 'disconnect' });
  assert.equal(f.twitch.snapshot().canReadEmotes, false);
});

test('existing Twitch logins keep global and own-channel emotes until the new permission is granted', async t => {
  const f = await fixture(t, url => {
    if (url.endsWith('/helix/chat/emotes/global')) return response({ data: [{ id: '25', name: 'Kappa' }] });
    if (url.includes('/helix/chat/emotes?')) return response({ data: [{ id: 'emotesv2_own', name: 'ownWave' }] });
  });
  await f.authorize();
  const result = await f.twitch.emotes();
  assert.equal(result.requiresReconnect, true);
  assert.deepEqual(result.emotes.map(emote => emote.code), ['Kappa', 'ownWave']);
});

test('sending emoji and emote codes preserves text including joined Unicode emoji', async t => {
  const f = await fixture(t, url => url.endsWith('/helix/chat/messages') ? response({ data: [{ message_id: 'emoji-1', is_sent: true }] }) : null);
  await f.authorize();
  const text = '👨‍👩‍👧‍👦 Kappa monkaS';
  const sent = await f.twitch.sendMessage(text);
  assert.equal(sent.text, text);
  assert.equal(JSON.parse(f.calls.find(call => call.url.endsWith('/helix/chat/messages')).options.body).message, text);
  await assert.rejects(f.twitch.sendMessage('hi\u202E'), /500 символов/);
});
