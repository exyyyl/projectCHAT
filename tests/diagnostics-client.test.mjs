import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

async function client(suffix) {
  const code = stripTypeScriptTypes(await readFile(new URL('../ui/panel/src/domain/diagnostics.ts', import.meta.url), 'utf8'));
  return import(`data:text/javascript;base64,${Buffer.from(code + '\n//' + suffix).toString('base64')}`);
}

test('a burst preserves every recorded occurrence but refreshes the journal once', async t => {
  const previousWindow = globalThis.window;
  const window = new EventTarget();
  let records = 0, updates = 0, scheduled = 0, notify;
  window.streamPollsDesktop = { recordError: async () => { records++; } };
  window.setTimeout = callback => { scheduled++; notify = callback; return 1; };
  window.addEventListener('cue:diagnostic', () => { updates++; });
  globalThis.window = window;
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  const { recordClientError } = await client('notification-burst');
  for (let i = 0; i < 40; i++) recordClientError('Repeated connection failure');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(records, 40);
  assert.equal(scheduled, 1);
  assert.equal(updates, 0);
  notify();
  assert.equal(updates, 1);
});

test('concurrent journal consumers share one request and a later refresh remains fresh', async t => {
  let requests = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    await gate;
    return { ok: true, json: async () => ({ entries: [], version: String(requests) }) };
  });
  const { loadDiagnostics } = await client('read-burst');
  const pending = Array.from({ length: 20 }, () => loadDiagnostics());
  const concurrentRequests = requests;
  release();
  await Promise.all(pending);
  assert.equal(concurrentRequests, 1);
  assert.equal((await loadDiagnostics()).version, '2');
});
