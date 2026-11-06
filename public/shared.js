import { resolveWidget, widgetStyle } from './widget-model.js';

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function percentages(options) {
  const total = options.reduce((sum, o) => sum + (o.votes || 0), 0);
  if (!total) return options.map(() => 0);
  const exact = options.map(o => (o.votes || 0) / total * 100);
  const rounded = exact.map(Math.floor);
  const order = exact.map((p, i) => ({ i, fraction: p - rounded[i] })).sort((a, b) => b.fraction - a.fraction);
  const remainder = 100 - rounded.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remainder; i++) rounded[order[i].i]++;
  return rounded;
}
export function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
export function voteCount(total) { return `${total} ${total % 10 === 1 && total % 100 !== 11 ? 'голос' : total % 10 >= 2 && total % 10 <= 4 && !(total % 100 >= 12 && total % 100 <= 14) ? 'голоса' : 'голосов'}`; }
export function connect(onState, onConnection, onTwitch = () => {}) {
  return connectEvents('/api/events', { state: onState, twitch: onTwitch }, onConnection);
}

// OBS keeps the page alive across application restarts. Recreate failed streams
// explicitly: a CLOSED EventSource no longer performs native retries.
export function connectEvents(url, handlers, onConnection = () => {}) {
  let source = null, retryTimer = null, retryDelay = 1000;
  let paused = false, disposed = false;

  function stop() {
    clearTimeout(retryTimer);
    retryTimer = null;
    const previous = source;
    source = null;
    previous?.close();
  }

  function start() {
    if (disposed || paused || source) return;
    const current = new EventSource(url);
    source = current;
    for (const [name, handler] of Object.entries(handlers)) {
      current.addEventListener(name, event => {
        if (source !== current) return;
        const state = JSON.parse(event.data);
        retryDelay = 1000;
        onConnection(true);
        handler(state);
      });
    }
    current.onopen = () => { if (source === current) onConnection(true); };
    current.onerror = () => {
      if (source !== current) return;
      stop();
      onConnection(false);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        start();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 5000);
    };
  }

  const pause = () => { paused = true; stop(); onConnection(false); };
  const resume = () => { paused = false; start(); };
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', resume);
  start();
  return {
    close() {
      disposed = true;
      stop();
      window.removeEventListener('pagehide', pause);
      window.removeEventListener('pageshow', resume);
    },
  };
}
export function createOverlay(root) {
  const question = root.querySelector('[data-overlay-question]');
  const rows = root.querySelector('[data-overlay-options]');
  const timer = root.querySelector('[data-clock]');
  let current = null, offset = 0, lastId = null, connected = true;
  function tick() {
    if (!current) return;
    const seconds = current.status === 'running' ? Math.max(0, Math.ceil((current.deadline - (Date.now() + offset)) / 1000)) : current.status === 'ended' ? 0 : current.duration;
    timer.textContent = connected ? formatTime(seconds) : '—';
  }
  setInterval(tick, 250);
  return {
    connection(value) { connected = value; tick(); },
    render(poll, serverNow = Date.now(), widget = {}) {
      offset = serverNow - Date.now();
      current = poll;
      widget = resolveWidget(widget);
      root.classList.add('cue-poll-widget');
      for (const [key, value] of Object.entries(widgetStyle(widget))) {
        if (key === 'fontFamily') root.style.fontFamily = value;
        else root.style.setProperty(key, value);
      }
      Object.assign(root.dataset, { layout: widget.layout, alignment: widget.alignment, surface: widget.surface, optionStyle: widget.optionStyle, keywordStyle: widget.keywordStyle, highlight: String(widget.highlightWinner) });
      question.parentElement.className = 'cue-widget-heading';
      timer.className = 'cue-widget-clock';
      rows.className = 'cue-widget-options';
      timer.hidden = widget.showTimer === false;
      if (!poll) { root.classList.add('is-hidden'); root.setAttribute('aria-hidden', 'true'); return; }
      const visible = poll.visible !== false;
      // A new private poll must not flash its content during the previous poll's fade-out.
      root.hidden = !visible && (poll.id !== lastId || root.hidden);
      root.classList.toggle('is-hidden', !visible);
      root.setAttribute('aria-hidden', String(!visible));
      if (poll.id !== lastId) {
        root.classList.remove('pc-enter');
        if (visible) { requestAnimationFrame(() => root.classList.add('pc-enter')); }
        lastId = poll.id;
      }
      question.textContent = poll.question || 'Твой вопрос';
      if (rows.children.length !== poll.options.length) {
        rows.replaceChildren(...poll.options.map(() => {
          const row = element('div', 'cue-widget-option');
          const line = element('div', 'cue-widget-option-main');
          const label = element('span', 'cue-widget-label');
          label.append(element('span', 'cue-widget-name'), element('span', 'cue-widget-keyword'));
          const value = element('span', 'cue-widget-value');
          value.append(element('strong'), element('small'));
          line.append(element('span', 'cue-widget-number'), label, value);
          const track = element('div', 'cue-widget-track'); track.append(element('div', 'cue-widget-fill'));
          row.append(line, track); return row;
        }));
      }
      const pct = percentages(poll.options);
      const max = Math.max(...poll.options.map(o => o.votes || 0));
      const secret = poll.secret && poll.status !== 'ended';
      root.dataset.ended = String(poll.status === 'ended');
      root.style.setProperty('--cue-columns', String(Math.min(3, poll.options.length)));
      [...rows.children].forEach((row, i) => {
        const option = poll.options[i];
        const share = secret ? 0 : pct[i] / 100;
        row.dataset.leading = String(!secret && max > 0 && option.votes === max);
        row.style.setProperty('--cue-share', String(share));
        row.querySelector('.cue-widget-name').textContent = option.name || `Вариант ${i + 1}`;
        const number = row.querySelector('.cue-widget-number');
        number.textContent = String(i + 1).padStart(2, '0'); number.hidden = !widget.showNumbers;
        const keyword = row.querySelector('.cue-widget-keyword');
        keyword.textContent = option.word; keyword.hidden = !widget.showKeywords;
        const value = row.querySelector('.cue-widget-value');
        value.hidden = !widget.showVotes && !widget.showPercentages;
        value.querySelector('strong').textContent = secret ? '—' : widget.showPercentages ? `${pct[i]}%` : String(option.votes || 0);
        const votes = value.querySelector('small');
        votes.textContent = `${option.votes || 0} голос.`;
        votes.hidden = secret || !widget.showVotes || !widget.showPercentages;
        row.querySelector('.cue-widget-track').hidden = !widget.showBars;
        row.querySelector('.cue-widget-fill').style.transform = `scaleX(${share})`;
      });
      let footer = root.querySelector('.cue-widget-footer');
      if (!footer) { footer = element('footer', 'cue-widget-footer'); footer.append(element('span'), element('strong')); root.append(footer); }
      footer.hidden = !widget.showTotal;
      footer.querySelector('span').textContent = poll.status === 'ended' ? 'Голосование завершено' : 'Всего голосов';
      footer.querySelector('strong').textContent = secret ? '—' : poll.options.reduce((sum, option) => sum + (option.votes || 0), 0).toLocaleString('ru');
      tick();
    },
  };
}
