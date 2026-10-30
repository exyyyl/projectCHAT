import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatEmotes, nativeEmotes, twitchEmoteSpans } from '../server/chat-emotes.mjs';
import { emoteLookup, insertEmote, messageParts } from '../ui/panel/src/domain/chat-emotes.ts';

const seven = (name, id = '01FGH8NE3800064MEQW00DNBNG', host = `//cdn.7tv.app/emote/${id}`) => ({ id, name, data: { host: { url: host, files: [{ name: '2x.webp' }] } } });
const bttv = (code, id = '54fa8f1401e468494b85b537') => ({ id, code });
const native = nativeEmotes([{ id: '25', name: 'Kappa' }]);
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
function fixture(overrides = {}) {
  let time = 1000;
  let state = { userId: '123', canReadEmotes: true };
  const calls = [];
  const twitch = { snapshot: () => state, emotes: async () => ({ emotes: native, requiresReconnect: false }) };
  const catalog = createChatEmotes({ twitch, now: () => time, fetcher: async (url, options) => {
    calls.push({ url, options });
    if (overrides[url]) return overrides[url]();
    if (url.includes('7tv.io') && url.endsWith('/global')) return json({ emotes: [seven('GLOBAL'), seven('ALIAS', 'global-id')] });
    if (url.includes('7tv.io')) return json({ emote_set: { emotes: [seven('ALIAS', 'channel-id'), seven('UNSAFE', 'x', '//evil.test/emote/x')] } });
    if (url.endsWith('/global')) return json([bttv('FeelsGoodMan'), bttv('ignored', '../evil'), { ...bttv('modifier'), modifier: true }]);
    return json({ channelEmotes: [bttv('Channel')], sharedEmotes: [bttv('Shared')] });
  } });
  return { catalog, calls, setState: value => { state = value; }, advance: value => { time += value; } };
}

test('catalog merges global/channel emotes, preserves aliases, restricts URLs, caches and shares in-flight requests', async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.catalog.catalog(), f.catalog.catalog()]);
  assert.equal(a, b);
  assert.equal(f.calls.length, 6);
  assert.deepEqual(a.unavailable, []);
  assert.deepEqual(a.emotes.map(emote => emote.code), ['Kappa', 'GLOBAL', 'ALIAS', 'FeelsGoodMan', 'Shared', 'Channel']);
  assert.equal(a.emotes.find(emote => emote.code === 'ALIAS').id, 'channel-id');
  for (const emote of a.emotes) assert.ok(['static-cdn.jtvnw.net', 'cdn.7tv.app', 'cdn.betterttv.net'].includes(new URL(emote.url).hostname));
  for (const { options } of f.calls) assert.equal(options.headers, undefined, 'third-party requests never receive Twitch tokens');
  await f.catalog.catalog(); assert.equal(f.calls.length, 6);
  f.advance(300_001); await f.catalog.catalog(); assert.equal(f.calls.length, 12);
  f.setState({ userId: '456', canReadEmotes: true });
  assert.equal((await f.catalog.catalog()).channelId, '456');
  assert.equal(f.calls.length, 18);
  f.setState({ userId: '../bad' });
  assert.deepEqual((await f.catalog.catalog()).emotes, []);
});

test('provider outage is isolated, retryable, and a missing channel is a normal empty catalog', async () => {
  const f = fixture({
    'https://7tv.io/v3/emote-sets/global': () => { throw new Error('offline'); },
    'https://7tv.io/v3/users/twitch/123': () => json({}, 404),
  });
  const result = await f.catalog.catalog();
  assert.deepEqual(result.unavailable, ['7tv']);
  assert.ok(result.emotes.some(emote => emote.provider === 'bttv'));
  assert.ok(result.emotes.some(emote => emote.provider === 'twitch'));
  f.advance(30_001); await f.catalog.catalog(); assert.equal(f.calls.length, 12);
});

test('native fragments keep exact IDs and UTF-16 offsets, while malformed fragments stay text', () => {
  const message = { text: '👋 Kappa!', fragments: [{ type: 'text', text: '👋 ' }, { type: 'emote', text: 'Kappa', emote: { id: '25' } }, { type: 'text', text: '!' }] };
  assert.deepEqual(twitchEmoteSpans(message), [{ start: 3, end: 8, id: '25' }]);
  assert.deepEqual(twitchEmoteSpans({ ...message, text: 'Different' }), []);
  message.fragments[1].emote.id = '../script';
  assert.deepEqual(twitchEmoteSpans(message), []);
});

