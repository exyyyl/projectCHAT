import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesktopIpcHandler, isTrustedDesktopSender, isTrustedPanelUrl } from '../desktop/security.mjs';

const panelUrl = 'http://127.0.0.1:4317/';

test('panel navigation requires exact origin, path and query, while allowing UI hashes', () => {
  for (const url of [panelUrl, `${panelUrl}#templates`, 'http://127.0.0.1:4317']) assert.equal(isTrustedPanelUrl(url, panelUrl), true, url);
  for (const url of [
    'http://127.0.0.1:43170/', 'http://127.0.0.1:4317@evil.example/',
    'http://127.0.0.1:4317.evil.example/', 'http://evil.example/',
    'http://localhost:4317/', 'http://user:pass@127.0.0.1:4317/',
    'http://127.0.0.1:4317/overlay', 'http://127.0.0.1:4317/?redirect=evil',
    'https://127.0.0.1:4317/', 'file:///tmp/panel.html', 'javascript:alert(1)', 'not a URL',
  ]) assert.equal(isTrustedPanelUrl(url, panelUrl), false, url);
  assert.equal(isTrustedPanelUrl('http://127.0.0.1:5174/#polls', 'http://127.0.0.1:5174/'), true);
  assert.equal(isTrustedPanelUrl(panelUrl, 'http://127.0.0.1:5174/'), false);
  assert.equal(isTrustedPanelUrl('http://user@127.0.0.1:4317/', 'http://user@127.0.0.1:4317/'), false);
});

test('IPC trusts only the live panel main frame, including after navigation', async () => {
  const frame = { url: panelUrl };
  const contents = { mainFrame: frame };
  let destroyed = false;
  const window = { webContents: contents, isDestroyed: () => destroyed };
  const event = { sender: contents, senderFrame: frame };
  let calls = 0;
  const handler = createDesktopIpcHandler(() => window, panelUrl)(value => { calls++; return value; });
  assert.equal(await handler(event, 'accepted'), 'accepted');
  for (const untrusted of [
    { ...event, sender: {} }, { ...event, senderFrame: { url: panelUrl } },
    { ...event, senderFrame: null }, {},
  ]) await assert.rejects(handler(untrusted), /Недоверенный/);
  frame.url = 'https://evil.example/';
  await assert.rejects(handler(event), /Недоверенный/);
  frame.url = panelUrl;
  destroyed = true;
  await assert.rejects(handler(event), /Недоверенный/);
  assert.equal(calls, 1);
  assert.equal(isTrustedDesktopSender(event, undefined, panelUrl), false);
  assert.equal(isTrustedDesktopSender({ get sender() { throw new Error('Frame disposed'); } }, { ...window, isDestroyed: () => false }, panelUrl), false);
});
