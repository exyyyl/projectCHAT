import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { windowThemes } from '../desktop/window-theme.mjs';
import { appThemes, isAppTheme } from '../ui/panel/src/domain/app-themes.ts';

test('every selectable theme is recognized by the saved preference and native window', () => {
  assert.deepEqual(new Set(appThemes.map(theme => theme.id)), new Set(Object.keys(windowThemes)));
  for (const { id } of appThemes) assert.equal(isAppTheme(id), true);
  for (const unknown of [null, undefined, '', 'light', 'ROSE', {}]) assert.equal(isAppTheme(unknown), false);
});

test('Windows caption buttons use the exact shell colors in every theme', async () => {
  const css = await readFile(new URL('../ui/panel/src/index.css', import.meta.url), 'utf8');
  for (const [name, overlay] of Object.entries(windowThemes)) {
    const selector = name === 'lime' ? '.dark' : `.dark.theme-${name}`;
    const block = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
    assert.equal(overlay.color, block.match(/--background:\s*(#[\da-f]+);/u)[1], `${name} background`);
    assert.equal(overlay.symbolColor, block.match(/--foreground:\s*(#[\da-f]+);/u)[1], `${name} symbols`);
  }
});

test('theme text, secondary labels and primary actions retain readable contrast', async () => {
  const css = await readFile(new URL('../ui/panel/src/index.css', import.meta.url), 'utf8');
  const luminance = hex => {
    const channels = hex.match(/[\da-f]{2}/gi).map(channel => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const contrast = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((a, b) => b - a);
    return (light + 0.05) / (dark + 0.05);
  };
  for (const { id } of appThemes) {
    const selector = id === 'lime' ? '.dark' : `.dark.theme-${id}`;
    const block = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
    const color = token => block.match(new RegExp(`--${token}:\\s*(#[\\da-f]+);`, 'u'))[1];
    for (const surface of ['background', 'panel', 'card']) {
      assert.ok(contrast(color('foreground'), color(surface)) >= 4.5, `${id} text on ${surface}`);
      assert.ok(contrast(color('muted-foreground'), color(surface)) >= 4.5, `${id} secondary text on ${surface}`);
    }
    assert.ok(contrast(color('primary'), color('primary-foreground')) >= 4.5, `${id} primary button text`);
  }
});
