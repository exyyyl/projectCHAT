import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { initialState, validateStoredState, publicState, applyCommand } from './polls.mjs';

export async function createStore(filename, { now = Date.now } = {}) {
  let state;
  try { state = validateStoredState(JSON.parse(await readFile(filename, 'utf8'))); }
  catch (error) {
    if (error.code === 'ENOENT') state = initialState();
    else throw new Error(`Не удалось прочитать ${filename}. Исходный файл сохранён: ${error.message}`);
  }
  const listeners = new Set();
  let queue = Promise.resolve();
  const store = {
    snapshot: () => publicState(state, now()),
    subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    command(command) {
      const task = queue.then(async () => {
        const result = applyCommand(state, command, now());
        if (result.changed) {
          await mkdir(dirname(filename), { recursive: true });
          const temporary = `${filename}.tmp`;
          await writeFile(temporary, JSON.stringify(result.state, null, 2) + '\n', { mode: 0o600 });
          await rename(temporary, filename);
          state = result.state;
          for (const notify of listeners) { try { notify(store.snapshot()); } catch { /* a disconnected observer cannot undo a committed vote */ } }
        }
        return { state: store.snapshot(), outcome: result.outcome };
      });
      queue = task.catch(() => {});
      return task;
    },
    drain: () => queue,
  };
  await store.command({ type: 'tick' });
  return store;
}
