import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { presentError } from '../public/error-messages.js';

const MAX_BYTES = 512 * 1024;
const MAX_ENTRIES = 100;
export function redactDiagnostic(value, home = homedir()) {
  let text = String(value || '').slice(0, 16000);
  if (home) text = text.split(home).join('<home>');
  text = text
    .replace(/\b(?:Bearer|OAuth)\s+[A-Za-z0-9._~+\/-]+/giu, 'Bearer <redacted>')
    .replace(/((?:access[_-]?token|refresh[_-]?token|client[_-]?secret|device[_-]?code|password|authorization)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/giu, '$1<redacted>')
    .replace(/https?:\/\/[^\s"'<>]+/giu, value => { try { const url = new URL(value); url.username = ''; url.password = ''; if (url.search) url.search = '?redacted'; url.hash = ''; return url.href; } catch { return '<url>'; } })
    .replace(/[A-Z]:\\Users\\[^\\\s]+/giu, '<home>')
    .replace(/\/(?:Users|home)\/[^/\s]+/gu, '<home>');
  return text.includes('@') ? text.replace(/[A-Z0-9._%+-]{1,128}@[A-Z0-9.-]{1,253}\.[A-Z]{2,24}/giu, '<email>') : text;
}

export async function createErrorJournal(filename, { version = '', platform = process.platform, now = Date.now, home = homedir() } = {}) {
  let entries = [], timer, pendingWrite, revision = 0, savedRevision = 0, storageAvailable = true;
  const sizes = new WeakMap();
  const clean = value => redactDiagnostic(value, home);
  const fingerprint = (source, details, entryVersion) => createHash('sha256')
    .update(JSON.stringify([entryVersion, source, details.split(/\n\s*at\s/)[0].trim()])).digest('hex');
  const entryBytes = entry => {
    if (!sizes.has(entry)) sizes.set(entry, Buffer.byteLength(JSON.stringify(entry)));
    return sizes.get(entry);
  };
  const bounded = () => {
    entries = entries.filter(entry => now() - entry.lastAt <= 30 * 86400000).slice(-MAX_ENTRIES);
    let bytes = entries.reduce((sum, entry) => sum + entryBytes(entry), 2 + entries.length);
    while (entries.length && bytes > MAX_BYTES - 2048) bytes -= entryBytes(entries.shift()) + 1;
  };
  const merge = entry => {
    const previous = entries.find(item => item.id === entry.id);
    if (!previous) { entries.push(entry); return; }
    const newer = entry.lastAt >= previous.lastAt ? entry : previous;
    const merged = { ...newer, firstAt: Math.min(previous.firstAt, entry.firstAt), lastAt: Math.max(previous.lastAt, entry.lastAt), count: Math.min(previous.count + entry.count, 1000000) };
    entries = entries.filter(item => item !== previous);
    entries.push(merged);
  };
  try {
    if ((await stat(filename)).size <= MAX_BYTES) {
      const saved = JSON.parse(await readFile(filename, 'utf8'));
      if (saved.schema === 1 && Array.isArray(saved.entries)) {
        for (const item of saved.entries.slice(-MAX_ENTRIES)) {
          if (typeof item.source !== 'string' || typeof item.details !== 'string' || !Number.isFinite(item.lastAt)) continue;
          const source = clean(item.source).slice(0, 80), details = clean(item.details).slice(0, 6000), entryVersion = clean(item.version).slice(0, 40);
          merge({ id: fingerprint(source, details, entryVersion), source, title: clean(item.title).slice(0, 240), details, version: entryVersion, firstAt: Number(item.firstAt) || item.lastAt, lastAt: item.lastAt, count: Math.max(1, Math.min(Number(item.count) || 1, 1000000)) });
        }
        entries.sort((a, b) => a.lastAt - b.lastAt);
      }
    }
  } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) storageAvailable = false; }
  bounded();
  const flush = () => {
    clearTimeout(timer); timer = undefined;
    if (pendingWrite) return pendingWrite;
    if (savedRevision === revision) return Promise.resolve();
    // Keep only the live bounded journal while I/O is busy. A burst schedules one
    // current write and one latest-state write, not a queue of serialized snapshots.
    pendingWrite = (async () => {
      while (savedRevision !== revision) {
        bounded();
        const writingRevision = revision;
        const data = JSON.stringify({ schema: 1, entries });
        try {
          await mkdir(dirname(filename), { recursive: true });
          await writeFile(filename + '.tmp', data, { mode: 0o600 });
          await rename(filename + '.tmp', filename);
          savedRevision = writingRevision;
          storageAvailable = true;
        } catch { storageAvailable = false; break; }
      }
    })().finally(() => { pendingWrite = undefined; });
    return pendingWrite;
  };
  const snapshot = () => { bounded(); return { schema: 1, version, platform, storageAvailable, entries: structuredClone(entries).reverse() }; };
  return {
    snapshot,
    summary() { bounded(); return { schema: 1, version, platform, storageAvailable, count: entries.length, totalOccurrences: entries.reduce((sum, entry) => sum + entry.count, 0), lastAt: entries.at(-1)?.lastAt ?? null }; },
    record({ source = 'app', error }) {
      const details = clean(error instanceof Error ? error.stack || error.message : error).slice(0, 6000);
      if (!details) return;
      source = clean(source).slice(0, 80);
      const recordedAt = now();
      merge({ id: fingerprint(source, details, version), source, title: clean(presentError(error, source).title), details, version, firstAt: recordedAt, lastAt: recordedAt, count: 1 });
      bounded(); revision++;
      if (!timer) { timer = setTimeout(flush, 200); timer.unref?.(); }
    },
    async clear() { entries = []; revision++; await flush(); return snapshot(); },
    flush,
    flushSync() {
      clearTimeout(timer); timer = undefined;
      try { bounded(); mkdirSync(dirname(filename), { recursive: true }); writeFileSync(filename + '.crash.tmp', JSON.stringify({ schema: 1, entries }), { mode: 0o600 }); renameSync(filename + '.crash.tmp', filename); } catch { /* Error reporting must never replace the original fatal error. */ }
    },
  };
}
