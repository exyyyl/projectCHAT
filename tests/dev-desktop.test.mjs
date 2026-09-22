import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldReloadDesktop, watchDesktopSources } from '../scripts/watch-desktop.mjs';

test('desktop development reload watches server source and ignores unrelated files', () => {
  assert.equal(shouldReloadDesktop('contest.mjs'), true);
  assert.equal(shouldReloadDesktop('preload.cjs'), true);
  assert.equal(shouldReloadDesktop('preferences.json'), true);
  assert.equal(shouldReloadDesktop('notes.md'), false);

  const callbacks = [];
  const timers = [];
  let reloads = 0;
  let closed = 0;
  const stop = watchDesktopSources({
    directories: ['server', 'desktop'],
    onReload: () => { reloads += 1; },
    watch: (_directory, _options, callback) => {
      callbacks.push(callback);
      return { close: () => { closed += 1; } };
    },
    later: callback => { timers.push(callback); return callback; },
    cancel: timer => {
      const index = timers.indexOf(timer);
      if (index >= 0) timers.splice(index, 1);
    },
  });

  callbacks[0]('change', 'readme.md');
  callbacks[0]('change', 'contest.mjs');
  callbacks[1]('change', 'main.mjs');
  assert.equal(timers.length, 1);
  timers[0]();
  assert.equal(reloads, 1);

  stop();
  assert.equal(closed, 2);
});
