import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PollError } from './polls.mjs';

const AUTH = 'https://id.twitch.tv/oauth2/';
const SOCKET = 'wss://eventsub.wss.twitch.tv/ws';
const SCOPE = 'user:read:chat';
const pauseError = () => new PollError('Подключение отменено.', 409);

export function chatVote(message, poll, userId) {
  const event = message?.payload?.event;
  if (message?.metadata?.message_type !== 'notification' || message.payload?.subscription?.type !== 'channel.chat.message' || !event || poll?.status !== 'running' || poll.source !== 'twitch') return null;
  if (event.broadcaster_user_id !== userId || poll.broadcasterId !== userId) return null;
  // Shared Chat messages from another channel do not participate in this channel's poll.
  if (event.source_broadcaster_user_id && event.source_broadcaster_user_id !== userId) return null;
  const sentAt = Date.parse(message.metadata.message_timestamp);
  if (!Number.isFinite(sentAt) || sentAt < poll.startedAt || sentAt >= poll.deadline) return null;
  if (typeof event.chatter_user_id !== 'string' || typeof event.message_id !== 'string' || typeof event.message?.text !== 'string') return null;
  const rawName = typeof event.chatter_user_name === 'string' ? event.chatter_user_name : event.chatter_user_login;
  if (typeof rawName !== 'string') return null;
  const viewerName = rawName.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 50);
  if (!viewerName) return null;
  return { type: 'vote', source: 'twitch', pollId: poll.id, broadcasterId: userId, sentAt, viewerId: `twitch:${event.chatter_user_id}`, viewerName, eventId: event.message_id, message: event.message.text };
}

