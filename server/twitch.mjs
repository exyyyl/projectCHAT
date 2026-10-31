import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PollError } from './polls.mjs';
import { nativeEmotes, twitchEmoteSpans } from './chat-emotes.mjs';

const AUTH = 'https://id.twitch.tv/oauth2/';
const SOCKET = 'wss://eventsub.wss.twitch.tv/ws';
const READ_SCOPE = 'user:read:chat';
const WRITE_SCOPE = 'user:write:chat';
const SHOUTOUT_SCOPE = 'moderator:read:shoutouts';
const EMOTE_SCOPE = 'user:read:emotes';
const DELETE_SCOPE = 'moderator:manage:chat_messages';
const TIMEOUT_SCOPE = 'moderator:manage:banned_users';
const SCOPE = `${READ_SCOPE} ${WRITE_SCOPE} ${SHOUTOUT_SCOPE} ${EMOTE_SCOPE} ${DELETE_SCOPE} ${TIMEOUT_SCOPE}`;
const pauseError = () => new PollError('Подключение отменено.', 409);
const chatColor = value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '';
const cleanChatText = value => typeof value === 'string' ? value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 500) : '';
const cleanChatName = value => cleanChatText(value).slice(0, 50);
const countLabel = (count, forms) => {
  const n = Math.max(0, count);
  const form = n % 10 === 1 && n % 100 !== 11 ? forms[0] : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? forms[1] : forms[2];
  return `${n} ${form}`;
};
const chatBadges = value => (Array.isArray(value) ? value : []).slice(0, 20)
  .filter(badge => typeof badge?.set_id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(badge.set_id)
    && typeof badge?.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(badge.id))
  .map(badge => ({ setId: badge.set_id, id: badge.id }));

export function chatVote(message, poll, userId) {
  const event = message?.payload?.event;
  if (message?.metadata?.message_type !== 'notification' || message.payload?.subscription?.type !== 'channel.chat.message' || !event || poll?.status !== 'running' || poll.source !== 'twitch') return null;
  if (event.broadcaster_user_id !== userId || poll.broadcasterId !== userId) return null;
  // Shared Chat messages from another channel do not participate in this channel's poll.
  if (event.source_broadcaster_user_id && event.source_broadcaster_user_id !== userId) return null;
  const sentAt = Date.parse(message.metadata.message_timestamp);
  if (!Number.isFinite(sentAt) || sentAt < poll.startedAt || sentAt >= poll.deadline) return null;
  if (typeof event.chatter_user_id !== 'string' || typeof event.message_id !== 'string' || typeof event.message?.text !== 'string') return null;
  const viewerId = `twitch:${event.chatter_user_id}`;
  // Keep rejected input inside this notification, within the vote store's bounds.
  if (!event.chatter_user_id || viewerId.length > 128 || !event.message_id || event.message_id.length > 128 || event.message.text.length > 500) return null;
  const rawName = typeof event.chatter_user_name === 'string' ? event.chatter_user_name : event.chatter_user_login;
  if (typeof rawName !== 'string') return null;
  const viewerName = rawName.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 50);
  if (!viewerName) return null;
  return { type: 'vote', source: 'twitch', pollId: poll.id, broadcasterId: userId, sentAt, viewerId, viewerName, eventId: event.message_id, message: event.message.text };
}

export function chatMessage(message, userId) {
  const event = message?.payload?.event;
  if (message?.metadata?.message_type !== 'notification' || message.payload?.subscription?.type !== 'channel.chat.message' || !event) return null;
  if (event.broadcaster_user_id !== userId) return null;
  if (event.source_broadcaster_user_id && event.source_broadcaster_user_id !== userId) return null;
  const sentAt = Date.parse(message.metadata.message_timestamp);
  if (!Number.isFinite(sentAt) || typeof event.chatter_user_id !== 'string' || typeof event.message_id !== 'string' || typeof event.message?.text !== 'string') return null;
  const rawName = typeof event.chatter_user_name === 'string' ? event.chatter_user_name : event.chatter_user_login;
  if (typeof rawName !== 'string') return null;
  const viewerName = rawName.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 50);
  if (!viewerName) return null;
  const viewerLogin = typeof event.chatter_user_login === 'string'
    ? event.chatter_user_login.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 50)
    : viewerName;
  const badges = chatBadges(event.badges);
  const badgeSets = new Set((Array.isArray(event.badges) ? event.badges : [])
    .map(badge => badge?.set_id)
    .filter(value => typeof value === 'string'));
  const roles = [];
  if (badgeSets.has('subscriber') || badgeSets.has('founder')) roles.push('subscriber');
  if (badgeSets.has('vip')) roles.push('vip');
  if (badgeSets.has('moderator') || badgeSets.has('broadcaster')) roles.push('moderator');
  if (!roles.length) roles.push('viewer');
  const cheerBits = Number.isSafeInteger(event.cheer?.bits) && event.cheer.bits > 0 ? Math.min(event.cheer.bits, 1_000_000_000) : 0;
  return { broadcasterId: userId, viewerId: `twitch:${event.chatter_user_id}`, viewerName, viewerLogin, roles, badges, nameColor: chatColor(event.color), cheerBits, emotes: twitchEmoteSpans(event.message), eventId: event.message_id, text: event.message.text, sentAt };
}

