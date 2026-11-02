import test from 'node:test';
import assert from 'node:assert/strict';
import { initialNavigation, navigationReducer as reduce } from '../ui/panel/src/domain/app-navigation.ts';

test('sidebar navigation stays inside a tab; explicit new tabs may show the same section', () => {
  let state = reduce(initialNavigation(), { type: 'navigate', view: 'presets' });
  assert.equal(state.tabs.length, 1);
  state = reduce(state, { type: 'create', id: 'second' });
  state = reduce(state, { type: 'navigate', view: 'presets' });
  assert.equal(state.tabs.length, 2);
  assert.equal(state.tabs[0].history.at(-1), 'presets');
  assert.equal(state.tabs[1].history.at(-1), 'presets');
  state = reduce(state, { type: 'navigate', view: 'contests' });
  assert.equal(state.tabs[0].history.at(-1), 'presets');
  assert.equal(state.tabs[1].history.at(-1), 'contests');
});

test('each tab owns history; a new navigation replaces the forward branch but keeps visited pages', () => {
  let state = reduce(initialNavigation(), { type: 'navigate', view: 'presets' });
  state = reduce(state, { type: 'navigate', view: 'widget' });
  state = reduce(state, { type: 'history', offset: -1 });
  state = reduce(state, { type: 'navigate', view: 'settings' });
  assert.deepEqual(state.tabs[0].history, ['home', 'presets', 'settings']);
  assert.deepEqual(state.tabs[0].visited, ['home', 'presets', 'widget', 'settings']);
  state = reduce(state, { type: 'create', id: 'second' });
  state = reduce(state, { type: 'history', offset: -1 });
  assert.equal(state.tabs[1].position, 0);
  state = reduce(state, { type: 'select', id: 'initial' });
  state = reduce(state, { type: 'history', offset: -1 });
  assert.equal(state.tabs[0].history[state.tabs[0].position], 'presets');
});

test('closing an inactive tab preserves active selection; the last tab cannot disappear', () => {
  let state = reduce(initialNavigation(), { type: 'create', id: 'second' });
  state = reduce(state, { type: 'create', id: 'third' });
  state = reduce(state, { type: 'close', id: 'initial' });
  assert.equal(state.activeId, 'third');
  state = reduce(state, { type: 'close', id: 'third' });
  assert.equal(state.activeId, 'second');
  assert.equal(reduce(state, { type: 'close', id: 'second' }), state);
});

test('late navigation targets its originating tab rather than the currently selected tab', () => {
  let state = reduce(initialNavigation(), { type: 'create', id: 'second' });
  state = reduce(state, { type: 'navigate', tabId: 'initial', view: 'presets' });
  assert.equal(state.activeId, 'second');
  assert.deepEqual(state.tabs[1].history, ['new']);
  assert.deepEqual(state.tabs[0].history, ['home', 'presets']);
});

test('packaged navigation keeps templates unavailable while development retains access', () => {
  const start = initialNavigation();
  assert.equal(reduce(start,{type:'navigate',view:'presets'},true),start);
  assert.equal(reduce(start,{type:'navigate',view:'presets'},false).tabs[0].history.at(-1),'presets');
  for (const view of ['home','polls','widget','contests','decision-wheel','settings'])
    assert.equal(reduce(start,{type:'navigate',view},true).tabs[0].history.at(-1),view);
  const second = reduce(start,{type:'create',id:'second'},true);
  assert.equal(reduce(second,{type:'navigate',tabId:'initial',view:'presets'},true),second);
});
