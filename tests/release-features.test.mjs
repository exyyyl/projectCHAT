import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('unfinished contest widget is only exposed in development', async () => {
  const [features, widgets] = await Promise.all([
    readFile('ui/panel/src/domain/release-features.ts', 'utf8'),
    readFile('ui/panel/src/components/widget-page.tsx', 'utf8'),
  ]);
  assert.match(features, /SHOW_CONTEST_WIDGET\s*=\s*import\.meta\.env\.DEV/u);
  assert.match(widgets, /SHOW_CONTEST_WIDGET/u);
});