export function chatActivity(message, userId) {
  const event = message?.payload?.event;
  if (message?.metadata?.message_type !== 'notification' || !event || !userId || event.broadcaster_user_id !== userId) return null;
  const type = message.payload?.subscription?.type;
  if (event.source_broadcaster_user_id && event.source_broadcaster_user_id !== userId) return null;
  const sentAt = Date.parse(message.metadata.message_timestamp);
  if (!Number.isFinite(sentAt)) return null;
  const notice = type === 'channel.chat.notification' ? event.notice_type : type;
  const named = (id, name, login) => ({
    viewerId: typeof id === 'string' && /^[0-9]{1,30}$/.test(id) ? `twitch:${id}` : 'system',
    viewerName: cleanChatName(name || login) || 'Анонимный зритель',
    viewerLogin: cleanChatName(login || name),
  });
  let actor, text, activityType;
  if (type === 'channel.chat.notification') {
    if (typeof event.message_id !== 'string' || !event.message_id) return null;
    actor = named(event.chatter_user_id, event.chatter_user_name, event.chatter_user_login);
    switch (notice) {
      case 'raid':
        actor = named(event.raid?.user_id, event.raid?.user_name, event.raid?.user_login);
        activityType = 'raid'; text = Number.isSafeInteger(event.raid?.viewer_count) ? `привёл ${countLabel(event.raid.viewer_count, ['зрителя', 'зрителей', 'зрителей'])}` : 'начал рейд'; break;
      case 'unraid': activityType = 'raid'; text = 'завершил рейд'; break;
      case 'sub': activityType = 'subscription'; text = 'оформил подписку'; break;
      case 'resub': activityType = 'subscription'; text = `продлил подписку${Number.isSafeInteger(event.resub?.cumulative_months) ? ` · ${event.resub.cumulative_months} мес.` : ''}`; break;
      case 'community_sub_gift': activityType = 'gift'; text = `подарил ${countLabel(Number.isSafeInteger(event.community_sub_gift?.total) ? event.community_sub_gift.total : 1, ['подписку', 'подписки', 'подписок'])}`; break;
      case 'sub_gift':
        if (event.sub_gift?.community_gift_id) return null;
        activityType = 'gift'; text = `подарил подписку${event.sub_gift?.recipient_user_name ? ` для ${cleanChatName(event.sub_gift.recipient_user_name)}` : ''}`; break;
      case 'gift_paid_upgrade': activityType = 'subscription'; text = 'продлил подаренную подписку'; break;
      case 'prime_paid_upgrade': activityType = 'subscription'; text = 'обновил подписку Prime'; break;
      case 'pay_it_forward': activityType = 'gift'; text = 'передал подписку дальше'; break;
      case 'announcement': activityType = 'announcement'; text = cleanChatText(event.message?.text) || 'отправил объявление'; break;
      case 'bits_badge_tier': activityType = 'milestone'; text = `получил значок за ${Number.isSafeInteger(event.bits_badge_tier?.tier) ? event.bits_badge_tier.tier : 0} Bits`; break;
      case 'watch_streak': activityType = 'milestone'; text = `смотрит стримы подряд: ${Number.isSafeInteger(event.watch_streak?.streak_count) ? event.watch_streak.streak_count : 0}`; break;
      case 'modiversary': activityType = 'milestone'; text = `модератор уже ${Number.isSafeInteger(event.modiversary?.months) ? event.modiversary.months : 0} мес.`; break;
      case 'charity_donation': activityType = 'charity'; text = `поддержал сбор${event.charity_donation?.charity_name ? ` «${cleanChatName(event.charity_donation.charity_name)}»` : ''}`; break;
      case 'gifted_drops_summary': activityType = 'gift'; text = `подарил Drops ${Number.isSafeInteger(event.gifted_drops_summary?.recipient_count) ? event.gifted_drops_summary.recipient_count : 0} зрителям`; break;
      default: return null;
    }
  } else if (type === 'channel.shoutout.create' || type === 'channel.shoutout.receive') {
    activityType = 'shoutout';
    if (type === 'channel.shoutout.create') {
      actor = named(event.to_broadcaster_user_id, event.to_broadcaster_user_name, event.to_broadcaster_user_login);
      text = 'получил шотаут';
    } else {
      actor = named(event.from_broadcaster_user_id, event.from_broadcaster_user_name, event.from_broadcaster_user_login);
      text = 'сделал шотаут вашему каналу';
    }
  } else return null;
  const rawId = type === 'channel.chat.notification' ? event.message_id : message.metadata.message_id;
  if (typeof rawId !== 'string' || !/^[A-Za-z0-9_-]{1,70}$/.test(rawId)) return null;
  return { broadcasterId: userId, ...actor, eventId: `activity:${rawId}`, kind: 'activity', activityType, roles: [], badges: [], nameColor: chatColor(event.color), text, sentAt };
}

