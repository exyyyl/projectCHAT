import { DatabaseSync } from 'node:sqlite';
import { chmod, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PollError } from './polls.mjs';
import { validArchiveLimits } from '../public/chat-archive-settings.js';
import { validEmoteSpans } from './chat-emotes.mjs';

const DEFAULT_MAX_MESSAGES = 100_000;
const DEFAULT_MAX_BYTES = 128 * 1024 * 1024;
const PAGE_SIZE = 50;
const validId = value => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,80}$/.test(value);
const rowMessage = row => ({ id: row.id, deleted: Boolean(row.deleted), kind: row.kind || 'message', activityType: row.activity_type || '', viewerId: row.viewer_id, viewerName: row.viewer_name, viewerLogin: row.viewer_login, roles: JSON.parse(row.roles), badges: JSON.parse(row.badges || '[]'), emotes: JSON.parse(row.emotes || '[]'), nameColor: row.name_color || '', cheerBits: row.cheer_bits || 0, text: row.text, sentAt: row.sent_at });
const validBadges = badges => (Array.isArray(badges) ? badges : []).slice(0, 20)
  .filter(badge => typeof badge?.setId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(badge.setId)
    && typeof badge?.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(badge.id))
  .map(badge => ({ setId: badge.setId, id: badge.id }));
const validColor = color => typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '';
const rowStreamerNote = row => ({ id: row.id, text: row.text, task: Boolean(row.task), completed: Boolean(row.completed), createdAt: row.created_at, updatedAt: row.updated_at });

