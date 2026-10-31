import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import electron from 'electron';

test('the real Electron runtime can extract, validate and remove a valid app.asar', { skip: process.platform === 'linux' && !process.env.DISPLAY }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cue-electron-archive-'));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  try {
    const result = spawnSync(electron, [fileURLToPath(new URL('./fixtures/version-archive-electron.cjs', import.meta.url)), directory], { env, encoding: 'utf8', timeout: 20000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