export async function createTwitch({ filename, store, clientId, onChatMessage, onChatModeration, onError = () => {}, fetcher = fetch, Socket = WebSocket, now = Date.now, later = setTimeout, cancel = clearTimeout }) {
  if (typeof clientId !== 'string' || !/^[a-zA-Z0-9]{10,100}$/.test(clientId)) throw new Error('Не настроен Client ID приложения Twitch.');
  let credentials = {}, status = { phase: 'disconnected', login: '', displayName: '', profileImageUrl: '', userId: '', canSend: false, canShowShoutouts: false, canReadEmotes: false, canDeleteMessages: false, canTimeout: false, error: '', device: null, lastGapAt: null };
  let epoch = 0, stopped = false, timer, maintenance, retry, retryCount = 0;
  let pending = null, currentSocket = null, work = Promise.resolve(), disk = Promise.resolve();
  const sockets = new Set(), listeners = new Set();
  const avatarCache = new Map(), avatarQueue = new Map();
  let badgeCache = { channelId: '', expiresAt: 0, badges: {} }, badgeRequest = null;
  let streamCache = null, streamRequest = null;
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
    badgeCache = { channelId: '', expiresAt: 0, badges: {} }; badgeRequest = null;
    streamCache = streamRequest = null;
    pending = null; currentSocket = null;
    for (const entry of [...sockets]) { sockets.delete(entry); cancel(entry.watchdog); entry.ws.close(); }
  }
  async function request(url, options = {}) {
    let response;
    try { response = await fetcher(url, { ...options, signal: AbortSignal.timeout(10000) }); }
    catch (error) { onError(error); throw new PollError('Нет связи с Twitch. Проверьте подключение к интернету.', 502); }
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      const error = new PollError(response.status === 401 || response.status === 403 ? 'Twitch отклонил доступ. Подключите аккаунт заново.' : 'Twitch отклонил запрос. Проверьте Client ID и тип Public.', response.status === 429 || response.status >= 500 ? 502 : 400);
      error.remoteStatus = response.status; error.code = data.message || data.error;
      if (!['authorization_pending', 'slow_down'].includes(error.code)) onError(new Error(`Twitch HTTP ${response.status}: ${String(error.code || 'Запрос отклонён')}`));
      throw error;
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
    if (account.client_id !== clientId || !account.scopes?.includes(READ_SCOPE) || !account.user_id || !account.login) throw new PollError('Нужен вход с доступом к чтению чата.', 401);
    let profile;
    try {
      const users = await request(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(account.user_id)}`, {
        headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Client-Id': clientId },
      });
      ensure(version);
      profile = Array.isArray(users.data) ? users.data.find(user => user?.id === account.user_id) : null;
    } catch { ensure(version); }
    const image = typeof profile?.profile_image_url === 'string' && profile.profile_image_url.startsWith('https://') ? profile.profile_image_url : '';
    update({ userId: account.user_id, login: account.login, displayName: typeof profile?.display_name === 'string' ? profile.display_name : account.login, profileImageUrl: image, canSend: account.scopes.includes(WRITE_SCOPE), canShowShoutouts: account.scopes.includes(SHOUTOUT_SCOPE), canReadEmotes: account.scopes.includes(EMOTE_SCOPE), canDeleteMessages: account.scopes.includes(DELETE_SCOPE), canTimeout: account.scopes.includes(TIMEOUT_SCOPE) });
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
              const subscribe = (type, condition) => request('https://api.twitch.tv/helix/eventsub/subscriptions', {
                method: 'POST', headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Client-Id': clientId, 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, version: '1', condition, transport: { method: 'websocket', session_id: session.id } }),
              });
              const chatCondition = { broadcaster_user_id: status.userId, user_id: status.userId };
              await subscribe('channel.chat.message', chatCondition);
              const optional = [subscribe('channel.chat.notification', chatCondition), ...['channel.chat.message_delete', 'channel.chat.clear_user_messages', 'channel.chat.clear'].map(type => subscribe(type, chatCondition))];
              if (status.canShowShoutouts) {
                const shoutoutCondition = { broadcaster_user_id: status.userId, moderator_user_id: status.userId };
                optional.push(subscribe('channel.shoutout.create', shoutoutCondition), subscribe('channel.shoutout.receive', shoutoutCondition));
              }
              await Promise.allSettled(optional);
            }
            if (!valid()) return;
            currentSocket = entry;
            if (previous) { sockets.delete(previous); cancel(previous.watchdog); previous.ws.close(); }
            retryCount = 0; update({ phase: 'connected', error: '', device: null }); break;
          }
          case 'notification': {
            const event = message.payload?.event;
            const type = message.payload?.subscription?.type;
            if (event?.broadcaster_user_id === status.userId && onChatModeration) {
              if (type === 'channel.chat.message_delete' && typeof event.message_id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(event.message_id)) onChatModeration(status.userId, { eventId: event.message_id });
              if (type === 'channel.chat.clear_user_messages' && typeof event.target_user_id === 'string' && /^[0-9]{1,30}$/.test(event.target_user_id)) onChatModeration(status.userId, { viewerId: `twitch:${event.target_user_id}` });
              if (type === 'channel.chat.clear') onChatModeration(status.userId, {});
            }
            const chat = chatMessage(message, status.userId);
            if (chat && onChatMessage) {
              try { await onChatMessage(chat); } catch { /* other chat tools must not interrupt Twitch */ }
            }
            const activity = chatActivity(message, status.userId);
            if (activity && onChatMessage) {
              try { await onChatMessage(activity); } catch { /* other chat tools must not interrupt Twitch */ }
            }
            const vote = chatVote(message, store.snapshot().poll, status.userId);
            if (vote) {
              let result;
              try { result = await store.command(vote); }
              catch (error) {
                // Validation or a poll replaced while the vote was queued is not a connection failure.
                if (error instanceof PollError && (error.status === 400 || error.status === 409)) break;
                throw error;
              }
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
    async stream() {
      const channelId = status.userId;
      if (!channelId || !credentials.accessToken) return { channelId: '', status: 'disconnected', viewerCount: null, startedAt: null, checkedAt: now(), serverNow: now() };
      if (streamCache?.channelId === channelId && now() - streamCache.checkedAt < 30000) return { ...streamCache, serverNow: now() };
      if (streamRequest) return streamRequest;
      const version = epoch;
      const pendingStream = (async () => {
        const response = await request(`https://api.twitch.tv/helix/streams?${new URLSearchParams({ user_id: channelId })}`, {
          headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Client-Id': clientId },
        });
        ensure(version);
        if (!Array.isArray(response.data)) throw new PollError('Не удалось получить статус эфира Twitch.', 502);
        const live = response.data.find(stream => stream?.user_id === channelId && stream.type === 'live');
        if (response.data.length && !live) throw new PollError('Некорректные данные эфира Twitch.', 502);
        const startedAt = live ? Date.parse(live.started_at) : null;
        if (live && (!Number.isFinite(startedAt) || !Number.isSafeInteger(live.viewer_count) || live.viewer_count < 0)) throw new PollError('Некорректные данные эфира Twitch.', 502);
        streamCache = { channelId, status: live ? 'live' : 'offline', viewerCount: live ? live.viewer_count : 0, startedAt, checkedAt: now() };
        return { ...streamCache, serverNow: now() };
      })();
      streamRequest = pendingStream;
      try { return await pendingStream; } finally { if (streamRequest === pendingStream) streamRequest = null; }
    },
    async moderate(action, target, duration) {
      const version = epoch;
      if (status.phase !== 'connected') throw new PollError('Чат Twitch пока не подключён.', 409);
      if (!['delete', 'timeout'].includes(action)) throw new PollError('Неизвестное действие модерации.', 400);
      if (action === 'delete' ? !status.canDeleteMessages : !status.canTimeout) throw new PollError('Переподключите Twitch, чтобы разрешить модерацию чата.', 409);
      const channelId = status.userId;
      if (target?.broadcasterId !== channelId || !/^twitch:[0-9]{1,30}$/.test(target?.viewerId || '') || !/^[A-Za-z0-9_-]{1,80}$/.test(target?.eventId || '')) throw new PollError('Некорректное сообщение Twitch.', 400);
      const viewerId = target.viewerId.slice(7);
      if (action === 'timeout' && viewerId === channelId) throw new PollError('Нельзя отстранить себя от чата.', 400);
      if (action === 'timeout' && (!Number.isInteger(duration) || duration < 1 || duration > 1209600)) throw new PollError('Укажите тайм-аут от 1 секунды до 14 дней.', 400);
      const query = new URLSearchParams({ broadcaster_id: channelId, moderator_id: channelId });
      if (action === 'delete') query.set('message_id', target.eventId);
      try {
        await request(`https://api.twitch.tv/helix/moderation/${action === 'delete' ? 'chat' : 'bans'}?${query}`, {
          method: action === 'delete' ? 'DELETE' : 'POST',
          headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Client-Id': clientId, 'Content-Type': 'application/json' },
          ...(action === 'timeout' ? { body: JSON.stringify({ data: { user_id: viewerId, duration } }) } : {}),
        });
      } catch (error) {
        if (error.remoteStatus === 429) throw new PollError('Слишком много действий. Подождите немного.', 429);
        if (error.remoteStatus === 400) throw new PollError(action === 'delete' && viewerId === channelId ? 'Публичный API Twitch не разрешает удалять сообщения владельца канала. Удалите сообщение в чате Twitch.' : 'Twitch отклонил действие: сообщение устарело или пользователя нельзя отстранить.', 400);
        throw error;
      }
      ensure(version);
    },
    async sendMessage(rawText) {
      const version = epoch;
      const identity = { userId: status.userId, displayName: status.displayName, login: status.login };
      if (status.phase !== 'connected') throw new PollError('Чат Twitch пока не подключён.', 409);
      if (!status.canSend) throw new PollError('Переподключите Twitch, чтобы разрешить отправку сообщений.', 409);
      if (typeof rawText !== 'string' || !rawText.trim() || rawText.length > 500 || /[\p{Cc}\p{Cf}]/u.test(rawText.replace(/\u200d/g, ''))) throw new PollError('Сообщение должно содержать от 1 до 500 символов.', 400);
      const text = rawText.trim();
      let result;
      try {
        result = await request('https://api.twitch.tv/helix/chat/messages', {
          method: 'POST',
          headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Client-Id': clientId, 'Content-Type': 'application/json' },
          body: JSON.stringify({ broadcaster_id: status.userId, sender_id: status.userId, message: text }),
        });
      } catch (error) {
        if (error.remoteStatus === 429) throw new PollError('Слишком много сообщений. Подождите немного.', 429);
        throw error;
      }
      ensure(version);
      const sent = result?.data?.[0];
      if (!sent?.is_sent || typeof sent.message_id !== 'string' || !sent.message_id) throw new PollError(sent?.drop_reason?.message || 'Twitch не отправил сообщение.', 409);
      return { broadcasterId: identity.userId, viewerId: `twitch:${identity.userId}`, viewerName: identity.displayName || identity.login, viewerLogin: identity.login, roles: ['moderator'], eventId: sent.message_id, text, sentAt: now() };
    },
    async avatars(viewerIds) {
      if (!status.userId || !credentials.accessToken) return {};
      const ids = [...new Set(viewerIds.filter(id => typeof id === 'string' && /^twitch:[0-9]{1,30}$/.test(id)).map(id => id.slice(7)))].slice(0, 100);
      const missing = ids.filter(id => !avatarCache.has(id));
      if (missing.length) {
        const query = new URLSearchParams(missing.map(id => ['id', id]));
        const users = await request(`https://api.twitch.tv/helix/users?${query}`, { headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Client-Id': clientId } });
        const profiles = new Map((Array.isArray(users.data) ? users.data : []).map(user => [user?.id, avatarUrl(user?.profile_image_url)]));
        for (const id of missing) avatarCache.set(id, profiles.get(id) || '');
      }
      return Object.fromEntries(ids.map(id => [`twitch:${id}`, avatarCache.get(id) || '']));
    },
    async emotes() {
      if (!status.userId || !credentials.accessToken) return { emotes: [], requiresReconnect: false };
      const channelId = status.userId;
      const headers = { Authorization: `Bearer ${credentials.accessToken}`, 'Client-Id': clientId };
      if (status.canReadEmotes) {
        const emotes = [];
        const cursors = new Set();
        let cursor = '';
        for (let page = 0; page < 20; page++) {
          const query = new URLSearchParams({ user_id: channelId, broadcaster_id: channelId });
          if (cursor) query.set('after', cursor);
          const response = await request(`https://api.twitch.tv/helix/chat/emotes/user?${query}`, { headers });
          emotes.push(...nativeEmotes(response.data));
          cursor = response.pagination?.cursor;
          if (typeof cursor !== 'string' || !cursor || cursors.has(cursor) || emotes.length >= 10000) break;
          cursors.add(cursor);
        }
        return { emotes: emotes.slice(0, 10000), requiresReconnect: false };
      }
      const results = await Promise.allSettled([
        request('https://api.twitch.tv/helix/chat/emotes/global', { headers }),
        request(`https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${channelId}`, { headers }),
      ]);
      if (results.every(result => result.status === 'rejected')) throw results[0].reason;
      return { emotes: results.flatMap(result => result.status === 'fulfilled' ? nativeEmotes(result.value.data) : []), requiresReconnect: true };
    },
    async badges() {
      if (!status.userId || !credentials.accessToken) return {};
      if (badgeCache.channelId === status.userId && badgeCache.expiresAt > now()) return badgeCache.badges;
      if (badgeRequest) return badgeRequest;
      const channelId = status.userId;
      const headers = { Authorization: `Bearer ${credentials.accessToken}`, 'Client-Id': clientId };
      const load = async url => {
        const response = await request(url, { headers });
        const result = {};
        for (const set of Array.isArray(response.data) ? response.data : []) {
          if (typeof set?.set_id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(set.set_id)) continue;
          for (const badge of Array.isArray(set.versions) ? set.versions : []) {
            if (typeof badge?.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(badge.id)) continue;
            const url = avatarUrl(badge.image_url_2x) || avatarUrl(badge.image_url_1x);
            if (url) result[`${set.set_id}/${badge.id}`] = { url, title: String(badge.title || set.set_id).slice(0, 100) };
          }
        }
        return result;
      };
      badgeRequest = (async () => {
        const [global, channel] = await Promise.allSettled([
          load('https://api.twitch.tv/helix/chat/badges/global'),
          load(`https://api.twitch.tv/helix/chat/badges?broadcaster_id=${encodeURIComponent(channelId)}`),
        ]);
        if (global.status === 'rejected' && channel.status === 'rejected') throw global.reason;
        const badges = { ...(global.status === 'fulfilled' ? global.value : {}), ...(channel.status === 'fulfilled' ? channel.value : {}) };
        if (status.userId === channelId) badgeCache = { channelId, expiresAt: now() + 60 * 60 * 1000, badges };
        return badges;
      })();
      try { return await badgeRequest; } finally { badgeRequest = null; }
    },
    start() { return serial(async () => {
      if (!credentials.accessToken || stopped) return;
      const version = epoch; update({ phase: 'connecting', error: '' });
      try { await validate(version); ensure(version); openSocket(SOCKET, version); } catch (error) { if (alive(version)) failure(error); }
    }); },
    command(command) { return serial(async () => {
      if (command.type === 'disconnect') {
        reset(); credentials = {}; await persist();
        update({ phase: 'disconnected', userId: '', login: '', displayName: '', profileImageUrl: '', canSend: false, canShowShoutouts: false, canReadEmotes: false, canDeleteMessages: false, canTimeout: false, device: null, error: '', lastGapAt: null });
      } else if (command.type === 'connect') {
        reset(); const version = epoch;
        credentials = {}; await persist();
        update({ phase: 'connecting', userId: '', login: '', displayName: '', profileImageUrl: '', canSend: false, canShowShoutouts: false, canReadEmotes: false, canDeleteMessages: false, canTimeout: false, device: null, error: '', lastGapAt: null });
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