export async function createChatArchive(filename, { maxMessages = DEFAULT_MAX_MESSAGES, maxBytes = DEFAULT_MAX_BYTES, pruneEvery = 256, now = Date.now } = {}) {
  await mkdir(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA auto_vacuum = INCREMENTAL;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      channel_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      viewer_id TEXT NOT NULL,
      viewer_name TEXT NOT NULL,
      viewer_login TEXT NOT NULL,
      roles TEXT NOT NULL,
      badges TEXT NOT NULL DEFAULT '[]',
      emotes TEXT NOT NULL DEFAULT '[]',
      name_color TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'message',
      activity_type TEXT NOT NULL DEFAULT '',
      cheer_bits INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL,
      sent_at INTEGER NOT NULL,
      UNIQUE (channel_id, event_id)
    );
    CREATE INDEX IF NOT EXISTS messages_channel_id ON messages(channel_id, id DESC);
    CREATE INDEX IF NOT EXISTS messages_viewer_id ON messages(channel_id, viewer_id, id DESC);
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      viewer_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notes_viewer ON notes(channel_id, viewer_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS streamer_memo (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      text TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS streamer_notes (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      task INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS archive_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1), max_messages INTEGER NOT NULL, max_bytes INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS archive_sequence (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_id INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO archive_sequence (id, last_id) SELECT 1, COALESCE(MAX(id), 0) FROM messages;
    UPDATE archive_sequence SET last_id = MAX(last_id, (SELECT COALESCE(MAX(id), 0) FROM messages)) WHERE id = 1;
    CREATE TRIGGER IF NOT EXISTS messages_advance_sequence AFTER INSERT ON messages BEGIN
      UPDATE archive_sequence SET last_id = MAX(last_id, NEW.id) WHERE id = 1;
    END;
  `);
  const savedLimits = db.prepare('SELECT max_messages AS maxMessages, max_bytes AS maxBytes FROM archive_settings WHERE id = 1').get();
  if (validArchiveLimits(savedLimits)) ({ maxMessages, maxBytes } = savedLimits);
  const noteColumns = new Set(db.prepare('PRAGMA table_info(notes)').all().map(column => column.name));
  if (!noteColumns.has('updated_at')) db.exec('ALTER TABLE notes ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0');
  if (db.prepare('PRAGMA user_version').get().user_version < 1) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const groups = db.prepare('SELECT channel_id, viewer_id FROM notes GROUP BY channel_id, viewer_id').all();
      for (const group of groups) {
        const previous = db.prepare('SELECT * FROM notes WHERE channel_id = ? AND viewer_id = ? ORDER BY created_at, id').all(group.channel_id, group.viewer_id);
        const first = previous[0];
        const text = previous.map(note => note.text).join('\n\n');
        db.prepare('DELETE FROM notes WHERE channel_id = ? AND viewer_id = ?').run(group.channel_id, group.viewer_id);
        db.prepare('INSERT INTO notes (id, channel_id, viewer_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(first.id, group.channel_id, group.viewer_id, text, first.created_at, previous.at(-1).created_at);
      }
      const memo = db.prepare('SELECT text FROM streamer_memo WHERE id = 1').get()?.text;
      if (memo?.trim()) db.prepare('INSERT OR IGNORE INTO streamer_notes (id, text, created_at, updated_at) VALUES (?, ?, ?, ?)').run('legacy-memo', memo, now(), now());
      db.exec('PRAGMA user_version = 1; COMMIT');
    } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS notes_one_per_viewer ON notes(channel_id, viewer_id)');
  const columns = new Set(db.prepare('PRAGMA table_info(messages)').all().map(column => column.name));
  if (!columns.has('emotes')) db.exec("ALTER TABLE messages ADD COLUMN emotes TEXT NOT NULL DEFAULT '[]'");
  if (!columns.has('badges')) db.exec("ALTER TABLE messages ADD COLUMN badges TEXT NOT NULL DEFAULT '[]'");
  if (!columns.has('name_color')) db.exec("ALTER TABLE messages ADD COLUMN name_color TEXT NOT NULL DEFAULT ''");
  if (!columns.has('kind')) db.exec("ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'message'");
  if (!columns.has('activity_type')) db.exec("ALTER TABLE messages ADD COLUMN activity_type TEXT NOT NULL DEFAULT ''");
  if (!columns.has('cheer_bits')) db.exec('ALTER TABLE messages ADD COLUMN cheer_bits INTEGER NOT NULL DEFAULT 0');
  if (!columns.has('deleted')) db.exec('ALTER TABLE messages ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0');
  db.exec("CREATE INDEX IF NOT EXISTS messages_recent_activity ON messages(channel_id, sent_at) WHERE kind = 'message' AND deleted = 0");
  await chmod(filename, 0o600);
  // Clearing the newest rows must not reuse IDs held by live clients.
  const insert = db.prepare('INSERT OR IGNORE INTO messages (id, channel_id, event_id, viewer_id, viewer_name, viewer_login, roles, badges, emotes, name_color, kind, activity_type, cheer_bits, text, sent_at) VALUES ((SELECT last_id + 1 FROM archive_sequence WHERE id = 1), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const byEvent = db.prepare('SELECT * FROM messages WHERE channel_id = ? AND event_id = ?');
  const enrich = db.prepare('UPDATE messages SET roles = ?, badges = ?, name_color = ?, emotes = ? WHERE id = ?');
  const recent = db.prepare('SELECT * FROM messages WHERE channel_id = ? AND id < ? ORDER BY id DESC LIMIT ?');
  const viewerMessages = db.prepare("SELECT * FROM messages WHERE channel_id = ? AND viewer_id = ? AND kind = 'message' AND id < ? ORDER BY id DESC LIMIT ?");
  const viewerDetails = db.prepare("SELECT COUNT(*) AS count, MIN(sent_at) AS first_seen, MAX(sent_at) AS last_seen FROM messages WHERE channel_id = ? AND viewer_id = ? AND kind = 'message'");
  const lastViewerEntry = db.prepare('SELECT viewer_name, viewer_login, name_color FROM messages WHERE channel_id = ? AND viewer_id = ? ORDER BY id DESC LIMIT 1');
  const lastViewerMessage = db.prepare("SELECT viewer_name, viewer_login, roles, name_color FROM messages WHERE channel_id = ? AND viewer_id = ? AND kind = 'message' ORDER BY id DESC LIMIT 1");
  const viewerNotes = db.prepare('SELECT id, text, created_at AS createdAt, updated_at AS updatedAt FROM notes WHERE channel_id = ? AND viewer_id = ?');
  const overview = db.prepare("SELECT COUNT(*) AS feed_count, SUM(CASE WHEN kind = 'message' THEN 1 ELSE 0 END) AS count, SUM(CASE WHEN kind = 'message' AND deleted = 1 THEN 1 ELSE 0 END) AS deleted_count, MIN(sent_at) AS first_seen FROM messages WHERE channel_id = ?");
  const countAll = db.prepare('SELECT COUNT(*) AS count FROM messages');
  const deleteOldest = db.prepare('DELETE FROM messages WHERE id IN (SELECT id FROM messages ORDER BY id LIMIT ?)');
  const listeners = new Set();
  const cleanupListeners = new Set();
  let insertsSincePrune = 0;

  function storageBytes() {
    return Number(db.prepare('PRAGMA page_count').get().page_count) * Number(db.prepare('PRAGMA page_size').get().page_size);
  }
  function archiveOverview(channelId) {
    const summary = validId(channelId) ? overview.get(channelId) : { count: 0, feed_count: 0, first_seen: null };
    return { count: summary.count || 0, deletedCount: summary.deleted_count || 0, feedCount: summary.feed_count, firstSeen: summary.first_seen, storageBytes: storageBytes(), maxMessages, maxBytes };
  }
  function usedBytes() {
    return storageBytes() - Number(db.prepare('PRAGMA freelist_count').get().freelist_count) * Number(db.prepare('PRAGMA page_size').get().page_size);
  }
  function prune({ compact = false, notifySettings = false } = {}) {
    const channels = new Set(notifySettings ? db.prepare('SELECT DISTINCT channel_id FROM messages').all().map(row => row.channel_id) : []);
    let total = countAll.get().count, removed = 0, throughId = 0;
    while (total > maxMessages || usedBytes() > maxBytes) {
      const remove = Math.min(total, Math.max(total - maxMessages, usedBytes() > maxBytes ? 1000 : 0));
      if (!remove) break;
      const rows = db.prepare('SELECT channel_id, MAX(id) AS last_id FROM (SELECT id, channel_id FROM messages ORDER BY id LIMIT ?) GROUP BY channel_id').all(remove);
      for (const row of rows) { channels.add(row.channel_id); throughId = Math.max(throughId, row.last_id); }
      removed += Number(deleteOldest.run(remove).changes);
      db.exec('PRAGMA incremental_vacuum(4000)');
      total = countAll.get().count;
    }
    let compacted = true;
    if (compact) {
      try { db.exec('VACUUM; PRAGMA wal_checkpoint(TRUNCATE)'); }
      catch { compacted = false; }
    }
    for (const channelId of channels) {
      const change = { channelId, scope: 'all', throughId, removed, compacted, archive: archiveOverview(channelId) };
      for (const listener of cleanupListeners) { try { listener(change); } catch {} }
    }
    return { scope: 'all', throughId, removed, compacted };
  }
  prune();
  return {
    add(message) {
      if (!validId(message?.broadcasterId) || !validId(message?.viewerId) || !validId(message?.eventId) || typeof message.text !== 'string' || !Number.isFinite(message.sentAt)) return null;
      const text = message.text.replace(/[\p{Cc}\p{Cf}]/gu, character => character === '\u200d' ? character : '').slice(0, 500);
      if (!text.trim()) return null;
      const badges = validBadges(message.badges);
      const emotes = text === message.text ? validEmoteSpans(message.emotes, text) : [];
      const nameColor = validColor(message.nameColor);
      const roles = Array.isArray(message.roles) ? message.roles : [];
      const kind = message.kind === 'activity' ? 'activity' : 'message';
      const activityType = kind === 'activity' && typeof message.activityType === 'string' && /^[a-z_]{1,40}$/.test(message.activityType) ? message.activityType : '';
      if (kind === 'activity' && !activityType) return null;
      const cheerBits = kind === 'message' && Number.isSafeInteger(message.cheerBits) && message.cheerBits > 0 ? Math.min(message.cheerBits, 1_000_000_000) : 0;
      const result = insert.run(message.broadcasterId, message.eventId, message.viewerId, String(message.viewerName || '').slice(0, 50), String(message.viewerLogin || '').slice(0, 50), JSON.stringify(roles), JSON.stringify(badges), JSON.stringify(emotes), nameColor, kind, activityType, cheerBits, text, Math.trunc(message.sentAt));
      if (!result.changes) {
        const previous = byEvent.get(message.broadcasterId, message.eventId);
        if (!previous || kind === 'activity' || (!nameColor || previous.name_color) && (!badges.length || previous.badges !== '[]') && (!emotes.length || previous.emotes !== '[]')) return null;
        enrich.run(JSON.stringify(roles), badges.length ? JSON.stringify(badges) : previous.badges, nameColor || previous.name_color, emotes.length && previous.text === text ? JSON.stringify(emotes) : previous.emotes, previous.id);
        const updated = rowMessage(byEvent.get(message.broadcasterId, message.eventId));
        for (const listener of listeners) { try { listener(message.broadcasterId, updated, true); } catch {} }
        return updated;
      }
      const saved = { id: Number(result.lastInsertRowid), deleted: false, kind, activityType, viewerId: message.viewerId, viewerName: String(message.viewerName || '').slice(0, 50), viewerLogin: String(message.viewerLogin || '').slice(0, 50), roles, badges, emotes, nameColor, cheerBits, text, sentAt: Math.trunc(message.sentAt) };
      for (const listener of listeners) { try { listener(message.broadcasterId, saved, false); } catch {} }
      if (++insertsSincePrune >= pruneEvery) { insertsSincePrune = 0; prune(); }
      return saved;
    },
    addOutgoing(message) {
      const existing = byEvent.get(message.broadcasterId, message.eventId);
      // EventSub may beat the HTTP acknowledgement. Its text, badges, emotes
      // and deletion flag are authoritative and must not be replaced.
      if (existing) return rowMessage(existing);
      const style = db.prepare("SELECT roles, badges, name_color FROM messages WHERE channel_id = ? AND viewer_id = ? AND kind = 'message' AND (badges <> '[]' OR name_color <> '') ORDER BY id DESC LIMIT 1").get(message.broadcasterId, message.viewerId);
      return this.add({ ...message,
        roles: style ? JSON.parse(style.roles) : message.roles,
        badges: style ? JSON.parse(style.badges) : [{ setId: 'broadcaster', id: '1' }],
        nameColor: style?.name_color || '',
      });
    },
    moderationTarget(channelId, id) {
      if (!validId(channelId) || !Number.isSafeInteger(id) || id < 1) throw new PollError('Некорректное сообщение.', 400);
      const row = db.prepare("SELECT * FROM messages WHERE channel_id = ? AND id = ? AND kind = 'message' AND deleted = 0").get(channelId, id);
      if (!row) throw new PollError('Сообщение уже удалено или недоступно.', 404);
      return { broadcasterId: channelId, eventId: row.event_id, viewerId: row.viewer_id };
    },
    markDeleted(channelId, { eventId, viewerId } = {}) {
      if (!validId(channelId)) return;
      let condition = '', args = [];
      if (eventId && validId(eventId)) { condition = ' AND event_id = ?'; args = [eventId]; }
      else if (viewerId && validId(viewerId)) { condition = ' AND viewer_id = ?'; args = [viewerId]; }
      else if (eventId || viewerId) return;
      // Broadcast only rows that a live client can hold; update the full bounded
      // archive in one statement rather than one SQLite write per message.
      const rows = db.prepare(`SELECT * FROM messages WHERE channel_id = ? AND kind = 'message' AND deleted = 0${condition} AND id IN (SELECT id FROM messages WHERE channel_id = ? ORDER BY id DESC LIMIT 1000)`).all(channelId, ...args, channelId);
      db.prepare(`UPDATE messages SET deleted = 1 WHERE channel_id = ? AND kind = 'message' AND deleted = 0${condition}`).run(channelId, ...args);
      for (const row of rows) {
        const message = { ...rowMessage(row), deleted: true };
        for (const listener of listeners) { try { listener(channelId, message, true); } catch {} }
      }
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    subscribeCleanup(listener) { cleanupListeners.add(listener); return () => cleanupListeners.delete(listener); },
    clearMessages(channelId, scope) {
      if (!validId(channelId)) throw new PollError('Некорректный канал.', 400);
      if (!['deleted', 'all'].includes(scope)) throw new PollError('Некорректный режим очистки.', 400);
      const throughId = db.prepare('SELECT last_id FROM archive_sequence WHERE id = 1').get().last_id;
      const condition = scope === 'deleted' ? " AND kind = 'message' AND deleted = 1" : '';
      const removed = Number(db.prepare(`DELETE FROM messages WHERE channel_id = ?${condition}`).run(channelId).changes);
      // Manual cleanup also reclaims file space, including old databases that
      // predate incremental auto-vacuum. Viewer notes and memo are untouched.
      let compacted = true;
      try { db.exec('VACUUM; PRAGMA wal_checkpoint(TRUNCATE)'); }
      catch { compacted = false; }
      const change = { channelId, scope, throughId, removed, compacted, archive: this.overview(channelId) };
      for (const listener of cleanupListeners) { try { listener(change); } catch {} }
      return change;
    },
    recent(channelId, before = Number.MAX_SAFE_INTEGER, limit = PAGE_SIZE) {
      if (!validId(channelId)) return [];
      return recent.all(channelId, before, Math.min(PAGE_SIZE, limit)).map(rowMessage).reverse();
    },
    overview: archiveOverview,
    setLimits(limits, channelId = '') {
      if (!validArchiveLimits(limits)) throw new PollError('Укажите от 100 до 1 000 000 записей и от 16 до 2048 МБ.', 400);
      db.prepare('INSERT INTO archive_settings (id, max_messages, max_bytes) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET max_messages = excluded.max_messages, max_bytes = excluded.max_bytes').run(limits.maxMessages, limits.maxBytes);
      ({ maxMessages, maxBytes } = limits);
      const change = prune({ compact: true, notifySettings: true });
      return { ...change, channelId, archive: archiveOverview(channelId) };
    },
    participants(channelId) {
      const computedAt = now(), since = computedAt - 10 * 60 * 1000;
      if (!validId(channelId)) return { channelId: channelId || '', since, computedAt, total: 0, participants: [] };
      const parameters = [channelId, since, computedAt];
      const grouped = "SELECT viewer_id, COUNT(*) AS message_count, MAX(id) AS latest_id, MAX(sent_at) AS last_seen FROM messages WHERE channel_id = ? AND kind = 'message' AND deleted = 0 AND viewer_id <> 'system' AND sent_at >= ? AND sent_at <= ? GROUP BY viewer_id";
      const total = db.prepare(`SELECT COUNT(*) AS count FROM (${grouped})`).get(...parameters).count;
      const participants = db.prepare(`SELECT m.viewer_id AS viewerId, m.viewer_name AS viewerName, m.viewer_login AS viewerLogin, m.name_color AS nameColor, g.message_count AS messageCount, g.last_seen AS lastSeen FROM (${grouped}) g JOIN messages m ON m.id = g.latest_id ORDER BY g.message_count DESC, g.last_seen DESC, m.viewer_id LIMIT 50`).all(...parameters);
      return { channelId, since, computedAt, total, participants };
    },
    profile(channelId, viewerId, before = Number.MAX_SAFE_INTEGER) {
      if (!validId(channelId) || !validId(viewerId)) throw new PollError('Некорректный профиль зрителя.', 400);
      const details = viewerDetails.get(channelId, viewerId);
      const latest = lastViewerEntry.get(channelId, viewerId);
      const latestMessage = lastViewerMessage.get(channelId, viewerId);
      return {
        viewerId,
        viewerName: latest?.viewer_name || '',
        viewerLogin: latest?.viewer_login || '',
        roles: latestMessage ? JSON.parse(latestMessage.roles) : [],
        nameColor: latest?.name_color || latestMessage?.name_color || '',
        messageCount: details.count,
        firstSeen: details.first_seen,
        lastSeen: details.last_seen,
        messages: viewerMessages.all(channelId, viewerId, before, PAGE_SIZE).map(rowMessage),
        notes: viewerNotes.all(channelId, viewerId),
      };
    },
    addNote(channelId, viewerId, text) {
      if (!validId(channelId) || !validId(viewerId)) throw new PollError('Некорректная заметка зрителя.', 400);
      const previous = viewerNotes.get(channelId, viewerId);
      // Legacy notes can be longer after merging; preserve their entire text.
      const limit = Math.max(2000, previous?.text.length || 0);
      if (typeof text !== 'string' || !text.trim() || text.length > limit) throw new PollError(`Заметка должна содержать от 1 до ${limit} символов.`, 400);
      const note = { id: previous?.id || randomUUID(), text: text.trim(), createdAt: previous?.createdAt ?? now(), updatedAt: now() };
      db.prepare('INSERT INTO notes (id, channel_id, viewer_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(channel_id, viewer_id) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at').run(note.id, channelId, viewerId, note.text, note.createdAt, note.updatedAt);
      return note;
    },
    setNote(channelId, viewerId, text) {
      if (!validId(channelId) || !validId(viewerId) || typeof text !== 'string') throw new PollError('Некорректная заметка зрителя.', 400);
      if (text.trim()) return this.addNote(channelId, viewerId, text);
      db.prepare('DELETE FROM notes WHERE channel_id = ? AND viewer_id = ?').run(channelId, viewerId);
      return null;
    },
    deleteNote(channelId, viewerId, noteId) {
      if (!validId(channelId) || !validId(viewerId) || typeof noteId !== 'string') throw new PollError('Некорректная заметка.', 400);
      db.prepare('DELETE FROM notes WHERE id = ? AND channel_id = ? AND viewer_id = ?').run(noteId, channelId, viewerId);
    },
    memo() { return db.prepare('SELECT text FROM streamer_memo WHERE id = 1').get()?.text || ''; },
    saveMemo(text) {
      if (typeof text !== 'string' || text.length > 5000) throw new PollError('Заметка слишком длинная.', 400);
      db.prepare('INSERT INTO streamer_memo (id, text) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET text = excluded.text').run(text);
      if (text.trim()) db.prepare('INSERT INTO streamer_notes (id, text, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at').run('legacy-memo', text, now(), now());
      else db.prepare('DELETE FROM streamer_notes WHERE id = ?').run('legacy-memo');
      return text;
    },
    streamerNotes() {
      return db.prepare('SELECT * FROM streamer_notes ORDER BY created_at, id').all().map(rowStreamerNote);
    },
    createStreamerNote({ text, task = false } = {}) {
      if (typeof text !== 'string' || !text.trim() || text.length > 5000 || typeof task !== 'boolean') throw new PollError('Введите заметку от 1 до 5000 символов.', 400);
      if (db.prepare('SELECT COUNT(*) AS count FROM streamer_notes').get().count >= 100) throw new PollError('Можно сохранить до 100 заметок стримера.', 409);
      const note = { id: randomUUID(), text: text.trim(), task, completed: false, createdAt: now(), updatedAt: now() };
      db.prepare('INSERT INTO streamer_notes (id, text, task, completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(note.id, note.text, Number(note.task), 0, note.createdAt, note.updatedAt);
      return note;
    },
    updateStreamerNote(id, patch) {
      const previous = typeof id === 'string' ? db.prepare('SELECT * FROM streamer_notes WHERE id = ?').get(id) : null;
      if (!previous) throw new PollError('Заметка не найдена.', 404);
      if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !['text', 'task', 'completed'].includes(key))) throw new PollError('Некорректная заметка.', 400);
      const note = { ...rowStreamerNote(previous), ...patch, updatedAt: now() };
      if (typeof note.text !== 'string' || !note.text.trim() || note.text.length > 5000 || typeof note.task !== 'boolean' || typeof note.completed !== 'boolean') throw new PollError('Некорректная заметка.', 400);
      note.text = note.text.trim();
      if (!note.task) note.completed = false;
      db.prepare('UPDATE streamer_notes SET text = ?, task = ?, completed = ?, updated_at = ? WHERE id = ?').run(note.text, Number(note.task), Number(note.completed), note.updatedAt, id);
      if (id === 'legacy-memo') db.prepare('UPDATE streamer_memo SET text = ? WHERE id = 1').run(note.text);
      return note;
    },
    deleteStreamerNote(id) {
      if (typeof id !== 'string') throw new PollError('Некорректная заметка.', 400);
      db.prepare('DELETE FROM streamer_notes WHERE id = ?').run(id);
      if (id === 'legacy-memo') db.prepare("UPDATE streamer_memo SET text = '' WHERE id = 1").run();
    },
    close() { db.close(); },
  };
}
