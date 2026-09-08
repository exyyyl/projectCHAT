import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createApp } from './app.mjs';

const port = Number(process.env.PORT || 4317);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT должен быть числом от 1 до 65535.');
try {
  const app = await createApp({ dataDir: process.env.POLL_DATA_DIR ? resolve(process.env.POLL_DATA_DIR) : fileURLToPath(new URL('../data/', import.meta.url)) });
  const url = await app.listen(port);
  console.log(`\nПанель:  ${url}\nОверлей: ${url}/overlay\n\nTwitch и тестовый режим доступны в панели.\nДля остановки: Ctrl+C.\n`);
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { if (stopping) return; stopping = true; await app.close(); process.exit(0); });
} catch (error) {
  console.error(error.code === 'EADDRINUSE' ? `Порт ${port} занят. Возможно, приложение уже запущено: http://127.0.0.1:${port}` : error.message);
  process.exitCode = 1;
}
