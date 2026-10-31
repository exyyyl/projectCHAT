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
  let entries = [], timer, tail = Promise.resolve(), storageAvailable = true;
  const clean = value => redactDiagnostic(value, home);
  const bounded = () => {
    entries = entries.filter(entry => now() - entry.lastAt <= 30 * 86400000).slice(-MAX_ENTRIES);
    while (entries.length && Buffer.byteLength(JSON.stringify(entries)) > MAX_BYTES - 2048) entries.shift();
  };
  try {
    if ((await stat(filename)).size <= MAX_BYTES) {
      const saved = JSON.parse(await readFile(filename, 'utf8'));
      if (saved.schema === 1 && Array.isArray(saved.entries)) entries = saved.entries.filter(entry => typeof entry.id === 'string' && typeof entry.source === 'string' && typeof entry.details === 'string' && Number.isFinite(entry.lastAt)).slice(-MAX_ENTRIES).map(entry => ({ id: entry.id.slice(0, 64), source: clean(entry.source).slice(0, 80), title: clean(entry.title).slice(0, 240), details: clean(entry.details).slice(0, 6000), version: clean(entry.version).slice(0, 40), firstAt: Number(entry.firstAt) || entry.lastAt, lastAt: entry.lastAt, count: Math.max(1, Math.min(Number(entry.count) || 1, 1000000)) }));
    }
  } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) storageAvailable = false; }
  bounded();
  const flush = () => {
    clearTimeout(timer);
    bounded();
    const data = JSON.stringify({ schema: 1, entries });
    tail = tail.then(async () => { await mkdir(dirname(filename), { recursive: true }); await writeFile(filename + '.tmp', data, { mode: 0o600 }); await rename(filename + '.tmp', filename); storageAvailable = true; }).catch(() => { storageAvailable = false; });
    return tail;
  };
  const snapshot = () => { bounded(); return { schema: 1, version, platform, storageAvailable, entries: structuredClone(entries).reverse() }; };
  return {
    snapshot,
    record({ source = 'app', error }) {
      const details = clean(error instanceof Error ? error.stack || error.message : error).slice(0, 6000);
      if (!details) return;
      source = clean(source).slice(0, 80);
      const fingerprint = createHash('sha256').update(source + details).digest('hex');
      const previous = entries.find(entry => entry.id === fingerprint && entry.version === version);
      if (previous) { previous.count = Math.min(previous.count + 1, 1000000); previous.lastAt = now(); entries = [...entries.filter(entry => entry !== previous), previous]; }
      else entries.push({ id: fingerprint, source, title: clean(presentError(error, source).title), details, version, firstAt: now(), lastAt: now(), count: 1 });
      bounded(); clearTimeout(timer); timer = setTimeout(flush, 200); timer.unref?.();
    },
    async clear() { entries = []; await flush(); return snapshot(); },
    flush,
    flushSync() {
      try { bounded(); mkdirSync(dirname(filename), { recursive: true }); writeFileSync(filename + '.crash.tmp', JSON.stringify({ schema: 1, entries }), { mode: 0o600 }); renameSync(filename + '.crash.tmp', filename); } catch { /* Error reporting must never replace the original fatal error. */ }
    },
  };
}
