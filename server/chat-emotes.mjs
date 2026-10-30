const codeIsValid = code => typeof code === 'string' && code.length > 0 && code.length <= 100 && !/[\s\p{Cc}\p{Cf}]/u.test(code);
export const twitchEmoteUrl = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id) ? `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0` : '';

// EventSub fragments use strings; walking them preserves UTF-16 offsets after emoji.
export function twitchEmoteSpans(message) {
  if (typeof message?.text !== 'string' || !Array.isArray(message.fragments) || message.fragments.length > 500) return [];
  let offset = 0;
  const spans = [];
  for (const fragment of message.fragments) {
    if (typeof fragment?.text !== 'string' || message.text.slice(offset, offset + fragment.text.length) !== fragment.text) return [];
    if (fragment.type === 'emote' && fragment.text.length && twitchEmoteUrl(fragment.emote?.id)) spans.push({ start: offset, end: offset + fragment.text.length, id: fragment.emote.id });
    offset += fragment.text.length;
  }
  return offset === message.text.length ? spans : [];
}

export function validEmoteSpans(spans, text) {
  let end = 0;
  return (Array.isArray(spans) ? spans : []).slice(0, 250).filter(span => {
    if (!Number.isSafeInteger(span?.start) || !Number.isSafeInteger(span?.end) || span.start < end || span.end <= span.start || span.end > text.length || !twitchEmoteUrl(span.id)) return false;
    end = span.end;
    return true;
  }).map(({ start, end, id }) => ({ start, end, id }));
}

export function nativeEmotes(data) {
  return (Array.isArray(data) ? data : []).slice(0, 10000).flatMap(emote => {
    const url = twitchEmoteUrl(emote?.id);
    return url && codeIsValid(emote.name) ? [{ id: emote.id, code: emote.name, url, provider: 'twitch' }] : [];
  });
}
function bttvEmotes(data) {
  return (Array.isArray(data) ? data : []).slice(0, 5000).flatMap(emote => {
    if (!/^[a-f0-9]{24}$/i.test(emote?.id) || !codeIsValid(emote.code) || emote.modifier) return [];
    return [{ id: emote.id, code: emote.code, url: `https://cdn.betterttv.net/emote/${emote.id}/2x`, provider: 'bttv' }];
  });
}
function sevenEmotes(data) {
  return (Array.isArray(data) ? data : []).slice(0, 5000).flatMap(emote => {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(emote?.id) || !codeIsValid(emote.name)) return [];
    const host = emote.data?.host;
    // Never trust an arbitrary host supplied by an external catalog.
    const base = typeof host?.url === 'string' && host.url.startsWith('//') ? `https:${host.url}` : host?.url;
    if (typeof base !== 'string' || !/^https:\/\/cdn\.7tv\.app\/emote\/[A-Za-z0-9_-]+$/.test(base)) return [];
    const files = Array.isArray(host.files) ? host.files : [];
    const file = files.find(file => file?.name === '2x.webp') || files.find(file => file?.name === '1x.webp');
    if (!file) return [];
    return [{ id: emote.id, code: emote.name, url: `${base}/${file.name}`, provider: '7tv' }];
  });
}

function ffzEmotes(data) {
  const sets = data?.sets && typeof data.sets === 'object' ? data.sets : {};
  const ids = Array.isArray(data?.default_sets) ? data.default_sets : Object.keys(sets);
  return ids.flatMap(id => Array.isArray(sets[id]?.emoticons) ? sets[id].emoticons : []).slice(0, 5000).flatMap(emote => {
    if (!Number.isSafeInteger(emote?.id) || emote.id < 1 || !codeIsValid(emote.name) || emote.modifier) return [];
    const url = emote.animated?.['2'] || emote.urls?.['2'] || emote.urls?.['1'];
    const image = typeof url === 'string' && url.startsWith('//') ? `https:${url}` : url;
    if (typeof image !== 'string' || !/^https:\/\/cdn\.frankerfacez\.com\/emote\/[0-9]+\/[124](?:\.(?:gif|webp|png))?$/.test(image)) return [];
    return [{ id: String(emote.id), code: emote.name, url: image, provider: 'ffz' }];
  });
}

export function createChatEmotes({ twitch, fetcher = fetch, now = Date.now } = {}) {
  let cached = null;
  const pending = new Map();
  async function get(url) {
    const response = await fetcher(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Каталог временно недоступен.');
    return response.json();
  }
  return {
    async catalog() {
      const state = twitch.snapshot();
      if (!/^[0-9]{1,30}$/.test(state.userId)) return { channelId: '', emotes: [], unavailable: [], requiresReconnect: false };
      const key = `${state.userId}:${Boolean(state.canReadEmotes)}`;
      if (cached?.key === key && cached.expiresAt > now()) return cached.data;
      if (pending.has(key)) return pending.get(key);
      const task = (async () => {
        const results = await Promise.allSettled([
          twitch.emotes(),
          get('https://7tv.io/v3/emote-sets/global').then(data => sevenEmotes(data?.emotes)),
          get(`https://7tv.io/v3/users/twitch/${state.userId}`).then(data => sevenEmotes(data?.emote_set?.emotes)),
          get('https://api.betterttv.net/3/cached/emotes/global').then(bttvEmotes),
          get(`https://api.betterttv.net/3/cached/users/twitch/${state.userId}`).then(data => bttvEmotes([...(data?.sharedEmotes || []), ...(data?.channelEmotes || [])])),
          get('https://api.frankerfacez.com/v1/set/global').then(ffzEmotes),
          get(`https://api.frankerfacez.com/v1/room/id/${state.userId}`).then(ffzEmotes),
        ]);
        const providers = ['twitch', '7tv', '7tv', 'bttv', 'bttv', 'ffz', 'ffz'];
        const unavailable = [...new Set(results.flatMap((result, index) => result.status === 'rejected' ? [providers[index]] : []))];
        const byCode = new Map();
        for (const [index, result] of results.entries()) {
          if (result.status !== 'fulfilled') continue;
          for (const emote of index === 0 ? result.value.emotes : result.value) byCode.set(`${emote.provider}:${emote.code}`, { ...emote, scope: [2, 4, 6].includes(index) ? 'channel' : 'global' });
        }
        const data = { channelId: state.userId, emotes: [...byCode.values()], unavailable, requiresReconnect: results[0].status === 'fulfilled' ? results[0].value.requiresReconnect : !state.canReadEmotes };
        if (twitch.snapshot().userId === state.userId) cached = { key, expiresAt: now() + (unavailable.length ? 30_000 : 300_000), data };
        return data;
      })();
      pending.set(key, task);
      try { return await task; } finally { pending.delete(key); }
    },
  };
}
