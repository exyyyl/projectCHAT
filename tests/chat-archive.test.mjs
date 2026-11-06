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

test('archive cleanup removes only the selected channel and scope, preserves notes, and never reuses message IDs', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-chat-cleanup-'));
  const filename = join(directory, 'chat.sqlite');
  let chat = await createChatArchive(filename);
  t.after(() => chat.close());
  const first = chat.add(message('1'));
  const kept = chat.add(message('2', 'twitch:two'));
  const other = chat.add(message('3', 'twitch:one', 'channel-b'));
  chat.addNote('channel-a', 'twitch:one', 'Keep this note');
  chat.saveMemo('Keep this memo');
  chat.markDeleted('channel-a', { eventId: '1' });
  const changes = [];
  chat.subscribeCleanup(change => changes.push(change));
  const result = chat.clearMessages('channel-a', 'deleted');
  assert.equal(result.removed, 1);
  assert.equal(result.archive.deletedCount, 0);
  assert.deepEqual(chat.recent('channel-a').map(item => item.id), [kept.id]);
  assert.equal(chat.profile('channel-a', 'twitch:one').notes[0].text, 'Keep this note');
  assert.equal(chat.profile('channel-a', 'twitch:one').messageCount, 0);
  assert.equal(chat.recent('channel-b').length, 1);
  assert.equal(chat.memo(), 'Keep this memo');
  assert.equal(changes.length, 1);
  assert.equal(changes[0].scope, 'deleted');
  assert.equal(changes[0].throughId, other.id);
  assert.equal(changes[0].channelId, 'channel-a');
  assert.throws(() => chat.clearMessages('channel-a', 'invalid'), /очист/i);
  assert.throws(() => chat.clearMessages('../bad', 'all'), /канал/i);
  const bytes = chat.overview('channel-a').storageBytes;
  const all = chat.clearMessages('channel-a', 'all');
  assert.equal(all.removed, 1);
  assert.equal(chat.overview('channel-a').count, 0);
  assert.equal(chat.overview('channel-a').feedCount, 0);
  assert.ok(chat.overview('channel-a').storageBytes <= bytes);
  const lastOther = chat.recent('channel-b')[0].id;
  chat.clearMessages('channel-b', 'all');
  const empty = chat.clearMessages('channel-a', 'all');
  assert.equal(empty.removed, 0);
  assert.equal(empty.throughId, lastOther);
  chat.close();
  chat = await createChatArchive(filename);
  const next = chat.add(message('4'));
  assert.ok(next.id > lastOther && next.id > first.id);
  assert.equal(chat.profile('channel-a', 'twitch:one').notes.length, 1);
});

test('manual archive cleanup reclaims database pages instead of only hiding messages', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-chat-compact-'));
  const chat = await createChatArchive(join(directory, 'chat.sqlite'));
  t.after(() => chat.close());
  for (let id = 1; id <= 500; id++) chat.add({ ...message(String(id)), text: 'x'.repeat(500) });
  const before = chat.overview('channel-a').storageBytes;
  const result = chat.clearMessages('channel-a', 'all');
  assert.equal(result.removed, 500);
  assert.ok(result.archive.storageBytes < before / 2);
});

test('viewer notes replace the previous text while streamer notes support independent tasks', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-notes-'));
  const filename = join(directory, 'chat.sqlite');
  let chat = await createChatArchive(filename);
  t.after(() => chat.close());
  const first = chat.addNote('channel-a', 'twitch:one', 'Первая запись');
  const edited = chat.addNote('channel-a', 'twitch:one', 'Отредактированная запись');
  assert.equal(edited.id, first.id);
  assert.equal(chat.profile('channel-a', 'twitch:one').notes.length, 1);
  assert.equal(chat.profile('channel-a', 'twitch:one').notes[0].text, 'Отредактированная запись');
  chat.addNote('channel-b', 'twitch:one', 'Другой канал');
  const note = chat.createStreamerNote({ text: 'Музыка к эфиру', task: false });
  const task = chat.createStreamerNote({ text: 'Проверить микрофон', task: true });
  chat.updateStreamerNote(task.id, { completed: true });
  assert.equal(chat.streamerNotes().find(item => item.id === task.id).completed, true);
  assert.equal(chat.streamerNotes().find(item => item.id === note.id).completed, false);
  chat.updateStreamerNote(note.id, { text: 'Подготовить музыку', task: true });
  chat.clearMessages('channel-a', 'all');
  chat.close(); chat = await createChatArchive(filename);
  assert.equal(chat.streamerNotes().length, 2);
  assert.equal(chat.streamerNotes().find(item => item.id === task.id).completed, true);
  chat.deleteStreamerNote(task.id);
  assert.deepEqual(chat.streamerNotes().map(item => item.id), [note.id]);
  assert.throws(() => chat.createStreamerNote({ text: ' ', task: true }), /заметк/i);
  assert.throws(() => chat.updateStreamerNote(note.id, { completed: 'yes' }), /заметк/i);
  assert.throws(() => chat.updateStreamerNote('missing', { text: 'No' }), /найдена/);
  assert.equal(chat.profile('channel-b', 'twitch:one').notes[0].text, 'Другой канал');
});

