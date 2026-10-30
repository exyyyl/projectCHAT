import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
test('chat emotes route, send, EventSub enrichment and history work together without real Twitch messages', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-emotes-http-'));
  await writeFile(join(directory, 'twitch.json'), JSON.stringify({ accessToken: 'fake-token', refreshToken: 'fake-refresh', expiresAt: Date.now() + 3600_000 }));
  let created;
  const socketReady = new Promise(resolve => { created = resolve; });
  class Socket {
    handlers = {};
    constructor() { created(this); }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    message(data) { return this.handlers.message({ data: JSON.stringify(data) }); }
    close() {}
  }
  const sentTexts = [];
  const app = await createApp({ dataDir: directory, twitchOptions: { Socket, clientId: 'fixtureclient123', fetcher: async (url, options) => {
    if (url.endsWith('/validate')) return json({ client_id: 'fixtureclient123', user_id: '123', login: 'streamer', scopes: ['user:read:chat', 'user:write:chat', 'user:read:emotes'], expires_in: 3600 });
    if (url.includes('/helix/users?')) return json({ data: [{ id: '123', login: 'streamer', display_name: 'Streamer' }] });
    if (url.endsWith('/subscriptions')) return json({ data: [{ id: 'sub' }] }, 202);
    if (url.includes('/chat/emotes/user?')) return json({ data: [{ id: '25', name: 'Kappa' }], pagination: {} });
    if (url.endsWith('/chat/messages')) { sentTexts.push(JSON.parse(options.body).message); return json({ data: [{ is_sent: true, message_id: 'sent-1' }] }); }
    throw new Error(`Unexpected ${url}`);
  } }, emoteOptions: { fetcher: async url => url.endsWith('/global') ? json(url.includes('7tv') ? { emotes: [] } : []) : json({}, 404) } });
  const url = await app.listen(0);
  t.after(() => app.close());
  const socket = await socketReady;
  await socket.message({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'session', keepalive_timeout_seconds: 30 } } });
  app.chat.addNote('123', 'twitch:123', 'Private streamer note');
  const overlayAbort = new AbortController();
  t.after(() => overlayAbort.abort());
  const overlay = await fetch(url + '/api/chat/overlay/events', { signal: overlayAbort.signal });
  const reader = overlay.body.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /event: snapshot/);
  assert.match(first, /"channelId":"123"/);
  assert.doesNotMatch(first, /Private streamer note|accessToken|refreshToken/);
  await app.store.command({ type: 'chat-overlay-update', settings: { hideAfter: 40 } });
  const settingsEvent = new TextDecoder().decode((await reader.read()).value);
  assert.match(settingsEvent, /event: settings/);
  assert.match(settingsEvent, /"hideAfter":40/);
  const response = await fetch(url + '/api/chat/emotes');
  assert.equal(response.status, 200);
  const catalog = await response.json();
  assert.deepEqual(catalog.emotes.map(emote => emote.code), ['Kappa']);
  assert.equal(catalog.requiresReconnect, false);
  assert.doesNotMatch(JSON.stringify(catalog), /fake-token/);
  app.chat.add({ broadcasterId: '123', viewerId: 'twitch:123', viewerName: 'Streamer', viewerLogin: 'streamer', roles: ['moderator'], badges: [{ setId: 'broadcaster', id: '1' }], nameColor: '#A1B2C3', eventId: 'previous-own-message', text: 'Earlier', sentAt: Date.now() - 1000 });
  const sent = await fetch(url + '/api/chat/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Poll-Client': 'panel' }, body: JSON.stringify({ text: '👋 Kappa' }) });
  assert.equal(sent.status, 200);
  const delivered = await sent.json();
  assert.deepEqual(delivered.message.badges, [{ setId: 'broadcaster', id: '1' }]);
  assert.equal(delivered.message.nameColor, '#A1B2C3');
  assert.deepEqual(sentTexts, ['👋 Kappa']);
  await socket.message({ metadata: { message_type: 'notification', message_timestamp: new Date().toISOString() }, payload: { subscription: { type: 'channel.chat.message' }, event: { broadcaster_user_id: '123', chatter_user_id: '123', chatter_user_name: 'Streamer', chatter_user_login: 'streamer', message_id: 'sent-1', message: { text: '👋 Kappa', fragments: [{ type: 'text', text: '👋 ' }, { type: 'emote', text: 'Kappa', emote: { id: '25' } }] } } } });
  let liveEvents = '';
  while (!liveEvents.includes('event: update')) liveEvents += new TextDecoder().decode((await reader.read()).value);
  assert.match(liveEvents, /event: message/);
  assert.match(liveEvents, /"id":"25"/);
  assert.doesNotMatch(liveEvents, /Private streamer note/);
  overlayAbort.abort();
  const history = await (await fetch(url + '/api/chat/recent')).json();
  assert.equal(history.messages.length, 2);
  assert.deepEqual(history.messages[1].emotes, [{ start: 3, end: 8, id: '25' }]);
  assert.equal(history.archive.count, 2);
});
