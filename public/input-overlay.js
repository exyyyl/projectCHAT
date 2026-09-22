import { connectEvents } from './shared.js';

const root = document.querySelector('#input-overlay');

const layouts = {
  fps: [
    ['1', '2', '3', '4', '5'],
    ['Q', 'W', 'E', 'R', 'F'],
    ['A', 'S', 'D'],
    ['Shift', 'Ctrl', 'Space'],
  ],
  moba: [
    ['1', '2', '3', '4', '5', '6'],
    ['Q', 'W', 'E', 'R'],
    ['D', 'F', 'Space'],
    ['Ctrl', 'Alt'],
  ],
  compact: [
    ['W'],
    ['A', 'S', 'D'],
    ['Shift', 'Space'],
  ],
};

const labels = { Ctrl: 'CTRL', Shift: 'SHIFT', Space: 'SPACE', Alt: 'ALT' };

function key(code, pressed) {
  const element = document.createElement('span');
  element.className = `io-key${pressed.has(code) ? ' is-active' : ''}`;
  element.dataset.code = code;
  element.textContent = labels[code] || code;
  return element;
}

function mouse(state) {
  const buttons = new Set(state.pressedMouse);
  const element = document.createElement('div');
  element.className = 'io-mouse';
  element.innerHTML = `
    <span class="io-mouse-button io-mouse-left${buttons.has('left') ? ' is-active' : ''}"></span>
    <span class="io-mouse-button io-mouse-right${buttons.has('right') ? ' is-active' : ''}"></span>
    <span class="io-mouse-wheel${state.wheel ? ' is-active' : ''}"><i></i></span>
    <span class="io-mouse-side io-mouse-back${buttons.has('back') ? ' is-active' : ''}"></span>
    <span class="io-mouse-side io-mouse-forward${buttons.has('forward') ? ' is-active' : ''}"></span>
  `;
  element.setAttribute('aria-label', 'Мышь');
  return element;
}

function render(state) {
  const config = state.config;
  const pressed = new Set(state.pressedKeys);
  root.className = [
    config.visible ? '' : 'is-hidden',
    `io-${config.surface}`,
    `io-${config.keyShape}`,
  ].join(' ');
  root.style.setProperty('--io-accent', config.accent);
  root.style.setProperty('--io-opacity', String(config.opacity / 100));
  root.style.setProperty('--io-scale', String(config.scale / 100));
  root.replaceChildren();

  const visualizer = document.createElement('div');
  visualizer.className = 'io-visualizer';
  const keyboard = document.createElement('div');
  keyboard.className = `io-keyboard io-layout-${config.layout}`;
  for (const row of layouts[config.layout] || layouts.fps) {
    const rowElement = document.createElement('div');
    rowElement.className = 'io-key-row';
    for (const code of row) rowElement.append(key(code, pressed));
    keyboard.append(rowElement);
  }
  visualizer.append(keyboard);
  if (config.showMouse) {
    const mouseElement = mouse(state);
    if (!config.showWheel) mouseElement.classList.add('io-hide-wheel');
    visualizer.append(mouseElement);
  }
  root.append(visualizer);
}

connectEvents('/api/input-overlay/events', { input: render });
