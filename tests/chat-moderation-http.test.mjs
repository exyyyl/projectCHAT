import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const headers = { 'Content-Type': 'application/json', 'X-Poll-Client': 'panel' };
async function fixture(t, deleteStatus = 204) {
  const directory = await mkdtemp(join(tmpdir(), 'cue-moderation-http-'));
  await writeFile(join(directory, 'twitch.json'), JSON.stringify({ accessToken: 'fixture-token', refreshToken: 'fixture-refresh', expiresAt: Date.now() + 3600000 }));
  let ready;
  const socketReady = new Promise(resolve => { ready = resolve; });
  class Socket {
    handlers = {};
    constructor() { ready(this); }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    message(data) { return this.handlers.message({ data: JSON.stringify(data) }); }
    close() {}
  }
  const actions = [];
  const app = await createApp({ dataDir: directory, twitchOptions: { Socket, clientId: 'fixtureclient123', fetcher: async (url, options) => {
    if (url.endsWith('/validate')) return json({ client_id: 'fixtureclient123', user_id: '123', login: 'streamer', scopes: ['user:read:chat', 'moderator:manage:chat_messages', 'moderator:manage:banned_users'], expires_in: 3600 });
    if (url.includes('/helix/users?')) return json({ data: [] });
    if (url.endsWith('/subscriptions')) return json({ data: [] }, 202);
    if (url.includes('/helix/moderation/')) { actions.push({ url, options }); return deleteStatus === 204 ? new Response(null, { status: 204 }) : json({ message: 'Cannot delete broadcaster messages' }, deleteStatus); }
    throw new Error('Unexpected fixture URL');
  } } });
  const base = await app.listen(0);
  t.after(() => app.close());
  const socket = await socketReady;
  await socket.message({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'fixture', keepalive_timeout_seconds: 30 } } });
  const add = (eventId, viewerId = '456', broadcasterId = '123') => app.chat.add({ broadcasterId, eventId, viewerId: `twitch:${viewerId}`, viewerName: 'Viewer', roles: ['viewer'], text: 'Message', sentAt: Date.now() });
  const post = (body, options = {}) => fetch(base + '/api/chat/moderate', { method: 'POST', headers, body: JSON.stringify(body), ...options });
  return { app, base, socket, actions, add, post };
}

test('moderation route resolves real target IDs and propagates deletion to history and OBS SSE', async t => {
  const f = await fixture(t);
  const first = f.add('first-event');
  f.add('next-event');
  const other = f.add('other-channel', '456', '999');
  assert.equal((await f.post({ channelId: '123', messageId: other.id, action: 'delete' })).status, 404);
  assert.equal((await f.post({ channelId: '999', messageId: first.id, action: 'delete' })).status, 409);
  assert.equal((await f.post({ channelId: '123', messageId: first.id, action: 'invalid' })).status, 400);
  assert.equal((await f.post({ channelId: '123', messageId: first.id, action: 'timeout' })).status, 400);
  assert.equal((await f.post({ channelId: '123', messageId: first.id, action: 'delete' }, { headers: { ...headers, Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await f.post({ channelId: '123', messageId: first.id, action: 'delete' }, { headers: { 'Content-Type': 'application/json' } })).status, 415);
  assert.equal(f.actions.length, 0);
  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await fetch(f.base + '/api/chat/overlay/events', { signal: controller.signal });
  const reader = stream.body.getReader();
  await reader.read();
  const deleted = await f.post({ channelId: '123', messageId: first.id, action: 'delete', eventId: 'forged', viewerId: 'twitch:999' });
  assert.equal(deleted.status, 200);
  assert.equal(new URL(f.actions[0].url).searchParams.get('message_id'), 'first-event');
  const event = new TextDecoder().decode((await reader.read()).value);
  assert.match(event, /event: update/);
  assert.match(event, /"deleted":true/);
  const second = f.app.chat.recent('123').find(item => !item.deleted);
  assert.equal((await f.post({ channelId: '123', messageId: second.id, action: 'timeout', duration: 300, viewerId: 'twitch:999' })).status, 200);
  assert.deepEqual(JSON.parse(f.actions[1].options.body), { data: { user_id: '456', duration: 300 } });
  assert.equal(f.app.chat.recent('123').every(item => item.deleted), true);
  assert.equal(f.app.chat.recent('999')[0].deleted, false);
  assert.equal((await f.post({ channelId: '123', messageId: first.id, action: 'delete' })).status, 404);
  controller.abort();
});

test('Twitch deletions from another client update Cue, isolated by channel and target', async t => {
  const f = await fixture(t);
  f.add('one'); f.add('two', '789');
  const notify = (type, event) => f.socket.message({ metadata: { message_type: 'notification', message_timestamp: new Date().toISOString() }, payload: { subscription: { type }, event } });
  await notify('channel.chat.message_delete', { broadcaster_user_id: '999', message_id: 'one' });
  assert.equal(f.app.chat.recent('123')[0].deleted, false);
  await notify('channel.chat.message_delete', { broadcaster_user_id: '123', message_id: 'one' });
  assert.equal(f.app.chat.recent('123')[0].deleted, true);
  assert.equal(f.app.chat.recent('123')[1].deleted, false);
  await notify('channel.chat.clear_user_messages', { broadcaster_user_id: '123', target_user_id: '789' });
  assert.equal(f.app.chat.recent('123').every(item => item.deleted), true);
  assert.equal(f.actions.length, 0);
});


test('owner delete is passed to Twitch while self-timeout remains blocked', async t => {
  const f = await fixture(t);
  const own = f.add('own-message', '123');
  const timeout = await f.post({ channelId: '123', messageId: own.id, action: 'timeout', duration: 60 });
  assert.equal(timeout.status, 400);
  assert.equal(f.actions.length, 0);
  const deletion = await f.post({ channelId: '123', messageId: own.id, action: 'delete' });
  assert.equal(deletion.status, 200);
  assert.equal(new URL(f.actions[0].url).searchParams.get('message_id'), 'own-message');
  const stored = f.app.chat.recent('123')[0];
  assert.equal(stored.deleted, true);
  assert.equal(stored.text, 'Message');
});


test('a Twitch refusal never hides or marks an owner message as deleted locally', async t => {
  const f = await fixture(t, 400);
  const own = f.add('own-refused-message', '123');
  const response = await f.post({ channelId: '123', messageId: own.id, action: 'delete' });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /владельца канала/);
  assert.equal(f.app.chat.recent('123')[0].deleted, false);
  assert.equal(f.app.chat.recent('123')[0].text, 'Message');
});


test('permanent ban omits duration, uses the archived identity and clears only the target channel', async t => {
  const f = await fixture(t);
  const message = f.add('ban-message');
  f.add('same-viewer');
  f.add('other-viewer', '789');
  f.add('other-channel', '456', '999');
  const own = f.add('self-ban', '123');
  assert.equal((await f.post({ channelId: '123', messageId: own.id, action: 'ban' })).status, 400);
  assert.equal(f.actions.length, 0);
  const response = await f.post({ channelId: '123', messageId: message.id, action: 'ban', duration: 60, viewerId: 'twitch:999' });
  assert.equal(response.status, 200);
  assert.match(f.actions[0].url, /moderation\/bans/);
  assert.deepEqual(JSON.parse(f.actions[0].options.body), { data: { user_id: '456' } });
  assert.equal(f.app.chat.recent('123').filter(item => item.deleted).length, 2);
  assert.equal(f.app.chat.recent('999')[0].deleted, false);
});
