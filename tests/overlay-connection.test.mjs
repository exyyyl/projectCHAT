import test from 'node:test';
import assert from 'node:assert/strict';
import { connect, connectEvents } from '../public/shared.js';

function browser(t) {
  const sources = [];
  class BrowserEventSource extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;
    readyState = 0;
    constructor(url) { super(); this.url = url; sources.push(this); }
    close() { this.readyState = 2; }
    open() { this.readyState = 1; this.onopen?.(); }
    fail() { this.readyState = 2; this.onerror?.(); }
    state(value) { this.dispatchEvent(new MessageEvent('state', { data: JSON.stringify(value) })); }
  }
  const page = new EventTarget();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const [key, value] of Object.entries({ EventSource: BrowserEventSource, window: page })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  return { sources, page };
}

test('OBS widget reconnects after the app goes away and the browser closes its event stream', t => {
  let connection;
  t.after(() => connection?.close());
  const { sources } = browser(t);
  const states = [], connections = [];
  connection = connect(state => states.push(state), value => connections.push(value));
  sources[0].open();
  sources[0].state({ revision: 20, poll: { question: 'До перезапуска' } });
  sources[0].fail();
  t.mock.timers.tick(1000);
  assert.equal(sources.length, 2, 'the widget must retry without reloading the OBS source');
  // The app remains closed through another connection attempt.
  sources[1].fail();
  t.mock.timers.tick(5000);
  assert.equal(sources.length, 3, 'recovery must continue while the app is unavailable');
  sources[2].open();
  sources[2].state({ revision: 21, poll: { question: 'После перезапуска' } });
  assert.equal(states.at(-1).poll.question, 'После перезапуска');
  assert.equal(connections.at(-1), true);
  sources[0].state({ revision: 20, poll: { question: 'Старый поток' } });
  assert.equal(states.at(-1).poll.question, 'После перезапуска', 'closed connections cannot overwrite current state');
});

test('OBS widget resumes when its browser page is restored', t => {
  let connection;
  t.after(() => connection?.close());
  const { sources, page } = browser(t);
  const states = [];
  connection = connect(state => states.push(state), () => {});
  page.dispatchEvent(new Event('pagehide'));
  assert.equal(sources[0].readyState, 2);
  page.dispatchEvent(new Event('pageshow'));
  assert.equal(sources.length, 2, 'restored browser source must reconnect');
  sources[1].state({ revision: 1, poll: null });
  assert.equal(states.length, 1);
  connection.close();
  page.dispatchEvent(new Event('pageshow'));
  t.mock.timers.tick(30000);
  assert.equal(sources.length, 2, 'explicit close stops retries and page listeners');
});

test('unavailable app retries once per failure and stops retrying when disposed', t => {
  let connection;
  t.after(() => connection?.close());
  const { sources, page } = browser(t);
  connection = connect(() => {}, () => {});
  sources[0].fail();
  sources[0].fail();
  t.mock.timers.tick(1000);
  assert.equal(sources.length, 2);
  page.dispatchEvent(new Event('pageshow'));
  assert.equal(sources.length, 2, 'page restore must not duplicate an active stream');
  sources[1].fail();
  connection.close();
  t.mock.timers.tick(30000);
  assert.equal(sources.length, 2);
});

test('keyboard overlay receives new input snapshots after reconnecting', t => {
  let connection;
  t.after(() => connection?.close());
  const { sources } = browser(t);
  const states = [];
  connection = connectEvents('/api/input-overlay/events', { input: state => states.push(state) });
  sources[0].fail();
  t.mock.timers.tick(1000);
  assert.equal(sources[1].url, '/api/input-overlay/events');
  sources[1].dispatchEvent(new MessageEvent('input', { data: JSON.stringify({ pressedKeys: ['W'] }) }));
  assert.deepEqual(states, [{ pressedKeys: ['W'] }]);
});