test('rendering respects whole case-sensitive codes and authoritative native fragments without HTML parsing', () => {
  const lookup = emoteLookup([...native, { id: 'other', code: 'Kappa', provider: '7tv', url: 'https://cdn.7tv.app/emote/other/2x.webp' }, { id: 'pepe', code: 'pepe', provider: 'bttv', url: 'https://cdn.betterttv.net/emote/pepe/2x' }]);
  const parts = messageParts('<script> Kappa notKappa kappa\npepe 😀', [{ start: 9, end: 14, id: '25' }], lookup);
  assert.equal(parts.map(part => part.text).join(''), '<script> Kappa notKappa kappa\npepe 😀');
  assert.equal(parts.filter(part => part.url).length, 2);
  assert.match(parts.find(part => part.text === 'Kappa').url, /jtvnw/);
  const precise = messageParts('👋 Kappa!', [{ start: 3, end: 8, id: 'emotesv2_actual' }], lookup);
  assert.equal(precise[1].url, 'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_actual/default/dark/2.0');
  assert.equal(messageParts('hello', [{ start: 0, end: 5, id: '../bad' }], lookup)[0].url, undefined);
});

test('picker insertion replaces selection, preserves caret and spaces, and enforces the send limit', () => {
  assert.deepEqual(insertEmote('', 'Kappa', 0, 0), { text: 'Kappa ', caret: 6 });
  assert.deepEqual(insertEmote('hiworld', 'Kappa', 2, 2), { text: 'hi Kappa world', caret: 9 });
  assert.deepEqual(insertEmote('hi old there', 'Kappa', 3, 6), { text: 'hi Kappa there', caret: 8 });
  assert.equal(insertEmote('x'.repeat(500), 'Kappa', 500, 500), null);
  assert.equal(insertEmote('x'.repeat(500), 'Kappa', 0, 500).text, 'Kappa ');
});

test('BibleThump uses the chosen provider, channel aliases override globals, and exact Twitch IDs always win', () => {
  const global = [
    { id: 'seasonal', code: 'BibleThump', provider: '7tv', scope: 'global', url: 'https://cdn.7tv.app/emote/seasonal/2x.webp' },
    { id: '757384', code: 'BibleThump', provider: 'ffz', scope: 'global', url: 'https://cdn.frankerfacez.com/emote/757384/2' },
  ];
  assert.match(messageParts('BibleThump', [], emoteLookup(global))[0].url, /frankerfacez/);
  assert.match(messageParts('BibleThump', [], emoteLookup(global, '7tv'))[0].url, /7tv/);
  const lookup = emoteLookup([...global, { id: 'custom', code: 'BibleThump', provider: 'bttv', scope: 'channel', url: 'https://cdn.betterttv.net/emote/custom/2x' }]);
  assert.match(lookup.get('BibleThump').url, /betterttv/);
  assert.match(messageParts('BibleThump', [{ start: 0, end: 10, id: '86' }], lookup)[0].url, /jtvnw.*\/86\//);
  assert.equal(messageParts('Kappa', [], emoteLookup(native))[0].url, undefined, 'an ordinary code must not be guessed as a subscriber emote when Twitch supplied no emote fragment');
});

test('FFZ assets only use its CDN and the default global sets', async () => {
  const f = fixture({
    'https://api.frankerfacez.com/v1/set/global': () => json({ default_sets: [1], sets: {
      1: { emoticons: [{ id: 757384, name: 'BibleThump', urls: { 2: 'https://cdn.frankerfacez.com/emote/757384/2' } }, { id: 1, name: 'unsafe', urls: { 2: 'https://evil.test/pixel' } }] },
      2: { emoticons: [{ id: 2, name: 'notGlobal', urls: { 2: 'https://cdn.frankerfacez.com/emote/2/2' } }] },
    } }),
  });
  const catalog = await f.catalog.catalog();
  assert.deepEqual(catalog.emotes.filter(emote => emote.provider === 'ffz').map(emote => emote.code), ['BibleThump']);
});
