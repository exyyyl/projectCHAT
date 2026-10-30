import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createChatArchive } from '../server/chat-archive.mjs';

const message = (eventId, viewerId = 'twitch:one', channelId = 'channel-a') => ({
  broadcasterId: channelId,
  viewerId,
  viewerName: viewerId === 'twitch:one' ? 'Viewer One' : 'Viewer Two',
  viewerLogin: 'viewer_one',
  roles: ['viewer'],
  eventId,
  text: `Сообщение ${eventId}`,
  sentAt: 1_700_000_000_000 + Number(eventId),
});

test('chat archive deduplicates events, pages by viewer, and keeps notes after pruning and restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-chat-'));
  const filename = join(directory, 'chat.sqlite');
  let archive = await createChatArchive(filename, { maxMessages: 3, pruneEvery: 1, now: () => 1_700_000_100_000 });
  let notifications = 0;
  const unsubscribe = archive.subscribe(() => notifications++);
  const first = archive.add(message('1'));
  assert.ok(first?.id);
  assert.equal(archive.add(message('1')), null);
  assert.equal(notifications, 1);
  const note = archive.addNote('channel-a', 'twitch:one', 'Помнит прошлый конкурс');
  archive.add(message('2', 'twitch:two'));
  archive.add(message('3'));
  archive.add(message('4'));
  assert.equal(archive.overview('channel-a').count, 3);
  assert.deepEqual(archive.recent('channel-a').map(item => item.text), ['Сообщение 2', 'Сообщение 3', 'Сообщение 4']);
  assert.deepEqual(archive.recent('channel-a', 4).map(item => item.text), ['Сообщение 2', 'Сообщение 3']);
  assert.equal(archive.profile('channel-a', 'twitch:one').messageCount, 2);
  assert.equal(archive.profile('channel-a', 'twitch:one').notes[0].text, note.text);
  assert.equal(archive.overview('channel-b').count, 0);
  unsubscribe();
  archive.close();

  archive = await createChatArchive(filename, { maxMessages: 3, pruneEvery: 1 });
  assert.equal(archive.profile('channel-a', 'twitch:one').notes[0].id, note.id);
  archive.deleteNote('channel-a', 'twitch:one', note.id);
  assert.equal(archive.profile('channel-a', 'twitch:one').notes.length, 0);
  archive.close();
});

test('chat archive rejects oversized notes and ignores malformed chat events', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-chat-'));
  const archive = await createChatArchive(join(directory, 'chat.sqlite'));
  assert.equal(archive.add({ ...message('1'), broadcasterId: '../other' }), null);
  assert.throws(() => archive.addNote('channel-a', 'twitch:one', 'x'.repeat(2001)), /Заметка/);
  assert.throws(() => archive.profile('channel-a', '../other'), /профиль/);
  archive.close();
});

test('chat archive stores Twitch styling and enriches an already sent message without recounting it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-chat-'));
  const archive = await createChatArchive(join(directory, 'chat.sqlite'));
  const events = [];
  archive.subscribe((_channel, item, updated) => events.push({ item, updated }));
  const sent = archive.add(message('1'));
  const enriched = archive.add({ ...message('1'), badges: [{ setId: 'broadcaster', id: '1' }], nameColor: '#13AE78' });
  assert.equal(enriched.id, sent.id);
  assert.equal(archive.overview('channel-a').count, 1);
  assert.deepEqual(archive.recent('channel-a')[0].badges, [{ setId: 'broadcaster', id: '1' }]);
  assert.equal(archive.profile('channel-a', 'twitch:one').nameColor, '#13AE78');
  assert.deepEqual(events.map(event => event.updated), [false, true]);
  assert.equal(archive.add({ ...message('1'), badges: [{ setId: 'broadcaster', id: '1' }], nameColor: '#13AE78' }), null);
  archive.close();
});

test('chat archive adds styling columns to an existing local database', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-chat-'));
  const filename = join(directory, 'chat.sqlite');
  const old = new DatabaseSync(filename);
  old.exec("CREATE TABLE messages (id INTEGER PRIMARY KEY, channel_id TEXT NOT NULL, event_id TEXT NOT NULL, viewer_id TEXT NOT NULL, viewer_name TEXT NOT NULL, viewer_login TEXT NOT NULL, roles TEXT NOT NULL, text TEXT NOT NULL, sent_at INTEGER NOT NULL, UNIQUE (channel_id, event_id))");
  old.exec("INSERT INTO messages (channel_id, event_id, viewer_id, viewer_name, viewer_login, roles, text, sent_at) VALUES ('channel-a', 'old', 'twitch:one', 'Viewer One', 'viewer_one', '[\"viewer\"]', 'Привет', 1700000000000)");
  old.close();
  const archive = await createChatArchive(filename);
  assert.deepEqual(archive.recent('channel-a')[0].badges, []);
  assert.deepEqual(archive.recent('channel-a')[0].emotes, []);
  assert.equal(archive.recent('channel-a')[0].nameColor, '');
  assert.equal(archive.recent('channel-a')[0].cheerBits, 0);
  archive.close();
});

