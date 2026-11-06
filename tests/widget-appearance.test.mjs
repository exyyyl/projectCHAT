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

test('poll and contest looks persist visual fields without replacing content or output choices', async () => {
  const { pollWidgetLooks, contestWidgetLooks } = await import('../ui/panel/src/domain/widget-looks.ts');
  for (const look of pollWidgetLooks) {
    const initial = initialState();
    initial.widget = { ...initial.widget, layout: 'horizontal', panelWidth: 1100, showTimer: false, showNumbers: true };
    initial.draft.showOverlay = false;
    const changed = applyCommand(initial, { type: 'widget-update', widget: { ...initial.widget, ...look.settings } }).state;
    const restored = validateStoredState(JSON.parse(JSON.stringify(changed)));
    assert.deepEqual(restored.draft, initial.draft);
    assert.equal(restored.widget.panelWidth, look.settings.panelWidth);
    assert.equal(restored.widget.layout, look.settings.layout);
    assert.equal(restored.widget.showTimer, false);
    assert.equal(restored.widget.showNumbers, true);
    for (const [key, value] of Object.entries(look.settings)) assert.equal(restored.widget[key], value);
  }
  for (const look of contestWidgetLooks) {
    const initial = initialState();
    initial.contestOverlay = { ...initial.contestOverlay, enabled: false, width: 700, showRecent: false };
    const changed = applyCommand(initial, { type: 'contest-overlay-update', settings: look.settings }).state;
    const restored = validateStoredState(JSON.parse(JSON.stringify(changed)));
    assert.equal(restored.contestOverlay.enabled, false);
    assert.equal(restored.contestOverlay.width, look.settings.width);
    assert.equal(restored.contestOverlay.showRecent, false);
    for (const [key, value] of Object.entries(look.settings)) assert.equal(restored.contestOverlay[key], value);
  }
});


test('ready looks cover real typography and composition, and legacy overlays keep their defaults', async () => {
  const { pollWidgetLooks, contestWidgetLooks } = await import('../ui/panel/src/domain/widget-looks.ts');
  const { validateContestOverlay } = await import('../server/polls.mjs');
  const { widgetFontFamily } = await import('../public/widget-fonts.js');
  assert.equal(new Set(pollWidgetLooks.map(look=>look.settings.font)).size,4);
  assert.equal(new Set(contestWidgetLooks.map(look=>look.settings.font)).size,4);
  assert.equal(new Set(pollWidgetLooks.map(look=>look.settings.layout)).size,3);
  assert.equal(new Set(contestWidgetLooks.map(look=>look.settings.layout)).size,3);
  assert.match(widgetFontFamily('serif'), /Roboto Slab/);
  assert.equal(widgetStyle({...defaultWidget(),font:'serif'}).fontFamily,widgetFontFamily('serif'));
  assert.equal(validateContestOverlay({width:480}).font,'geist');
  assert.equal(validateContestOverlay({width:480}).layout,'stacked');
  assert.equal(validateContestOverlay({width:480}).alignment,'auto');
  for (const patch of [{font:'url(bad)'},{layout:'diagonal'},{alignment:'right'},{layout:'banner',width:300}])
    assert.throws(()=>validateContestOverlay(patch));
  for (const patch of [{layout:'grid',panelWidth:300},{alignment:'right'}])
    assert.throws(()=>applyCommand(initialState(),{type:'widget-update',widget:{...defaultWidget(),...patch}}));
});


test('bundled Google Fonts round-trip through all three overlay settings and backup import', async () => {
  const { widgetFonts, widgetFontFamily } = await import('../public/widget-fonts.js');
  const { chatOverlayStyle } = await import('../public/chat-overlay-model.js');
  assert.equal(widgetFonts.length, 12);
  for (const font of widgetFonts) {
    let state = initialState();
    state = applyCommand(state, {type:'widget-update', widget:{...state.widget,font}}).state;
    state = applyCommand(state, {type:'chat-overlay-update', settings:{font}}).state;
    state = applyCommand(state, {type:'contest-overlay-update', settings:{font}}).state;
    const settings = {schema:1, app:'Cue', draft:state.draft, presets:[], widget:state.widget, chatOverlay:state.chatOverlay, contestOverlay:state.contestOverlay};
    const imported = applyCommand(initialState(), {type:'settings-import',draftRevision:0, settings}).state;
    const restored = validateStoredState(JSON.parse(JSON.stringify(imported)));
    for (const kind of ['widget','chatOverlay','contestOverlay']) assert.equal(restored[kind].font,font,kind + ':' + font);
    assert.equal(widgetStyle(restored.widget).fontFamily,widgetFontFamily(font));
    assert.equal(chatOverlayStyle(restored.chatOverlay).fontFamily,widgetFontFamily(font));
  }
  for (const [type,key] of [['widget-update','widget'],['chat-overlay-update','settings'],['contest-overlay-update','settings']])
    assert.throws(()=>applyCommand(initialState(), {type,[key]:{...defaultWidget(),font:'url(https://invalid.test)'}}));
});

test('all bundled fonts have real local Latin/Cyrillic files and distributable licenses', async () => {
  const {readFile} = await import('node:fs/promises');
  const {widgetFontFiles} = await import('../public/widget-fonts.js');
  const css = await readFile(new URL('../public/fonts/widget-fonts.css', import.meta.url),'utf8');
  assert.equal(widgetFontFiles.length,16);
  assert.doesNotMatch(css,/https?:/);
  for (const name of widgetFontFiles) {
    const bytes = await readFile(new URL('../public/fonts/'+name,import.meta.url));
    assert.equal(bytes.subarray(0,4).toString(),'wOF2');
    assert.ok(css.includes('./'+name));
    const family = name.replace(/-(?:latin|cyrillic)-wght-normal\.woff2$/,'');
    assert.match(await readFile(new URL('../public/fonts/licenses/'+family+'.txt',import.meta.url),'utf8'),/SIL OPEN FONT LICENSE|Apache License/i);
  }
});


test('font choices contain family names and legacy categories resolve to bundled families', async () => {
  const {widgetFontOptions,resolveWidgetFont,widgetFontFamily} = await import('../public/widget-fonts.js');
  const ids = widgetFontOptions.map(([id])=>id);
  assert.equal(ids.length,9);
  for (const [old,current] of [['system','manrope'],['mono','jetbrains-mono'],['serif','roboto-slab']]) {
    assert.ok(!ids.includes(old));
    assert.equal(resolveWidgetFont(old),current);
    assert.equal(widgetFontFamily(old),widgetFontFamily(current));
  }
});
