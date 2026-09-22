import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createInputCapture } from '../desktop/input-capture.mjs';
import { createInputOverlay, defaultInputOverlayConfig } from '../server/input-overlay.mjs';

test('input overlay persists configuration and keeps live input out of the file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'projectchat-input-'));
  const filename = join(directory, 'input-overlay.json');
  const overlay = await createInputOverlay(filename);
  const config = { ...defaultInputOverlayConfig(), captureEnabled: true, layout: 'compact', accent: '#b89aff' };
  await overlay.update(config);
  overlay.input({ kind: 'key', action: 'down', code: 'W' });
  overlay.input({ kind: 'mouse', action: 'down', button: 'left' });
  overlay.input({ kind: 'key', action: 'down', code: 'Password' });
  assert.deepEqual(overlay.snapshot().pressedKeys, ['W']);
  assert.deepEqual(overlay.snapshot().pressedMouse, ['left']);
  const stored = JSON.parse(await readFile(filename, 'utf8'));
  assert.deepEqual(stored, { schema: 1, config });
  await overlay.close();

  const restored = await createInputOverlay(filename);
  assert.deepEqual(restored.snapshot().config, config);
  assert.deepEqual(restored.snapshot().pressedKeys, []);
  await restored.close();
});

test('input overlay validates settings and exposes an animated demo', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'projectchat-input-'));
  const overlay = await createInputOverlay(join(directory, 'input-overlay.json'));
  await assert.rejects(() => overlay.update({ ...defaultInputOverlayConfig(), accent: 'lime' }), /цвет/);
  const state = overlay.demo();
  assert.equal(state.demo, true);
  overlay.reset();
  assert.equal(overlay.snapshot().demo, false);
  await overlay.close();
});

test('unfinished widgets are exposed only behind the development feature flags', async () => {
  const [features, app, sidebar, widgets, navigation] = await Promise.all([
    readFile('ui/panel/src/domain/release-features.ts', 'utf8'),
    readFile('ui/panel/src/App.tsx', 'utf8'),
    readFile('ui/panel/src/components/app-sidebar.tsx', 'utf8'),
    readFile('ui/panel/src/components/widget-page.tsx', 'utf8'),
    readFile('ui/panel/src/domain/app-navigation.ts', 'utf8'),
  ]);
  assert.match(features, /SHOW_INPUT_OVERLAY\s*=\s*import\.meta\.env\.DEV/u);
  assert.match(features, /SHOW_CONTEST_WIDGET\s*=\s*import\.meta\.env\.DEV/u);
  assert.match(navigation, /"input-overlay"/u);
  assert.match(app, /SHOW_INPUT_OVERLAY/u);
  assert.match(app, /InputOverlayPage/u);
  assert.match(sidebar, /SHOW_INPUT_OVERLAY/u);
  assert.match(widgets, /SHOW_CONTEST_WIDGET/u);
  assert.match(widgets, /SHOW_INPUT_OVERLAY/u);
});

test('Windows input capture maps native key and mouse events', async () => {
  class Child extends EventEmitter {
    constructor() {
      super();
      this.stdout = new PassThrough();
      this.stderr = new PassThrough();
    }
    kill() { this.killed = true; }
  }
  const child = new Child();
  const events = [];
  const statuses = [];
  const capture = createInputCapture({
    platform: 'win32',
    executable: 'capture.exe',
    emit: event => events.push(event),
    status: state => statuses.push(state),
    spawnProcess: (file, args, options) => {
      assert.equal(file, 'capture.exe');
      assert.deepEqual(args, []);
      assert.equal(options.windowsHide, true);
      queueMicrotask(() => child.emit('spawn'));
      return child;
    },
  });
  await capture.setEnabled(true);
  await new Promise(resolve => setImmediate(resolve));
  child.stdout.write('{"kind":"key","action":"down","code":"W"}\n');
  child.stdout.write('{"kind":"key","action":"up","code":"Ctrl"}\n');
  child.stdout.write('{"kind":"mouse","action":"down","button":"left"}\n');
  child.stdout.write('{"kind":"wheel","direction":"up"}\n');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, [
    { kind: 'key', action: 'down', code: 'W' },
    { kind: 'key', action: 'up', code: 'Ctrl' },
    { kind: 'mouse', action: 'down', button: 'left' },
    { kind: 'wheel', direction: 'up' },
  ]);
  assert.equal(statuses.at(-1).listening, true);
  await capture.setEnabled(false);
  assert.equal(child.killed, true);
  assert.equal(statuses.at(-1).listening, false);
});

test('input capture stays disabled outside Windows', async () => {
  let spawned = false;
  const statuses = [];
  const capture = createInputCapture({
    platform: 'darwin',
    emit: () => {},
    status: state => statuses.push(state),
    executable: 'capture.exe',
    spawnProcess: () => { spawned = true; },
  });
  await capture.setEnabled(true);
  assert.equal(spawned, false);
  assert.equal(statuses.at(-1).supported, false);
  assert.match(statuses.at(-1).message, /Windows/);
});
