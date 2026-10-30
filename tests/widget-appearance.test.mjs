import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, defaultWidget, initialState, validateStoredState } from '../server/polls.mjs';
import { resolveWidget, widgetStyle } from '../public/widget-model.js';

test('manual widget appearance survives saving and backup import', () => {
  const widget = { ...defaultWidget(), layout: 'horizontal', panelWidth: 1120, padding: 32, gap: 20, cornerRadius: 0, titleFontSize: 36, optionFontSize: 20, barHeight: 12, opacity: 43, panelColor: '#202430', textColor: '#ffffff', mutedColor: '#c0c6d0', trackColor: '#464b55', optionStyle: 'fill', showNumbers: true, showTotal: false, highlightWinner: false };
  const changed = applyCommand(initialState(), { type: 'widget-update', widget }).state;
  assert.deepEqual(validateStoredState(JSON.parse(JSON.stringify(changed))).widget, widget);
  const imported = applyCommand(initialState(), { type: 'settings-import', draftRevision: 0, settings: { schema: 1, app: 'Cue', draft: changed.draft, presets: [], widget } }).state;
  assert.deepEqual(imported.widget, widget);
});

test('appearance rejects unsafe colors, invalid numeric inputs and unusable horizontal widths', () => {
  for (const patch of [
    { panelColor: 'url(https://example.com)' }, { textColor: '#fff' }, { mutedColor: 'red' },
    { trackColor: '#fff;display:none' }, { panelWidth: 2000 }, { opacity: -1 }, { opacity: 101 },
    { gap: 3.5 }, { titleFontSize: '32' }, { padding: NaN }, { showNumbers: 1 },
    { layout: 'horizontal', panelWidth: 300 }, { layout: 'diagonal' },
  ]) assert.throws(() => applyCommand(initialState(), { type: 'widget-update', widget: { ...defaultWidget(), ...patch } }));
});

test('zero opacity and square corners are preserved in the browser source', () => {
  const widget = applyCommand(initialState(), { type: 'widget-update', widget: { ...defaultWidget(), opacity: 0, cornerRadius: 0 } }).state.widget;
  assert.equal(widgetStyle(widget)['--cue-opacity'], '0');
  assert.equal(widgetStyle(widget)['--cue-radius'], '0px');
});

test('legacy sizes resolve consistently for both editor and OBS and horizontal format has a useful default', () => {
  const widget = resolveWidget({ width: 'narrow', density: 'compact', radius: 'large', titleSize: 'large', optionSize: 'small', barSize: 'thin' });
  assert.equal(widget.panelWidth, 360);
  assert.equal(widget.padding, 16);
  assert.equal(widget.cornerRadius, 28);
  assert.equal(widget.titleFontSize, 38);
  assert.equal(widget.optionFontSize, 14);
  assert.equal(widget.barHeight, 3);
  assert.equal(resolveWidget({ layout: 'horizontal' }).panelWidth, 960);
});
