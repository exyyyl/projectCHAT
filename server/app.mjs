import { publicContest } from '../public/contest-overlay-model.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import { createTwitch } from './twitch.mjs';
import { PollError } from './polls.mjs';
import { TWITCH_CLIENT_ID } from './config.mjs';
import { createContest } from './contest.mjs';
import { createChatArchive } from './chat-archive.mjs';
import { createChatEmotes } from './chat-emotes.mjs';
import { createErrorJournal } from './diagnostics.mjs';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const productionPanelDir = join(publicDir, 'panel-build');
const staticFiles = panelDir => ({ '/': [join(panelDir, 'index.html'), 'text/html', true], '/overlay': ['overlay.html', 'text/html'], '/chat-overlay': [join(panelDir, 'chat-overlay.html'), 'text/html', true], '/contest-overlay': [join(panelDir, 'contest-overlay.html'), 'text/html', true], '/overlay.js': ['overlay.js', 'text/javascript'], '/shared.js': ['shared.js', 'text/javascript'], '/widget-model.js': ['widget-model.js', 'text/javascript'], '/widget.css': ['widget.css', 'text/css'], '/style.css': ['style.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'], '/favicon.png': ['favicon.png', 'image/png'], '/fonts/geist-cyrillic.woff2': ['fonts/geist-cyrillic.woff2', 'font/woff2'], '/fonts/geist-latin.woff2': ['fonts/geist-latin.woff2', 'font/woff2'] });
const assetTypes = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const requireThat = (condition, message, status) => { if (!condition) throw new PollError(message, status); };
export async function createApp({ dataDir, now = Date.now, twitchOptions = {}, emoteOptions = {}, allowedOrigins = [], panelDir = productionPanelDir, diagnostics, appVersion = '' } = {}) {
  const journal = diagnostics || await createErrorJournal(join(dataDir, 'errors.json'), { version: appVersion || JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version, now });
  const store = await createStore(join(dataDir, 'state.json'), { now });
  const contest = await createContest(join(dataDir, 'contest.json'), { now });
  const chat = await createChatArchive(join(dataDir, 'chat.sqlite'), { now });
  const twitch = await createTwitch({ filename: join(dataDir, 'twitch.json'), store, now, clientId: TWITCH_CLIENT_ID, onError: error => journal.record({ source: 'twitch', error }), onChatModeration: (channelId, target) => chat.markDeleted(channelId, target), onChatMessage: message => Promise.allSettled([message.kind === 'activity' ? Promise.resolve() : contest.chat(message), Promise.resolve().then(() => chat.add(message))]), ...twitchOptions });
  const emotes = createChatEmotes({ twitch, now, ...emoteOptions });
  if (twitch.snapshot().error) journal.record({ source: 'twitch:startup', error: twitch.snapshot().error });
  const streams = new Set();
  let allowedHosts;
  const trustedOrigins = new Set(allowedOrigins);
  const files = staticFiles(panelDir);
  const json = (response, status, data) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); };
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: stream-dock-icon: https://static-cdn.jtvnw.net https://cdn.7tv.app https://cdn.betterttv.net https://cdn.frankerfacez.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    try {
      const host = request.headers.host;
      if (!allowedHosts.has(host)) return json(response, 403, { error: 'Недопустимый адрес сервера.' });
      if (request.headers.origin && request.headers.origin !== `http://${host}` && !trustedOrigins.has(request.headers.origin)) return json(response, 403, { error: 'Запрос с другого сайта отклонён.' });
      const requestUrl = new URL(request.url, `http://${host}`);
      const path = requestUrl.pathname;
      if (request.method === 'GET' && path === '/api/state') return json(response, 200, store.snapshot());
      if (request.method === 'GET' && path === '/api/diagnostics') return json(response, 200, requestUrl.searchParams.get('summary') === '1' ? journal.summary() : journal.snapshot());
      if (request.method === 'GET' && path === '/api/twitch') return json(response, 200, twitch.snapshot());
      if (request.method === 'GET' && path === '/api/twitch/stream') return json(response, 200, await twitch.stream());
      if (request.method === 'GET' && path === '/api/contest') return json(response, 200, contest.snapshot());
      if (request.method === 'GET' && path === '/api/chat/memo') return json(response, 200, { text: chat.memo() });
      if (request.method === 'GET' && path === '/api/chat/avatars') {
        requireThat(twitch.snapshot().userId, 'Сначала подключите Twitch.', 409);
        const ids = requestUrl.searchParams.getAll('id');
        requireThat(ids.length <= 100, 'Слишком много зрителей.', 400);
        return json(response, 200, { avatars: await twitch.avatars(ids) });
      }
      if (request.method === 'GET' && path === '/api/chat/emotes') {
        const channelId = twitch.snapshot().userId;
        requireThat(channelId, 'Сначала подключите Twitch.', 409);
        const catalog = await emotes.catalog();
        requireThat(twitch.snapshot().userId === channelId, 'Аккаунт Twitch изменился.', 409);
        return json(response, 200, catalog);
      }
      if (request.method === 'GET' && path === '/api/chat/badges') {
        requireThat(twitch.snapshot().userId, 'Сначала подключите Twitch.', 409);
        return json(response, 200, { badges: await twitch.badges() });
      }
      if (request.method === 'GET' && path === '/api/chat/recent') {
        const channelId = twitch.snapshot().userId;
        const before = Number(requestUrl.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
        requireThat(Number.isSafeInteger(before) && before > 0, 'Некорректная страница истории.', 400);
        return json(response, 200, { messages: chat.recent(channelId, before), archive: chat.overview(channelId), channelId });
      }
      if (request.method === 'GET' && path === '/api/chat/profile') {
        const channelId = twitch.snapshot().userId;
        requireThat(channelId, 'Сначала подключите Twitch.', 409);
        const before = Number(requestUrl.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
        requireThat(Number.isSafeInteger(before) && before > 0, 'Некорректная страница истории.', 400);
        return json(response, 200, chat.profile(channelId, requestUrl.searchParams.get('viewerId'), before));
      }
      if (request.method === 'GET' && path === '/api/contest/overlay/events') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
        let settings = store.snapshot().contestOverlay;
        const send = () => { if (!response.destroyed) response.write(`event: snapshot\ndata: ${JSON.stringify({settings, contest:publicContest(contest.snapshot().contest), serverNow:now()})}\n\n`); };
        send();
        const offContest = contest.subscribe(send);
        const offStore = store.subscribe(state => { if (JSON.stringify(state.contestOverlay) !== JSON.stringify(settings)) { settings = state.contestOverlay; send(); } });
        streams.add(response);
        const heartbeat = setInterval(() => {if (!response.destroyed) response.write(': heartbeat\n\n');}, 15000);
        request.on('close', () => { clearInterval(heartbeat); offContest(); offStore(); streams.delete(response); });
        return;
      }
      if (request.method === 'GET' && path === '/api/chat/overlay/events') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
        let channelId = twitch.snapshot().userId;
        let settings = store.snapshot().chatOverlay;
        const emit = (type, value) => { if (!response.destroyed) response.write(`event: ${type}\ndata: ${JSON.stringify(value)}\n\n`); };
        const snapshot = () => emit('snapshot', { channelId, settings, serverNow: now(), messages: chat.recent(channelId) });
        snapshot();
        const offChat = chat.subscribe((sourceId, message, updated) => { if (sourceId === channelId) emit(updated ? 'update' : 'message', message); });
        const offTwitch = twitch.subscribe(state => { if (state.userId !== channelId) { channelId = state.userId; snapshot(); } });
        const offStore = store.subscribe(state => { if (JSON.stringify(settings) !== JSON.stringify(state.chatOverlay)) { settings = state.chatOverlay; emit('settings', settings); } });
        streams.add(response);
        const heartbeat = setInterval(() => { if (!response.destroyed) response.write(': heartbeat\n\n'); }, 15000);
        request.on('close', () => { clearInterval(heartbeat); offChat(); offTwitch(); offStore(); streams.delete(response); });
        return;
      }
      if (request.method === 'GET' && path === '/api/chat/events') {
        const channelId = twitch.snapshot().userId;
        requireThat(channelId, 'Сначала подключите Twitch.', 409);
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
        response.write(': connected\n\n');
        const off = chat.subscribe((sourceId, message, updated) => {
          if (sourceId === channelId && !response.destroyed) response.write(`event: ${updated ? 'update' : 'message'}\ndata: ${JSON.stringify(message)}\n\n`);
        });
        streams.add(response);
        const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15000);
        request.on('close', () => { clearInterval(heartbeat); off(); streams.delete(response); });
        return;
      }
      if (request.method === 'GET' && path === '/api/events') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
        const send = state => { if (!response.destroyed) response.write(`id: ${state.revision}\nevent: state\ndata: ${JSON.stringify(state)}\n\n`); };
        send(store.snapshot());
        const off = store.subscribe(send);
        const sendTwitch = state => { if (!response.destroyed) response.write(`event: twitch\ndata: ${JSON.stringify(state)}\n\n`); };
        sendTwitch(twitch.snapshot());
        const offTwitch = twitch.subscribe(sendTwitch);
        const sendContest = state => { if (!response.destroyed) response.write(`event: contest\ndata: ${JSON.stringify(state)}\n\n`); };
        sendContest(contest.snapshot());
        const offContest = contest.subscribe(sendContest);
        streams.add(response);
        const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15000);
        request.on('close', () => { clearInterval(heartbeat); off(); offTwitch(); offContest(); streams.delete(response); });
        return;
      }
      if (request.method === 'POST' && path === '/api/stream-dock') {
        if (!request.headers['content-type']?.startsWith('application/json') || request.headers['x-projectchat-control'] !== 'stream-dock-v1') return json(response, 415, { error: 'Ожидается команда Cue Stream Dock.' });
        let bytes = 0, text = '';
        for await (const chunk of request) {
          bytes += chunk.length;
          if (bytes > 4096) { json(response, 413, { error: 'Слишком большая команда.' }); return; }
          text += chunk;
        }
        let input;
        try { input = JSON.parse(text); } catch { return json(response, 400, { error: 'Некорректный JSON.' }); }
        const state = store.snapshot();
        let command, message;
        if (input?.action === 'start' || (input?.action === 'toggle-poll' && state.poll?.status !== 'running')) {
          requireThat(!state.poll || state.poll.status !== 'running', 'Опрос уже запущен.', 409);
          let broadcasterId;
          if (state.draft.source === 'twitch') {
            const connection = twitch.snapshot();
            requireThat(connection.phase === 'connected', 'Сначала подключите Twitch в Cue.', 409);
            broadcasterId = connection.userId;
          }
          command = { type: 'start', draftRevision: state.draftRevision, draft: state.draft, broadcasterId };
          message = 'Опрос запущен';
        } else if (input?.action === 'finish' || input?.action === 'toggle-poll') {
          requireThat(state.poll?.status === 'running', 'Сейчас нет активного опроса.', 409);
          command = { type: 'finish', pollId: state.poll.id };
          message = 'Опрос завершён';
        } else if (input?.action === 'toggle-output') {
          requireThat(state.poll, 'Сейчас нет опроса.', 409);
          command = { type: 'visibility', pollId: state.poll.id, visible: !state.poll.visible };
          message = state.poll.visible ? 'Виджет скрыт' : 'Виджет показан';
        } else if (input?.action === 'extend') {
          requireThat(state.poll?.status === 'running', 'Сейчас нет активного опроса.', 409);
          command = { type: 'extend', pollId: state.poll.id };
          message = 'Добавлено 30 секунд';
        } else if (input?.action === 'next-preset') {
          command = { type: 'preset-next' };
        } else if (input?.action === 'select-preset') {
          requireThat(typeof input.presetId === 'string' && input.presetId.length > 0, 'Выберите шаблон в настройках кнопки.', 400);
          command = { type: 'preset-apply', presetId: input.presetId, draftRevision: state.draftRevision };
        } else {
          throw new PollError('Неизвестное действие Stream Dock.');
        }
        const result = await store.command(command);
        return json(response, 200, { ok: true, message: message || `Выбран шаблон «${result.outcome}»`, state: result.state });
      }
      if (request.method === 'POST' && ['/api/command', '/api/twitch', '/api/contest', '/api/chat/notes', '/api/chat/memo', '/api/chat/send', '/api/chat/moderate', '/api/diagnostics'].includes(path)) {
        if (!request.headers['content-type']?.startsWith('application/json') || request.headers['x-poll-client'] !== 'panel') return json(response, 415, { error: 'Ожидается JSON-команда панели.' });
        let bytes = 0, text = '';
        for await (const chunk of request) {
          bytes += chunk.length;
          if (bytes > 65536) { json(response, 413, { error: 'Слишком большой запрос.' }); return; }
          text += chunk;
        }
        let command;
        try { command = JSON.parse(text); } catch { return json(response, 400, { error: 'Некорректный JSON.' }); }
        if (!command || typeof command !== 'object' || Array.isArray(command)) throw new PollError('Некорректная команда.');
        if (path === '/api/chat/memo') return json(response, 200, { text: chat.saveMemo(command.text) });
        if (path === '/api/chat/moderate') {
          const channelId = twitch.snapshot().userId;
          requireThat(channelId && command.channelId === channelId, 'Аккаунт Twitch изменился. Обновите чат.', 409);
          const target = chat.moderationTarget(channelId, command.messageId);
          await twitch.moderate(command.action, target, command.duration);
          chat.markDeleted(channelId, command.action === 'delete' ? { eventId: target.eventId } : { viewerId: target.viewerId });
          return json(response, 200, { ok: true });
        }
        if (path === '/api/chat/send') {
          const channelId = twitch.snapshot().userId;
          requireThat(command.channelId === undefined || command.channelId === channelId, 'Аккаунт Twitch изменился. Обновите чат.', 409);
          const sent = await twitch.sendMessage(command.text);
          const message = chat.addOutgoing(sent);
          return json(response, 200, { ok: true, eventId: sent.eventId, message });
        }
        if (path === '/api/chat/notes') {
          const channelId = twitch.snapshot().userId;
          requireThat(channelId, 'Сначала подключите Twitch.', 409);
          if (command.type === 'add') return json(response, 200, { note: chat.addNote(channelId, command.viewerId, command.text) });
          if (command.type === 'delete') { chat.deleteNote(channelId, command.viewerId, command.noteId); return json(response, 200, { ok: true }); }
          throw new PollError('Неизвестная команда заметок.');
        }
        if (path === '/api/diagnostics') {
          if (command.type === 'clear') return json(response, 200, await journal.clear());
          requireThat(command.type === 'record' && typeof command.message === 'string' && command.message.length <= 12000, 'Некорректная запись журнала.', 400);
          journal.record({ source: 'panel', error: command.message });
          return json(response, 200, { ok: true });
        }
        if (path === '/api/twitch') return json(response, 200, await twitch.command(command));
        if (path === '/api/contest') {
          if (command.type === 'start' && command.setup?.source !== 'test') {
            const connection = twitch.snapshot();
            if (connection.phase !== 'connected') throw new PollError('Сначала подключите Twitch и дождитесь связи с чатом.', 409);
            command.broadcasterId = connection.userId;
          }
          return json(response, 200, await contest.command(command));
        }
        if (command.type === 'activity-avatar') throw new PollError('Неизвестная команда.');
        if (command.type === 'vote') command.source = 'test';
        if (command.type === 'start' && command.draft?.source === 'twitch') {
          const connection = twitch.snapshot();
          if (connection.phase !== 'connected') throw new PollError('Сначала подключите Twitch и дождитесь связи с чатом.', 409);
          command.broadcasterId = connection.userId;
        }
        return json(response, 200, await store.command(command));
      }
      if (request.method === 'GET' && files[path]) {
        const [file, type, absolute] = files[path];
        response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
        return response.end(await readFile(absolute ? file : join(publicDir, file)));
      }
      if (request.method === 'GET' && /^\/assets\/[A-Za-z0-9._-]+$/.test(path)) {
        const extension = path.slice(path.lastIndexOf('.'));
        const type = assetTypes[extension];
        if (!type) return json(response, 404, { error: 'Файл не найден.' });
        response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' });
        return response.end(await readFile(join(panelDir, path.slice(1))));
      }
      json(response, 404, { error: 'Страница не найдена.' });
    } catch (error) {
      journal.record({ source: `server:${request.method} ${String(request.url || '').split(/[?#]/u)[0].slice(0, 100)}`, error });
      if (!error.status) console.error(error);
      if (!response.headersSent) json(response, error.status || 500, { error: error.status ? error.message : 'Не удалось сохранить изменение. Проверьте доступ к папке data.' });
      else response.end();
    }
  });
  server.requestTimeout = 15000;
  let ticker;
  return {
    store,
    contest,
    chat,
    async listen(port = 4317) {
      // Assigned before requests are handled; only loopback is exposed.
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
      const actual = server.address().port;
      allowedHosts = new Set([`127.0.0.1:${actual}`, `localhost:${actual}`]);
      ticker = setInterval(() => {
        store.command({ type: 'tick' }).catch(error => { journal.record({ source: 'poll:tick', error }); console.error('Не удалось завершить опрос:', error.message); });
        contest.tick().catch(error => { journal.record({ source: 'contest:tick', error }); console.error('Не удалось завершить набор конкурса:', error.message); });
      }, 250);
      void twitch.start();
      return `http://127.0.0.1:${actual}`;
    },
    async close() { clearInterval(ticker); await twitch.close(); for (const stream of streams) stream.end(); await new Promise(resolve => server.close(resolve)); await store.drain(); await contest.drain(); chat.close(); await journal.flush(); },
  };
}