test('note migration merges every legacy viewer text and imports the streamer memo once', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-note-migration-'));
  const filename = join(directory, 'chat.sqlite');
  const legacy = new DatabaseSync(filename);
  legacy.exec(`CREATE TABLE notes (id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, viewer_id TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL);
    INSERT INTO notes VALUES ('one', 'channel-a', 'twitch:one', 'Первая заметка', 100);
    INSERT INTO notes VALUES ('two', 'channel-a', 'twitch:one', 'Вторая заметка', 200);
    CREATE TABLE streamer_memo (id INTEGER PRIMARY KEY, text TEXT NOT NULL);
    INSERT INTO streamer_memo VALUES (1, 'Старый текст стримера');`);
  const longText = 'д'.repeat(2000);
  legacy.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run('long-one', 'channel-a', 'twitch:long', longText, 100);
  legacy.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)').run('long-two', 'channel-a', 'twitch:long', longText, 200);
  legacy.close();
  let chat = await createChatArchive(filename);
  t.after(() => chat.close());
  const combined = chat.profile('channel-a', 'twitch:long').notes[0];
  assert.equal(combined.text, longText + '\n\n' + longText);
  assert.equal(chat.setNote('channel-a', 'twitch:long', combined.text).text, combined.text);
  const notes = chat.profile('channel-a', 'twitch:one').notes;
  assert.equal(notes.length, 1);
  assert.equal(notes[0].text, 'Первая заметка\n\nВторая заметка');
  const migrated = chat.streamerNotes();
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].text, 'Старый текст стримера');
  chat.deleteStreamerNote(migrated[0].id);
  chat.close(); chat = await createChatArchive(filename);
  assert.equal(chat.streamerNotes().length, 0, 'deleted legacy memo must not be imported again');
  assert.equal(chat.profile('channel-a', 'twitch:one').notes.length, 1);
});

test('archive limits persist, prune oldest rows across channels and preserve notes and monotonic IDs', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-limits-'));
  const filename = join(directory, 'chat.sqlite');
  let archive = await createChatArchive(filename);
  t.after(() => archive.close());
  for (let i = 1; i <= 150; i++) archive.add(message(String(i), 'twitch:one', i % 2 ? 'channel-a' : 'channel-b'));
  archive.addNote('channel-a', 'twitch:one', 'keep viewer note');
  archive.createStreamerNote({ text: 'keep streamer note' });
  const events = [];
  archive.subscribeCleanup(change => events.push(change));
  const change = archive.setLimits({ maxMessages: 100, maxBytes: 16 * 1024 * 1024 }, 'channel-a');
  assert.equal(change.removed, 50);
  assert.equal(change.throughId, 50);
  assert.deepEqual(events.map(event => event.channelId).sort(), ['channel-a', 'channel-b']);
  assert.ok(events.every(event => event.scope === 'all' && event.throughId === 50));
  assert.equal(archive.overview('channel-a').count, 50);
  assert.equal(archive.overview('channel-b').count, 50);
  assert.equal(archive.profile('channel-a', 'twitch:one').notes[0].text, 'keep viewer note');
  assert.equal(archive.streamerNotes()[0].text, 'keep streamer note');
  archive.close();
  archive = await createChatArchive(filename, { pruneEvery: 1 });
  assert.equal(archive.overview('channel-a').maxMessages, 100);
  assert.equal(archive.overview('channel-a').maxBytes, 16 * 1024 * 1024);
  const next = archive.add(message('151'));
  assert.equal(next.id, 151);
  assert.equal(archive.overview('channel-a').count + archive.overview('channel-b').count, 100);
  assert.throws(() => archive.setLimits({ maxMessages: 1, maxBytes: 16 * 1024 * 1024 }), /100/);
  assert.throws(() => archive.setLimits({ maxMessages: 100, maxBytes: Infinity }), /100/);
  assert.equal(archive.overview('channel-a').maxMessages, 100);
  archive.setLimits({ maxMessages: 200, maxBytes: 32 * 1024 * 1024 });
  archive.add(message('152'));
  assert.equal(archive.overview('channel-a').count + archive.overview('channel-b').count, 101);
});

test('participants aggregate the recent archive, isolate channels and omit deleted, future and activity rows', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-participants-'));
  let clock = 1_700_000_100_000;
  const archive = await createChatArchive(join(directory, 'chat.sqlite'), { now: () => clock });
  t.after(() => archive.close());
  for (let i = 1; i <= 1200; i++) archive.add({ ...message(String(i), 'twitch:one'), sentAt: clock - i });
  archive.add({ ...message('recent-name', 'twitch:one'), viewerName: 'Updated Name', nameColor: '#abcdef', sentAt: clock });
  archive.add({ ...message('old', 'twitch:old'), sentAt: clock - 600001 });
  archive.add({ ...message('boundary', 'twitch:boundary'), sentAt: clock - 600000 });
  archive.add({ ...message('future', 'twitch:future'), sentAt: clock + 1 });
  archive.add({ ...message('deleted', 'twitch:deleted'), sentAt: clock });
  archive.markDeleted('channel-a', { eventId: 'deleted' });
  archive.add({ ...message('activity', 'twitch:activity'), kind: 'activity', activityType: 'raid', sentAt: clock });
  archive.add({ ...message('system', 'system'), sentAt: clock });
  archive.add({ ...message('other', 'twitch:other', 'channel-b'), sentAt: clock });
  const result = archive.participants('channel-a');
  assert.equal(result.total, 2);
  assert.equal(result.participants[0].messageCount, 1201);
  assert.equal(result.participants[0].viewerName, 'Updated Name');
  assert.equal(result.participants[0].nameColor, '#abcdef');
  assert.equal(archive.recent('channel-a').length, 50);
  assert.equal(archive.participants('channel-b').total, 1);
  for (let i = 0; i < 60; i++) archive.add({ ...message(`new-${i}`, `twitch:user${i}`), sentAt: clock });
  assert.equal(archive.participants('channel-a').total, 62);
  assert.equal(archive.participants('channel-a').participants.length, 50);
  assert.equal(archive.participants('channel-a').participants[0].viewerId, 'twitch:one');
  clock += 600002;
  assert.equal(archive.participants('channel-a').total, 0);
});
