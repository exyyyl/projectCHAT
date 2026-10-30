import { DatabaseSync } from 'node:sqlite';
import { chmod, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PollError } from './polls.mjs';
import { validEmoteSpans } from './chat-emotes.mjs';

const DEFAULT_MAX_MESSAGES = 100_000;
const DEFAULT_MAX_BYTES = 128 * 1024 * 1024;
const PAGE_SIZE = 50;
const validId = value => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,80}$/.test(value);
const rowMessage = row => ({ id: row.id, kind: row.kind || 'message', activityType: row.activity_type || '', viewerId: row.viewer_id, viewerName: row.viewer_name, viewerLogin: row.viewer_login, roles: JSON.parse(row.roles), badges: JSON.parse(row.badges || '[]'), emotes: JSON.parse(row.emotes || '[]'), nameColor: row.name_color || '', cheerBits: row.cheer_bits || 0, text: row.text, sentAt: row.sent_at });
const validBadges = badges => (Array.isArray(badges) ? badges : []).slice(0, 20)
  .filter(badge => typeof badge?.setId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(badge.setId)
    && typeof badge?.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(badge.id))
  .map(badge => ({ setId: badge.setId, id: badge.id }));
const validColor = color => typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '';

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
  `);
  const columns = new Set(db.prepare('PRAGMA table_info(messages)').all().map(column => column.name));
  if (!columns.has('emotes')) db.exec("ALTER TABLE messages ADD COLUMN emotes TEXT NOT NULL DEFAULT '[]'");
  if (!columns.has('badges')) db.exec("ALTER TABLE messages ADD COLUMN badges TEXT NOT NULL DEFAULT '[]'");
  if (!columns.has('name_color')) db.exec("ALTER TABLE messages ADD COLUMN name_color TEXT NOT NULL DEFAULT ''");
  if (!columns.has('kind')) db.exec("ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'message'");
  if (!columns.has('activity_type')) db.exec("ALTER TABLE messages ADD COLUMN activity_type TEXT NOT NULL DEFAULT ''");
  if (!columns.has('cheer_bits')) db.exec('ALTER TABLE messages ADD COLUMN cheer_bits INTEGER NOT NULL DEFAULT 0');
  await chmod(filename, 0o600);
  const insert = db.prepare('INSERT OR IGNORE INTO messages (channel_id, event_id, viewer_id, viewer_name, viewer_login, roles, badges, emotes, name_color, kind, activity_type, cheer_bits, text, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const byEvent = db.prepare('SELECT * FROM messages WHERE channel_id = ? AND event_id = ?');
  const enrich = db.prepare('UPDATE messages SET roles = ?, badges = ?, name_color = ?, emotes = ? WHERE id = ?');
  const recent = db.prepare('SELECT * FROM messages WHERE channel_id = ? AND id < ? ORDER BY id DESC LIMIT ?');
  const viewerMessages = db.prepare("SELECT * FROM messages WHERE channel_id = ? AND viewer_id = ? AND kind = 'message' AND id < ? ORDER BY id DESC LIMIT ?");
  const viewerDetails = db.prepare("SELECT COUNT(*) AS count, MIN(sent_at) AS first_seen, MAX(sent_at) AS last_seen FROM messages WHERE channel_id = ? AND viewer_id = ? AND kind = 'message'");
  const lastViewerEntry = db.prepare('SELECT viewer_name, viewer_login, name_color FROM messages WHERE channel_id = ? AND viewer_id = ? ORDER BY id DESC LIMIT 1');
  const lastViewerMessage = db.prepare("SELECT viewer_name, viewer_login, roles, name_color FROM messages WHERE channel_id = ? AND viewer_id = ? AND kind = 'message' ORDER BY id DESC LIMIT 1");
  const viewerNotes = db.prepare('SELECT id, text, created_at AS createdAt FROM notes WHERE channel_id = ? AND viewer_id = ? ORDER BY created_at DESC');
  const overview = db.prepare("SELECT COUNT(*) AS feed_count, SUM(CASE WHEN kind = 'message' THEN 1 ELSE 0 END) AS count, MIN(sent_at) AS first_seen FROM messages WHERE channel_id = ?");
  const countAll = db.prepare('SELECT COUNT(*) AS count FROM messages');
  const deleteOldest = db.prepare('DELETE FROM messages WHERE id IN (SELECT id FROM messages ORDER BY id LIMIT ?)');
  const listeners = new Set();
  let insertsSincePrune = 0;

  function storageBytes() {
    return Number(db.prepare('PRAGMA page_count').get().page_count) * Number(db.prepare('PRAGMA page_size').get().page_size);
  }
  function prune() {
    let total = countAll.get().count;
    let bytes = storageBytes();
    while (total > maxMessages || bytes > maxBytes) {
      const remove = Math.min(total, Math.max(total - maxMessages, bytes > maxBytes ? 1000 : 0));
      if (!remove) break;
      deleteOldest.run(remove);
      db.exec('PRAGMA wal_checkpoint(PASSIVE); PRAGMA incremental_vacuum(4000)');
      total = countAll.get().count;
      bytes = storageBytes();
    }
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
      const saved = { id: Number(result.lastInsertRowid), kind, activityType, viewerId: message.viewerId, viewerName: String(message.viewerName || '').slice(0, 50), viewerLogin: String(message.viewerLogin || '').slice(0, 50), roles, badges, emotes, nameColor, cheerBits, text, sentAt: Math.trunc(message.sentAt) };
      for (const listener of listeners) { try { listener(message.broadcasterId, saved, false); } catch {} }
      if (++insertsSincePrune >= pruneEvery) { insertsSincePrune = 0; prune(); }
      return saved;
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    recent(channelId, before = Number.MAX_SAFE_INTEGER, limit = PAGE_SIZE) {
      if (!validId(channelId)) return [];
      return recent.all(channelId, before, Math.min(PAGE_SIZE, limit)).map(rowMessage).reverse();
    },
    overview(channelId) {
      const summary = validId(channelId) ? overview.get(channelId) : { count: 0, feed_count: 0, first_seen: null };
      return { count: summary.count || 0, feedCount: summary.feed_count, firstSeen: summary.first_seen, storageBytes: storageBytes(), maxMessages, maxBytes };
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
      if (!validId(channelId) || !validId(viewerId) || typeof text !== 'string' || !text.trim() || text.length > 2000) throw new PollError('Заметка должна содержать от 1 до 2000 символов.', 400);
      const count = db.prepare('SELECT COUNT(*) AS count FROM notes WHERE channel_id = ? AND viewer_id = ?').get(channelId, viewerId).count;
      if (count >= 100) throw new PollError('Для зрителя можно сохранить до 100 заметок.', 409);
      const note = { id: randomUUID(), text: text.trim(), createdAt: now() };
      db.prepare('INSERT INTO notes (id, channel_id, viewer_id, text, created_at) VALUES (?, ?, ?, ?, ?)').run(note.id, channelId, viewerId, note.text, note.createdAt);
      return note;
    },
    deleteNote(channelId, viewerId, noteId) {
      if (!validId(channelId) || !validId(viewerId) || typeof noteId !== 'string') throw new PollError('Некорректная заметка.', 400);
      db.prepare('DELETE FROM notes WHERE id = ? AND channel_id = ? AND viewer_id = ?').run(noteId, channelId, viewerId);
    },
    memo() { return db.prepare('SELECT text FROM streamer_memo WHERE id = 1').get()?.text || ''; },
    saveMemo(text) {
      if (typeof text !== 'string' || text.length > 5000) throw new PollError('Заметка слишком длинная.', 400);
      db.prepare('INSERT INTO streamer_memo (id, text) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET text = excluded.text').run(text);
      return text;
    },
    close() { db.close(); },
  };
}
