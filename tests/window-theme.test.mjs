import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { windowThemes } from '../desktop/window-theme.mjs';

test('Windows caption buttons use the exact shell colors in every theme', async () => {
  const css = await readFile(new URL('../ui/panel/src/index.css', import.meta.url), 'utf8');
  for (const [name, overlay] of Object.entries(windowThemes)) {
    const selector = name === 'lime' ? '.dark' : `.dark.theme-${name}`;
    const block = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
    assert.equal(overlay.color, block.match(/--background:\s*(#[\da-f]+);/u)[1], `${name} background`);
    assert.equal(overlay.symbolColor, block.match(/--foreground:\s*(#[\da-f]+);/u)[1], `${name} symbols`);
  }
});
