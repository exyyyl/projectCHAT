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
  const source = new EventSource('/api/events');
  source.addEventListener('state', event => { onConnection(true); onState(JSON.parse(event.data)); });
  source.addEventListener('twitch', event => onTwitch(JSON.parse(event.data)));
  source.onopen = () => onConnection(true);
  source.onerror = () => onConnection(false);
  window.addEventListener('pagehide', () => source.close(), { once: true });
  return source;
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
      root.style.setProperty('--pc-accent', widget.accent || '#d3fb75');
      root.style.setProperty('--pc-opacity', String((widget.opacity || 100) / 100));
      root.classList.toggle('pc-widget-glass', widget.surface === 'glass');
      root.classList.toggle('pc-widget-minimal', widget.surface === 'minimal');
      root.classList.toggle('pc-widget-compact', widget.density === 'compact');
      root.classList.toggle('pc-radius-small', widget.radius === 'small');
      root.classList.toggle('pc-radius-large', widget.radius === 'large');
      root.classList.toggle('pc-title-small', widget.titleSize === 'small');
      root.classList.toggle('pc-title-large', widget.titleSize === 'large');
      root.classList.toggle('pc-width-narrow', widget.width === 'narrow');
      root.classList.toggle('pc-width-wide', widget.width === 'wide');
      root.classList.toggle('pc-font-system', widget.font === 'system');
      root.classList.toggle('pc-font-mono', widget.font === 'mono');
      root.classList.toggle('pc-options-cards', widget.optionStyle === 'cards');
      root.classList.toggle('pc-options-outline', widget.optionStyle === 'outline');
      root.classList.toggle('pc-options-small', widget.optionSize === 'small');
      root.classList.toggle('pc-options-large', widget.optionSize === 'large');
      root.classList.toggle('pc-keywords-filled', widget.keywordStyle === 'filled');
      root.classList.toggle('pc-keywords-text', widget.keywordStyle === 'text');
      root.classList.toggle('pc-bars-thin', widget.barSize === 'thin');
      root.classList.toggle('pc-bars-thick', widget.barSize === 'thick');
      root.classList.toggle('pc-hide-keywords', widget.showKeywords === false);
      root.classList.toggle('pc-hide-bars', widget.showBars === false);
      root.classList.toggle('pc-hide-values', widget.showVotes === false && widget.showPercentages === false);
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
          const row = element('div', 'pc-overlay-option');
          const line = element('div', 'pc-overlay-row');
          const label = element('span', 'pc-overlay-label');
          label.append(element('span', 'pc-overlay-name'), element('span', 'pc-overlay-word'));
          line.append(label, element('span', 'pc-overlay-value'));
          const track = element('div', 'pc-track'); track.append(element('div', 'pc-fill'));
          row.append(line, track); return row;
        }));
      }
      const pct = percentages(poll.options);
      const max = Math.max(...poll.options.map(o => o.votes || 0));
      const secret = poll.secret && poll.status !== 'ended';
      root.classList.toggle('pc-ended', poll.status === 'ended');
      root.classList.toggle('pc-has-votes', max > 0);
      [...rows.children].forEach((row, i) => {
        const option = poll.options[i];
        row.classList.toggle('pc-leader', !secret && max > 0 && option.votes === max);
        row.querySelector('.pc-overlay-name').textContent = option.name || `Вариант ${i + 1}`;
        row.querySelector('.pc-overlay-word').textContent = option.word;
        const values = [];
        if (widget.showVotes !== false) values.push(String(option.votes || 0));
        if (widget.showPercentages !== false) values.push(`${pct[i]}%`);
        row.querySelector('.pc-overlay-value').textContent = secret ? '—' : values.join(' · ');
        row.querySelector('.pc-fill').style.transform = `scaleX(${(secret ? 0 : pct[i]) / 100})`;
      });
      tick();
    },
  };
}
