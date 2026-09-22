import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const LAYOUTS = new Set(['fps', 'moba', 'compact']);
const SURFACES = new Set(['solid', 'glass', 'minimal']);
const SHAPES = new Set(['soft', 'round', 'square']);
const SCALES = new Set([80, 100, 120]);
const OPACITIES = new Set([70, 85, 100]);
const SAFE_KEYS = new Set([
  '1', '2', '3', '4', '5', '6',
  'A', 'D', 'E', 'F', 'Q', 'R', 'S', 'W',
  'Alt', 'Ctrl', 'Shift', 'Space',
]);
const SAFE_MOUSE_BUTTONS = new Set(['left', 'middle', 'right', 'back', 'forward']);

const requireThat = (condition, message) => {
  if (!condition) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
};

export function defaultInputOverlayConfig() {
  return {
    accent: '#d3fb75',
    captureEnabled: false,
    keyShape: 'soft',
    layout: 'fps',
    opacity: 85,
    scale: 100,
    showMouse: true,
    showWheel: true,
    surface: 'glass',
    visible: true,
  };
}

export function validateInputOverlayConfig(input) {
  requireThat(input && typeof input === 'object' && !Array.isArray(input), 'Некорректные настройки оверлея ввода.');
  requireThat(typeof input.accent === 'string' && /^#[0-9a-f]{6}$/iu.test(input.accent), 'Некорректный цвет оверлея ввода.');
  requireThat(typeof input.captureEnabled === 'boolean', 'Некорректное состояние отслеживания.');
  requireThat(SHAPES.has(input.keyShape), 'Некорректная форма клавиш.');
  requireThat(LAYOUTS.has(input.layout), 'Некорректный набор клавиш.');
  requireThat(OPACITIES.has(input.opacity), 'Некорректная прозрачность оверлея ввода.');
  requireThat(SCALES.has(input.scale), 'Некорректный размер оверлея ввода.');
  requireThat(typeof input.showMouse === 'boolean' && typeof input.showWheel === 'boolean', 'Некорректные элементы оверлея ввода.');
  requireThat(SURFACES.has(input.surface), 'Некорректный фон оверлея ввода.');
  requireThat(typeof input.visible === 'boolean', 'Некорректная видимость оверлея ввода.');
  return {
    accent: input.accent.toLowerCase(),
    captureEnabled: input.captureEnabled,
    keyShape: input.keyShape,
    layout: input.layout,
    opacity: input.opacity,
    scale: input.scale,
    showMouse: input.showMouse,
    showWheel: input.showWheel,
    surface: input.surface,
    visible: input.visible,
  };
}

const validateStored = input => {
  requireThat(input?.schema === 1, 'Формат настроек оверлея ввода не поддерживается.');
  return validateInputOverlayConfig(input.config);
};

export async function createInputOverlay(filename) {
  let config;
  try { config = validateStored(JSON.parse(await readFile(filename, 'utf8'))); }
  catch (error) {
    if (error.code === 'ENOENT') config = defaultInputOverlayConfig();
    else throw new Error(`Не удалось прочитать ${filename}: ${error.message}`);
  }

  const listeners = new Set();
  const pressedKeys = new Set();
  const pressedMouse = new Set();
  const demoTimers = new Set();
  let queue = Promise.resolve();
  let revision = 0;
  let wheel = null;
  let demo = false;
  let runtime = { supported: false, listening: false, platform: process.platform, message: '' };

  const snapshot = () => ({
    schema: 1,
    revision,
    config: structuredClone(config),
    pressedKeys: [...pressedKeys],
    pressedMouse: [...pressedMouse],
    wheel,
    demo,
    runtime: { ...runtime },
  });
  const publish = () => {
    revision++;
    const state = snapshot();
    for (const listener of listeners) {
      try { listener(state); } catch { /* disconnected observers do not own input state */ }
    }
  };
  const persist = async next => {
    await mkdir(dirname(filename), { recursive: true });
    const temporary = `${filename}.tmp`;
    await writeFile(temporary, JSON.stringify({ schema: 1, config: next }, null, 2) + '\n', { mode: 0o600 });
    await rename(temporary, filename);
  };
  const clearDemo = () => {
    for (const timer of demoTimers) clearTimeout(timer);
    demoTimers.clear();
    demo = false;
    pressedKeys.clear();
    pressedMouse.clear();
    wheel = null;
  };
  const schedule = (delay, callback) => {
    const timer = setTimeout(() => {
      demoTimers.delete(timer);
      callback();
    }, delay);
    demoTimers.add(timer);
  };

  const controller = {
    snapshot,
    subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    async update(nextConfig) {
      const task = queue.then(async () => {
        const next = validateInputOverlayConfig(nextConfig);
        await persist(next);
        config = next;
        if (!config.captureEnabled) {
          pressedKeys.clear();
          pressedMouse.clear();
          wheel = null;
        }
        publish();
        return snapshot();
      });
      queue = task.catch(() => {});
      return task;
    },
    setRuntime(nextRuntime) {
      runtime = {
        supported: nextRuntime?.supported === true,
        listening: nextRuntime?.listening === true,
        platform: typeof nextRuntime?.platform === 'string' ? nextRuntime.platform : process.platform,
        message: typeof nextRuntime?.message === 'string' ? nextRuntime.message.slice(0, 160) : '',
      };
      if (!runtime.listening) {
        pressedKeys.clear();
        pressedMouse.clear();
      }
      publish();
    },
    input(event) {
      if (!config.captureEnabled || demo || !event || typeof event !== 'object') return;
      if (event.kind === 'key' && SAFE_KEYS.has(event.code) && ['down', 'up'].includes(event.action)) {
        const changed = event.action === 'down' ? !pressedKeys.has(event.code) : pressedKeys.has(event.code);
        if (event.action === 'down') pressedKeys.add(event.code); else pressedKeys.delete(event.code);
        if (changed) publish();
      } else if (event.kind === 'mouse' && SAFE_MOUSE_BUTTONS.has(event.button) && ['down', 'up'].includes(event.action)) {
        const changed = event.action === 'down' ? !pressedMouse.has(event.button) : pressedMouse.has(event.button);
        if (event.action === 'down') pressedMouse.add(event.button); else pressedMouse.delete(event.button);
        if (changed) publish();
      } else if (event.kind === 'wheel' && ['up', 'down'].includes(event.direction)) {
        wheel = event.direction;
        publish();
        schedule(180, () => { if (wheel === event.direction) { wheel = null; publish(); } });
      }
    },
    demo() {
      clearDemo();
      demo = true;
      publish();
      const events = [
        [80, 'key', 'W', 'down'],
        [280, 'key', 'Shift', 'down'],
        [500, 'mouse', 'left', 'down'],
        [650, 'mouse', 'left', 'up'],
        [760, 'key', 'D', 'down'],
        [1020, 'key', 'W', 'up'],
        [1160, 'key', 'E', 'down'],
        [1330, 'key', 'E', 'up'],
        [1440, 'wheel', 'up', 'pulse'],
        [1580, 'key', 'D', 'up'],
        [1710, 'key', 'Shift', 'up'],
        [1840, 'mouse', 'right', 'down'],
        [2050, 'mouse', 'right', 'up'],
      ];
      for (const [delay, kind, code, action] of events) {
        schedule(delay, () => {
          if (kind === 'key') {
            if (action === 'down') pressedKeys.add(code); else pressedKeys.delete(code);
          } else if (kind === 'mouse') {
            if (action === 'down') pressedMouse.add(code); else pressedMouse.delete(code);
          } else {
            wheel = code;
            schedule(180, () => { wheel = null; publish(); });
          }
          publish();
        });
      }
      schedule(2320, () => { clearDemo(); publish(); });
      return snapshot();
    },
    reset() {
      clearDemo();
      publish();
    },
    async close() {
      clearDemo();
      await queue;
      listeners.clear();
    },
  };
  return controller;
}
