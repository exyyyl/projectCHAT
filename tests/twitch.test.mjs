import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTwitch, chatVote } from '../server/twitch.mjs';
import { createStore } from '../server/store.mjs';

const clientId = 'testclient12345';
const tokens = { access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 14400 };
const account = { client_id: clientId, user_id: '123', login: 'streamer', scopes: ['user:read:chat'], expires_in: 14400 };
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
test('device login requests only chat read scope; public status never contains tokens', async t => {
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
  assert.doesNotMatch(JSON.stringify(f.twitch.snapshot()), /private-access|private-refresh|private-device/);
  assert.equal('clientId' in f.twitch.snapshot(), false);
  const auth = f.calls.find(c => c.url.endsWith('/device'));
  assert.equal(auth.options.body.get('scopes'), 'user:read:chat');
  const sub = JSON.parse(f.calls.find(c => c.url.endsWith('/subscriptions')).options.body);
  assert.deepEqual(sub.condition, { broadcaster_user_id: '123', user_id: '123' });
  assert.equal(sub.transport.method, 'websocket');
  assert.equal(JSON.parse(await readFile(f.filename, 'utf8')).refreshToken, 'private-refresh');
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
test('Twitch session migration keeps old connection until welcome without resubscribing', async t => {
  const f = await fixture(t); await f.authorize(); const old = f.sockets[0];
  await old.message({ metadata: { message_type: 'session_reconnect' }, payload: { session: { reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?reconnect=example' } } });
  assert.equal(f.sockets.length, 2); assert.equal(old.closed, undefined);
  await f.sockets[1].message(welcome('session2'));
  assert.equal(old.closed, true); assert.equal(f.twitch.snapshot().phase, 'connected');
  assert.equal(f.calls.filter(c => c.url.endsWith('/subscriptions')).length, 1);
});
test('network loss resubscribes, reports gap, and disconnect cancels retries', async t => {
  const f = await fixture(t); await f.authorize();
  f.sockets[0].close(); assert.equal(f.twitch.snapshot().phase, 'reconnecting');
  await f.advance(1000);
  await f.sockets[1].message(welcome('fresh-session'));
  assert.equal(f.calls.filter(c => c.url.endsWith('/subscriptions')).length, 2);
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