test('chat activities share the feed without becoming viewer messages or archive message counts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-chat-'));
  const archive = await createChatArchive(join(directory, 'chat.sqlite'));
  archive.add({ ...message('1'), cheerBits: 250 });
  archive.add({ ...message('raid-1'), sentAt: 1_700_000_000_002, kind: 'activity', activityType: 'raid', text: 'привёл 42 зрителей' });
  assert.deepEqual(archive.recent('channel-a').map(item => item.kind), ['message', 'activity']);
  assert.equal(archive.recent('channel-a')[0].cheerBits, 250);
  assert.deepEqual(archive.overview('channel-a').count, 1);
  assert.deepEqual(archive.overview('channel-a').feedCount, 2);
  assert.equal(archive.profile('channel-a', 'twitch:one').messageCount, 1);
  archive.add({ ...message('raid-2', 'twitch:two'), sentAt: 1_700_000_000_003, kind: 'activity', activityType: 'raid', text: 'привёл 3 зрителей' });
  assert.equal(archive.profile('channel-a', 'twitch:two').viewerName, 'Viewer Two');
  assert.equal(archive.profile('channel-a', 'twitch:two').messageCount, 0);
  archive.close();
});

test('emote metadata enriches sent messages, survives restart, and rejects unsafe offsets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-emotes-'));
  const filename = join(directory, 'chat.sqlite');
  let archive = await createChatArchive(filename);
  const item = { ...message('1'), text: '👨‍👩‍👧‍👦 Kappa' };
  const start = item.text.indexOf('Kappa');
  const emotes = [{ start, end: start + 5, id: '25' }];
  const sent = archive.add(item);
  assert.equal(sent.text, item.text);
  const enriched = archive.add({ ...item, emotes });
  assert.equal(enriched.id, sent.id);
  assert.deepEqual(enriched.emotes, emotes);
  assert.equal(archive.overview('channel-a').count, 1);
  assert.equal(archive.add({ ...item, emotes }), null);
  archive.add({ ...message('2'), emotes: [{ start: 0, end: 900, id: '25' }, { start: 0, end: 2, id: '../evil' }] });
  assert.deepEqual(archive.recent('channel-a')[1].emotes, []);
  archive.close();
  archive = await createChatArchive(filename);
  assert.deepEqual(archive.profile('channel-a', 'twitch:one').messages.find(item => item.id === sent.id).emotes, emotes);
  archive.close();
});

test('moderation resolves local IDs in the current channel and tombstones survive enrichment and restart', async t => {
  const filename = join(await mkdtemp(join(tmpdir(), 'cue-moderation-')), 'chat.sqlite');
  let chat = await createChatArchive(filename);
  const first = chat.add(message('1'));
  chat.add(message('2'));
  const other = chat.add(message('3', 'twitch:one', 'channel-b'));
  assert.deepEqual(chat.moderationTarget('channel-a', first.id), { broadcasterId: 'channel-a', eventId: '1', viewerId: 'twitch:one' });
  assert.throws(() => chat.moderationTarget('channel-a', other.id), /недоступно/);
  assert.throws(() => chat.moderationTarget('channel-a', '../sql'), /Некорректное/);
  const changes = [];
  chat.subscribe((channelId, item, updated) => changes.push({ channelId, item, updated }));
  chat.markDeleted('channel-a', { eventId: '1' });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].updated, true);
  assert.equal(changes[0].item.deleted, true);
  assert.throws(() => chat.moderationTarget('channel-a', first.id), /удалено/);
  chat.add({ ...message('1'), nameColor: '#123456' });
  assert.equal(chat.recent('channel-a')[0].deleted, true);
  chat.markDeleted('channel-a', { viewerId: 'twitch:one' });
  assert.equal(chat.recent('channel-a').every(item => item.deleted), true);
  assert.equal(chat.recent('channel-b')[0].deleted, false);
  chat.markDeleted('channel-b', { eventId: '../invalid' });
  assert.equal(chat.recent('channel-b')[0].deleted, false);
  chat.close();
  chat = await createChatArchive(filename);
  t.after(() => chat.close());
  assert.equal(chat.recent('channel-a').every(item => item.deleted), true);
});

test('a large timeout updates the complete archive but bounds live notifications', async t => {
  const filename = join(await mkdtemp(join(tmpdir(), 'cue-bulk-moderation-')), 'chat.sqlite');
  const chat = await createChatArchive(filename);
  t.after(() => chat.close());
  for (let index = 1; index <= 1100; index++) chat.add(message(String(index)));
  let updates = 0;
  chat.subscribe(() => updates++);
  chat.markDeleted('channel-a', { viewerId: 'twitch:one' });
  assert.equal(updates, 1000);
  assert.equal(chat.recent('channel-a', 2)[0].deleted, true);
});