export async function createTwitch({ filename, store, clientId, fetcher = fetch, Socket = WebSocket, now = Date.now, later = setTimeout, cancel = clearTimeout }) {
  if (typeof clientId !== 'string' || !/^[a-zA-Z0-9]{10,100}$/.test(clientId)) throw new Error('Не настроен Client ID приложения Twitch.');
  let credentials = {}, status = { phase: 'disconnected', login: '', displayName: '', profileImageUrl: '', userId: '', error: '', device: null, lastGapAt: null };
  let epoch = 0, stopped = false, timer, maintenance, retry, retryCount = 0;
  let pending = null, currentSocket = null, work = Promise.resolve(), disk = Promise.resolve();
  const sockets = new Set(), listeners = new Set();
  const avatarCache = new Map(), avatarQueue = new Map();
  let avatarTimer = null;
  try {
    const saved = JSON.parse(await readFile(filename, 'utf8'));
    if (saved.accessToken && (typeof saved.accessToken !== 'string' || typeof saved.refreshToken !== 'string')) throw new Error('invalid');
    if (saved.clientId && saved.clientId !== clientId) {
      status.error = 'Приложение Twitch обновилось. Подключите аккаунт заново.';
    } else {
      const { accessToken, refreshToken, expiresAt } = saved;
      credentials = accessToken ? { accessToken, refreshToken, expiresAt } : {};
    }
  } catch (error) { if (error.code !== 'ENOENT') status.error = 'Не удалось прочитать вход Twitch. Подключите аккаунт заново.'; }
  const snapshot = () => structuredClone(status);
  const update = data => { status = { ...status, ...data }; for (const fn of listeners) { try { fn(snapshot()); } catch {} } };
  const persist = () => {
    const data = JSON.stringify(credentials, null, 2);
    const task = disk.then(async () => { await mkdir(dirname(filename), { recursive: true }); await writeFile(`${filename}.tmp`, data, { mode: 0o600 }); await rename(`${filename}.tmp`, filename); });
    disk = task.catch(() => {}); return task;
  };
  const alive = version => !stopped && version === epoch;
  const ensure = version => { if (!alive(version)) throw pauseError(); };
  const serial = task => { const result = work.then(task); work = result.catch(() => {}); return result; };
  function reset() {
    epoch++; cancel(timer); cancel(maintenance); cancel(retry); cancel(avatarTimer); timer = maintenance = retry = avatarTimer = null;
    avatarQueue.clear();
    pending = null; currentSocket = null;
    for (const entry of [...sockets]) { sockets.delete(entry); cancel(entry.watchdog); entry.ws.close(); }
  }
  async function request(url, options = {}) {
    let response;
    try { response = await fetcher(url, { ...options, signal: AbortSignal.timeout(10000) }); }
    catch { throw new PollError('Нет связи с Twitch. Проверьте подключение к интернету.', 502); }
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      const error = new PollError(response.status === 401 || response.status === 403 ? 'Twitch отклонил доступ. Подключите аккаунт заново.' : 'Twitch отклонил запрос. Проверьте Client ID и тип Public.', response.status === 429 || response.status >= 500 ? 502 : 400);
      error.remoteStatus = response.status; error.code = data.message || data.error; throw error;
    }
    return data;
  }
  const avatarUrl = value => {
    if (typeof value !== 'string') return '';
    try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'static-cdn.jtvnw.net' && !url.port && !url.username && !url.password ? url.href : ''; }
    catch { return ''; }
  };
  async function flushAvatars(version) {
    avatarTimer = null;
    if (!alive(version) || avatarQueue.size === 0) return;
    const ids = [...avatarQueue.keys()].slice(0, 100);
    const entries = new Map(ids.map(id => [id, avatarQueue.get(id)]));
    for (const id of ids) avatarQueue.delete(id);
    try {
      const query = new URLSearchParams(ids.map(id => ['id', id]));
      const users = await request(`https://api.twitch.tv/helix/users?${query}`, { headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Client-Id': clientId } });
      if (!alive(version)) return;
      const profiles = new Map((Array.isArray(users.data) ? users.data : []).map(user => [user?.id, avatarUrl(user?.profile_image_url)]));
      for (const id of ids) {
        const image = profiles.get(id) || '';
        avatarCache.set(id, image);
        if (!image) continue;
        for (const entry of entries.get(id) || []) {
          try { await store.command({ type: 'activity-avatar', pollId: entry.pollId, eventId: entry.eventId, avatarUrl: image }); }
          catch { /* the poll or feed entry may already have changed */ }
        }
      }
    } catch { /* avatar loading must never interrupt chat voting */ }
    if (alive(version) && avatarQueue.size > 0 && !avatarTimer) avatarTimer = later(() => flushAvatars(version), 75);
  }
  async function queueAvatar(userId, pollId, eventId, version) {
    if (avatarCache.has(userId)) {
      const image = avatarCache.get(userId);
      if (image) {
        try { await store.command({ type: 'activity-avatar', pollId, eventId, avatarUrl: image }); }
        catch { /* the poll or feed entry may already have changed */ }
      }
      return;
    }
    const entries = avatarQueue.get(userId) || [];
    entries.push({ pollId, eventId }); avatarQueue.set(userId, entries);
    if (!avatarTimer) avatarTimer = later(() => flushAvatars(version), 75);
  }
  const form = (path, values) => request(AUTH + path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values) });
  async function saveTokens(tokens, version) {
    ensure(version);
    if (!tokens.access_token || !tokens.refresh_token || !Number.isFinite(tokens.expires_in)) throw new PollError('Twitch вернул неполный ответ. Повторите вход.', 502);
    credentials = { ...credentials, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: now() + tokens.expires_in * 1000 };
    await persist(); ensure(version);
  }
  async function refresh(version) {
    const tokens = await form('token', { client_id: clientId, grant_type: 'refresh_token', refresh_token: credentials.refreshToken });
    await saveTokens(tokens, version);
  }
  async function validate(version) {
    let account;
    try { account = await request(AUTH + 'validate', { headers: { Authorization: `OAuth ${credentials.accessToken}` } }); }
    catch (error) { ensure(version); if (error.remoteStatus !== 401) throw error; await refresh(version); account = await request(AUTH + 'validate', { headers: { Authorization: `OAuth ${credentials.accessToken}` } }); }
    ensure(version);
    if (account.client_id !== clientId || !account.scopes?.includes(SCOPE) || !account.user_id || !account.login) throw new PollError('Нужен вход с доступом к чтению чата.', 401);
    let profile;
    try {
      const users = await request(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(account.user_id)}`, {
        headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Client-Id': clientId },
      });
      ensure(version);
      profile = Array.isArray(users.data) ? users.data.find(user => user?.id === account.user_id) : null;
    } catch { ensure(version); }
    const image = typeof profile?.profile_image_url === 'string' && profile.profile_image_url.startsWith('https://') ? profile.profile_image_url : '';
    update({ userId: account.user_id, login: account.login, displayName: typeof profile?.display_name === 'string' ? profile.display_name : account.login, profileImageUrl: image });
    if (account.expires_in < 300) await refresh(version);
    cancel(maintenance);
    maintenance = later(() => serial(async () => {
      if (!alive(version)) return;
      try { await validate(version); }
      catch (error) { if (alive(version)) failure(error); }
    }), Math.max(1000, Math.min(3600000, (account.expires_in - 120) * 1000)));
  }
  function failure(error) {
    if (error.status === 502) { scheduleRetry(error.message); return; }
    reset(); update({ phase: 'error', device: null, error: error.message || 'Не удалось подключить Twitch.' });
  }
  function scheduleRetry(message = 'Связь с Twitch прервалась. Переподключение…') {
    if (retry || stopped || !credentials.accessToken) return;
    for (const entry of [...sockets]) { sockets.delete(entry); cancel(entry.watchdog); entry.ws.close(); } currentSocket = null;
    update({ phase: 'reconnecting', error: message, lastGapAt: now() });
    const version = epoch;
    retry = later(() => { retry = null; return serial(async () => {
      if (!alive(version)) return;
      try { await validate(version); ensure(version); openSocket(SOCKET, version); }
      catch (error) { if (alive(version)) failure(error); }
    }); }, Math.min(30000, 1000 * 2 ** Math.min(retryCount++, 5)));
  }
  function openSocket(url, version, previous = null) {
    ensure(version);
    const parsed = new URL(url);
    if (parsed.protocol !== 'wss:' || parsed.hostname !== 'eventsub.wss.twitch.tv' || parsed.port || parsed.username || parsed.password) throw new PollError('Некорректный адрес переподключения Twitch.', 502);
    const entry = { ws: new Socket(url), watchdog: null, timeout: 15000, welcomed: false, migrating: false };
    sockets.add(entry);
    const valid = () => alive(version) && sockets.has(entry);
    const watch = () => { cancel(entry.watchdog); entry.watchdog = later(() => { if (valid()) scheduleRetry(); }, entry.timeout); };
    watch();
    entry.ws.addEventListener('close', () => { cancel(entry.watchdog); if (valid()) scheduleRetry(); });
    entry.ws.addEventListener('error', () => { if (valid()) scheduleRetry(); });
    entry.ws.addEventListener('message', async event => {
      if (!valid()) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      watch();
      try {
        switch (message.metadata?.message_type) {
          case 'session_welcome': {
            if (entry.welcomed) break;
            entry.welcomed = true;
            const session = message.payload?.session;
            if (!session?.id) throw new PollError('Неполный ответ Twitch.', 502);
            entry.timeout = (session.keepalive_timeout_seconds || 30) * 1000 + 1000; watch();
            if (!previous) {
              await request('https://api.twitch.tv/helix/eventsub/subscriptions', {
                method: 'POST', headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Client-Id': clientId, 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'channel.chat.message', version: '1', condition: { broadcaster_user_id: status.userId, user_id: status.userId }, transport: { method: 'websocket', session_id: session.id } }),
              });
            }
            if (!valid()) return;
            currentSocket = entry;
            if (previous) { sockets.delete(previous); cancel(previous.watchdog); previous.ws.close(); }
            retryCount = 0; update({ phase: 'connected', error: '', device: null }); break;
          }
          case 'notification': {
            const vote = chatVote(message, store.snapshot().poll, status.userId);
            if (vote) {
              const result = await store.command(vote);
              if (result.outcome === 'counted' || result.outcome === 'changed') await queueAvatar(message.payload.event.chatter_user_id, vote.pollId, vote.eventId, version);
            }
            break;
          }
          case 'session_reconnect':
            if (entry === currentSocket && !entry.migrating) { entry.migrating = true; openSocket(message.payload.session.reconnect_url, version, entry); }
            break;
          case 'revocation': failure(new PollError('Доступ к чату отозван. Подключите Twitch заново.', 401)); break;
        }
      } catch (error) { if (valid()) failure(error.status ? error : new PollError('Не удалось обработать сообщение Twitch. Проверьте папку data.', 500)); }
    });
  }
  async function pollDevice(version) {
    if (!alive(version) || !pending) return;
    if (now() >= pending.expiresAt) { pending = null; update({ phase: 'error', device: null, error: 'Код истёк. Повторите подключение.' }); return; }
    try {
      const tokens = await form('token', { client_id: clientId, scopes: SCOPE, device_code: pending.code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
      await saveTokens(tokens, version); pending = null;
      update({ phase: 'connecting', device: null, error: '' });
      await validate(version); ensure(version); openSocket(SOCKET, version);
    } catch (error) {
      if (!alive(version)) return;
      if (pending && (error.code === 'authorization_pending' || error.code === 'slow_down' || error.status === 502)) {
        if (error.code === 'slow_down') pending.interval += 5000;
        timer = later(() => serial(() => pollDevice(version)), pending.interval);
      } else failure(error);
    }
  }
  return {
    snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    start() { return serial(async () => {
      if (!credentials.accessToken || stopped) return;
      const version = epoch; update({ phase: 'connecting', error: '' });
      try { await validate(version); ensure(version); openSocket(SOCKET, version); } catch (error) { if (alive(version)) failure(error); }
    }); },
    command(command) { return serial(async () => {
      if (command.type === 'disconnect') {
        reset(); credentials = {}; await persist();
        update({ phase: 'disconnected', userId: '', login: '', displayName: '', profileImageUrl: '', device: null, error: '', lastGapAt: null });
      } else if (command.type === 'connect') {
        reset(); const version = epoch;
        credentials = {}; await persist();
        update({ phase: 'connecting', userId: '', login: '', displayName: '', profileImageUrl: '', device: null, error: '', lastGapAt: null });
        try {
          const device = await form('device', { client_id: clientId, scopes: SCOPE }); ensure(version);
          const uri = new URL(device.verification_uri);
          if (uri.protocol !== 'https:' || !['www.twitch.tv', 'twitch.tv'].includes(uri.hostname) || uri.port || uri.username || uri.password || !device.device_code || !device.user_code || !(device.expires_in > 0)) throw new PollError('Некорректный ответ Twitch. Повторите подключение.', 502);
          pending = { code: device.device_code, expiresAt: now() + device.expires_in * 1000, interval: Math.max(5000, Number(device.interval || 5) * 1000) };
          update({ phase: 'authorizing', device: { code: device.user_code, url: uri.href, expiresAt: pending.expiresAt } });
          timer = later(() => serial(() => pollDevice(version)), pending.interval);
        } catch (error) { if (alive(version)) update({ phase: 'error', error: error.message, device: null }); throw error; }
      } else throw new PollError('Неизвестная команда Twitch.');
      return snapshot();
    }); },
    async close() { stopped = true; reset(); await work; await disk; },
  };
}
