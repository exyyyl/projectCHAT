import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import { createTwitch } from './twitch.mjs';
import { PollError } from './polls.mjs';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const panelDir = join(publicDir, 'panel-build');
const files = { '/': [join(panelDir, 'index.html'), 'text/html', true], '/overlay': ['overlay.html', 'text/html'], '/overlay.js': ['overlay.js', 'text/javascript'], '/shared.js': ['shared.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'], '/favicon.png': ['favicon.png', 'image/png'], '/fonts/geist-cyrillic.woff2': ['fonts/geist-cyrillic.woff2', 'font/woff2'], '/fonts/geist-latin.woff2': ['fonts/geist-latin.woff2', 'font/woff2'] };
const assetTypes = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
export async function createApp({ dataDir, now = Date.now, twitchOptions = {} } = {}) {
  const store = await createStore(join(dataDir, 'state.json'), { now });
  const twitch = await createTwitch({ filename: join(dataDir, 'twitch.json'), store, now, ...twitchOptions });
  const streams = new Set();
  let allowedHosts;
  const json = (response, status, data) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); };
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    try {
      const host = request.headers.host;
      if (!allowedHosts.has(host)) return json(response, 403, { error: 'Недопустимый адрес сервера.' });
      if (request.headers.origin && request.headers.origin !== `http://${host}`) return json(response, 403, { error: 'Запрос с другого сайта отклонён.' });
      const path = new URL(request.url, `http://${host}`).pathname;
      if (request.method === 'GET' && path === '/api/state') return json(response, 200, store.snapshot());
      if (request.method === 'GET' && path === '/api/twitch') return json(response, 200, twitch.snapshot());
      if (request.method === 'GET' && path === '/api/events') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
        const send = state => { if (!response.destroyed) response.write(`id: ${state.revision}\nevent: state\ndata: ${JSON.stringify(state)}\n\n`); };
        send(store.snapshot());
        const off = store.subscribe(send);
        const sendTwitch = state => { if (!response.destroyed) response.write(`event: twitch\ndata: ${JSON.stringify(state)}\n\n`); };
        sendTwitch(twitch.snapshot());
        const offTwitch = twitch.subscribe(sendTwitch);
        streams.add(response);
        const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15000);
        request.on('close', () => { clearInterval(heartbeat); off(); offTwitch(); streams.delete(response); });
        return;
      }
      if (request.method === 'POST' && ['/api/command', '/api/twitch'].includes(path)) {
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
        if (path === '/api/twitch') return json(response, 200, await twitch.command(command));
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
        response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache' });
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
      if (!error.status) console.error(error);
      if (!response.headersSent) json(response, error.status || 500, { error: error.status ? error.message : 'Не удалось сохранить изменение. Проверьте доступ к папке data.' });
      else response.end();
    }
  });
  server.requestTimeout = 15000;
  let ticker;
  return {
    store,
    async listen(port = 4317) {
      // Assigned before requests are handled; only loopback is exposed.
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
      const actual = server.address().port;
      allowedHosts = new Set([`127.0.0.1:${actual}`, `localhost:${actual}`]);
      ticker = setInterval(() => { store.command({ type: 'tick' }).catch(error => console.error('Не удалось завершить опрос:', error.message)); }, 250);
      void twitch.start();
      return `http://127.0.0.1:${actual}`;
    },
    async close() { clearInterval(ticker); await twitch.close(); for (const stream of streams) stream.end(); await new Promise(resolve => server.close(resolve)); await store.drain(); },
  };
}
