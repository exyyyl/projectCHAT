import { contestOverlayDefaults, contestOverlayRanges } from '../public/contest-overlay-model.js';
import { randomUUID } from 'node:crypto';
import { widgetDefaults, resolveWidget } from '../public/widget-model.js';
import { chatOverlayDefaults, chatOverlayRanges } from '../public/chat-overlay-model.js';

export class PollError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const normalize = value => value.normalize('NFKC').trim().toLocaleLowerCase('ru');
const requireThat = (condition, message, status) => { if (!condition) throw new PollError(message, status); };
function isTwitchImage(value) {
  if (value === undefined || value === '') return true;
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'static-cdn.jtvnw.net' && !url.port && !url.username && !url.password; }
  catch { return false; }
}
function validatePresetName(value) {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 50, 'Название шаблона должно содержать от 1 до 50 символов.');
  return value.trim();
}
export function validateChatOverlay(input) {
  requireThat(input && typeof input === 'object' && !Array.isArray(input), 'Некорректные настройки чата.');
  const settings = { ...chatOverlayDefaults };
  for (const [key, value] of Object.entries(input)) {
    requireThat(Object.hasOwn(settings, key), 'Неизвестная настройка оверлея чата.');
    if (chatOverlayRanges[key]) {
      const [min, max] = chatOverlayRanges[key];
      requireThat(Number.isInteger(value) && value >= min && value <= max, `Настройка ${key}: от ${min} до ${max}.`);
    } else if (typeof settings[key] === 'boolean') requireThat(typeof value === 'boolean', 'Некорректный переключатель чата.');
    else if (key.endsWith('Color')) requireThat(typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value), 'Укажите цвет в формате HEX.');
    else {
      const variants = { style: ['cards', 'minimal', 'bubble'], font: ['geist', 'system', 'mono'], animation: ['slide', 'fade', 'none'], alignment: ['left', 'right'], emoteProvider: ['ffz', '7tv', 'bttv'] };
      requireThat(variants[key]?.includes(value), 'Некорректный вариант оформления чата.');
    }
    settings[key] = value;
  }
  return settings;
}
export function validateContestOverlay(input) {
  requireThat(input && typeof input === 'object' && !Array.isArray(input), 'Некорректные настройки конкурса.');
  const settings = { ...contestOverlayDefaults };
  for (const [key,value] of Object.entries(input)) {
    requireThat(Object.hasOwn(settings,key), 'Неизвестная настройка оверлея конкурса.');
    if (contestOverlayRanges[key]) {
      const [min,max] = contestOverlayRanges[key];
      requireThat(Number.isInteger(value) && value >= min && value <= max, `Настройка ${key}: от ${min} до ${max}.`);
    } else if (typeof settings[key] === 'boolean') requireThat(typeof value === 'boolean', 'Некорректный переключатель конкурса.');
    else requireThat(typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value), 'Укажите цвет в формате HEX.');
    settings[key] = value;
  }
  return settings;
}
export function defaultWidget() {
  return { ...widgetDefaults };
}
export function validateWidget(input) {
  requireThat(input && typeof input === 'object', 'Некорректные настройки виджета.');
  const defaults = defaultWidget();
  const surface = input.surface === 'glass' ? 'accent' : input.surface;
  const radius = input.radius ?? defaults.radius;
  const titleSize = input.titleSize ?? defaults.titleSize;
  const width = input.width ?? defaults.width;
  const opacity = input.opacity ?? defaults.opacity;
  const font = input.font ?? defaults.font;
  const optionStyle = input.optionStyle ?? defaults.optionStyle;
  const optionSize = input.optionSize ?? defaults.optionSize;
  const keywordStyle = input.keywordStyle ?? defaults.keywordStyle;
  const barSize = input.barSize ?? defaults.barSize;
  const showBars = input.showBars ?? defaults.showBars;
  const showVotes = input.showVotes ?? defaults.showVotes;
  const showPercentages = input.showPercentages ?? defaults.showPercentages;
  requireThat(typeof input.accent === 'string' && /^#[0-9a-f]{6}$/iu.test(input.accent), 'Некорректный цвет виджета.');
  requireThat(['solid', 'accent', 'minimal'].includes(surface), 'Некорректный фон виджета.');
  requireThat(['comfortable', 'compact'].includes(input.density), 'Некорректная плотность виджета.');
  requireThat(['small', 'medium', 'large'].includes(radius), 'Некорректное скругление виджета.');
  requireThat(['small', 'medium', 'large'].includes(titleSize), 'Некорректный размер заголовка виджета.');
  requireThat(['narrow', 'medium', 'wide'].includes(width), 'Некорректная ширина виджета.');
  requireThat(Number.isInteger(opacity) && opacity >= 0 && opacity <= 100, 'Прозрачность — от 0 до 100%.');
  requireThat(['geist', 'system', 'mono'].includes(font), 'Некорректный шрифт виджета.');
  requireThat(['rows', 'cards', 'outline', 'fill'].includes(optionStyle), 'Некорректная форма вариантов виджета.');
  requireThat(['small', 'medium', 'large'].includes(optionSize), 'Некорректный размер вариантов виджета.');
  requireThat(['outline', 'filled', 'text'].includes(keywordStyle), 'Некорректный стиль ключевых слов виджета.');
  requireThat(['thin', 'medium', 'thick'].includes(barSize), 'Некорректная толщина полос виджета.');
  requireThat(typeof input.showTimer === 'boolean' && typeof input.showKeywords === 'boolean', 'Некорректные элементы виджета.');
  requireThat(typeof showBars === 'boolean' && typeof showVotes === 'boolean' && typeof showPercentages === 'boolean', 'Некорректные результаты виджета.');
  const settings = { accent: input.accent.toLowerCase(), surface, density: input.density, radius, titleSize, width, opacity, font, optionStyle, optionSize, keywordStyle, barSize, showTimer: input.showTimer, showKeywords: input.showKeywords, showBars, showVotes, showPercentages };
  const numeric = { panelWidth: [280, 1600], padding: [8, 64], gap: [4, 40], cornerRadius: [0, 48], titleFontSize: [16, 64], optionFontSize: [12, 32], barHeight: [2, 20] };
  for (const [key, [minimum, maximum]] of Object.entries(numeric)) {
    if (input[key] === undefined) continue;
    requireThat(Number.isInteger(input[key]) && input[key] >= minimum && input[key] <= maximum, `Некорректный размер виджета: ${key}.`);
    settings[key] = input[key];
  }
  for (const key of ['panelColor', 'textColor', 'mutedColor', 'trackColor']) {
    if (input[key] === undefined) continue;
    requireThat(typeof input[key] === 'string' && /^#[0-9a-f]{6}$/iu.test(input[key]), 'Некорректный цвет виджета.');
    settings[key] = input[key].toLowerCase();
  }
  for (const key of ['showTotal', 'showNumbers', 'highlightWinner']) {
    if (input[key] === undefined) continue;
    requireThat(typeof input[key] === 'boolean', 'Некорректные элементы виджета.');
    settings[key] = input[key];
  }
  if (input.layout !== undefined) {
    requireThat(['vertical', 'horizontal'].includes(input.layout), 'Некорректный формат виджета.');
    settings.layout = input.layout;
  }
  const resolved = resolveWidget(settings);
  requireThat(resolved.layout !== 'horizontal' || resolved.panelWidth >= 640, 'Ширина горизонтального виджета — от 640 px.');
  return resolved;
}
export function validateDraft(input) {
  requireThat(input && typeof input === 'object', 'Некорректный опрос.');
  requireThat(typeof input.question === 'string' && input.question.trim().length > 0 && input.question.trim().length <= 100, 'Вопрос должен содержать от 1 до 100 символов.');
  requireThat(Array.isArray(input.options) && input.options.length >= 2 && input.options.length <= 6, 'Добавьте от 2 до 6 вариантов.');
  const keywords = new Set();
  const options = input.options.map((option, index) => {
    requireThat(option && typeof option.name === 'string' && option.name.trim().length > 0 && option.name.trim().length <= 40, `Заполните название варианта ${index + 1} (до 40 символов).`);
    requireThat(typeof option.word === 'string', `Заполните ключевое слово ${index + 1}.`);
    const word = normalize(option.word);
    requireThat(word.length > 0 && word.length <= 24 && !/\s/u.test(word), 'Ключевое слово: до 24 символов, без пробелов.');
    requireThat(!keywords.has(word), 'Ключевые слова должны различаться.');
    keywords.add(word);
    return { id: String(index + 1), name: option.name.trim(), word };
  });
  requireThat(Number.isInteger(input.duration) && input.duration >= 10 && input.duration <= 3600, 'Длительность — от 10 до 3600 секунд.');
  requireThat(typeof input.secret === 'boolean' && typeof input.allowChange === 'boolean', 'Некорректные настройки опроса.');
  requireThat(input.showOverlay === undefined || typeof input.showOverlay === 'boolean', 'Некорректный режим отображения.');
  requireThat(input.source === undefined || ['test', 'twitch'].includes(input.source), 'Некорректный источник голосов.');
  return { question: input.question.trim(), options, duration: input.duration, secret: input.secret, allowChange: input.allowChange, showOverlay: input.showOverlay ?? true, source: input.source ?? 'test' };
}
export function initialState() {
  return {
    schema: 1, revision: 0, draftRevision: 0,
    draft: { question: 'Во что играем дальше?', options: [{ id: '1', name: 'Minecraft', word: 'майн' }, { id: '2', name: 'Valorant', word: 'вало' }, { id: '3', name: 'Hollow Knight', word: 'холлоу' }], duration: 60, secret: false, allowChange: false, showOverlay: true, source: 'test' },
    presets: [],
    widget: defaultWidget(),
    chatOverlay: { ...chatOverlayDefaults },
    contestOverlay: { ...contestOverlayDefaults },
    poll: null,
  };
}
export function validateStoredState(state) {
  requireThat(state?.schema === 1 && Number.isInteger(state.revision) && state.revision >= 0 && Number.isInteger(state.draftRevision) && state.draftRevision >= 0, 'Формат файла состояния не поддерживается.');
  state.draft = validateDraft(state.draft);
  state.presets ??= [];
  requireThat(Array.isArray(state.presets) && state.presets.length <= 30, 'Повреждена библиотека шаблонов.');
  const presetIds = new Set();
  state.presets = state.presets.map(preset => {
    requireThat(preset && typeof preset.id === 'string' && !presetIds.has(preset.id), 'Повреждены идентификаторы шаблонов.');
    presetIds.add(preset.id);
    return { id: preset.id, name: validatePresetName(preset.name), draft: validateDraft(preset.draft), pinned: preset.pinned === true, createdAt: Number.isFinite(preset.createdAt) ? preset.createdAt : 0, updatedAt: Number.isFinite(preset.updatedAt) ? preset.updatedAt : 0 };
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned));
  state.chatOverlay = validateChatOverlay(state.chatOverlay ?? chatOverlayDefaults);
  state.contestOverlay = validateContestOverlay(state.contestOverlay ?? contestOverlayDefaults);
  state.widget = validateWidget(state.widget ?? defaultWidget());
  if (state.poll) {
    const p = state.poll;
    validateDraft(p);
    p.source ??= 'test';
    p.showOverlay ??= true;
    requireThat(p.source !== 'twitch' || typeof p.broadcasterId === 'string', 'Повреждён канал опроса.');
    requireThat(typeof p.id === 'string' && ['running', 'ended'].includes(p.status) && Number.isFinite(p.deadline) && typeof p.visible === 'boolean' && Number.isFinite(p.startedAt), 'Повреждены данные опроса.');
    requireThat(Array.isArray(p.voters) && Array.isArray(p.events) && p.events.every(e => typeof e === 'string'), 'Повреждены данные голосов.');
    const counts = p.options.map(() => 0), users = new Set();
    for (const entry of p.voters) {
      requireThat(Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && !users.has(entry[0]), 'Повреждены данные зрителей.');
      const index = p.options.findIndex(o => o.id === entry[1]);
      requireThat(index >= 0, 'Голос ссылается на неизвестный вариант.');
      users.add(entry[0]); counts[index]++;
    }
    p.activity ??= [];
    requireThat(Array.isArray(p.activity) && p.activity.length <= 50, 'Повреждена лента голосов.');
    const activityIds = new Set();
    for (const entry of p.activity) {
      requireThat(entry && typeof entry.id === 'string' && entry.id.length > 0 && entry.id.length <= 128 && !activityIds.has(entry.id), 'Повреждена лента голосов.');
      requireThat(typeof entry.viewerName === 'string' && entry.viewerName.length > 0 && entry.viewerName.length <= 50, 'Повреждено имя зрителя.');
      requireThat(p.options.some(option => option.id === entry.optionId) && Number.isFinite(entry.at), 'Повреждена лента голосов.');
      entry.viewerId = typeof entry.viewerId === 'string' && entry.viewerId.length > 0 && entry.viewerId.length <= 128 ? entry.viewerId : `legacy:${entry.id}`;
      requireThat(entry.previousOptionId === undefined || p.options.some(option => option.id === entry.previousOptionId), 'Повреждена смена голоса.');
      requireThat(isTwitchImage(entry.avatarUrl), 'Повреждено изображение зрителя.');
      activityIds.add(entry.id);
    }
    requireThat(p.options.every((o, i) => Number.isInteger(o.votes) && o.votes === counts[i]), 'Нарушена целостность счётчиков голосов.');
  }
  return state;
}
export function publicState(state, now = Date.now()) {
  const result = structuredClone(state);
  if (result.poll) {
    delete result.poll.voters; delete result.poll.events;
    for (const entry of result.poll.activity) delete entry.viewerId;
  }
  result.serverNow = now;
  return result;
}
export function applyCommand(state, command, now = Date.now()) {
  requireThat(command && typeof command.type === 'string', 'Неизвестная команда.');
  const next = structuredClone(state);
  let changed = false;
  let outcome = 'ok';
  const p = next.poll;
  const queuedTwitchVote = command.type === 'vote'
    && p?.status === 'running'
    && p.source === 'twitch'
    && command.source === 'twitch'
    && Number.isFinite(command.sentAt)
    && command.sentAt < p.deadline;
  // Deadline is authoritative, including commands arriving between timer ticks.
  // A Twitch message can already be in our durable queue when processing crosses
  // the deadline. Its EventSub timestamp remains authoritative for eligibility.
  if (p?.status === 'running' && now >= p.deadline && !queuedTwitchVote) { p.status = 'ended'; p.endedAt = p.deadline; changed = true; }
  switch (command.type) {
    case 'tick': break;
    case 'save-draft':
    case 'start': {
      requireThat(command.draftRevision === next.draftRevision, 'Опрос изменён в другой панели. Загрузите актуальную версию.', 409);
      requireThat(next.poll?.status !== 'running', 'Сначала завершите текущий опрос.', 409);
      const draft = validateDraft(command.draft);
      next.draft = draft;
      next.draftRevision++;
      if (command.type === 'start') {
        requireThat(draft.source !== 'twitch' || typeof command.broadcasterId === 'string' && command.broadcasterId.length > 0, 'Сначала подключите Twitch.');
        next.poll = { ...structuredClone(draft), broadcasterId: draft.source === 'twitch' ? command.broadcasterId : null, id: randomUUID(), status: 'running', visible: draft.showOverlay, startedAt: now, deadline: now + draft.duration * 1000, endedAt: null, options: draft.options.map(o => ({ ...o, votes: 0 })), voters: [], events: [], activity: [] };
      }
      changed = true;
      break;
    }
    case 'preset-create': {
      requireThat(next.presets.length < 30, 'Можно сохранить не больше 30 шаблонов.');
      const draft = validateDraft(command.draft);
      next.presets.push({ id: randomUUID(), name: validatePresetName(command.name), draft, pinned: false, createdAt: now, updatedAt: now });
      changed = true;
      break;
    }
    case 'preset-update': {
      const preset = next.presets.find(item => item.id === command.presetId);
      requireThat(preset, 'Шаблон уже удалён.', 409);
      if (command.name !== undefined) preset.name = validatePresetName(command.name);
      if (command.draft !== undefined) preset.draft = validateDraft(command.draft);
      requireThat(command.name !== undefined || command.draft !== undefined, 'Нет изменений для шаблона.');
      preset.updatedAt = now; changed = true;
      break;
    }
    case 'preset-delete': {
      const index = next.presets.findIndex(item => item.id === command.presetId);
      requireThat(index >= 0, 'Шаблон уже удалён.', 409);
      next.presets.splice(index, 1); changed = true;
      break;
    }
    case 'preset-move': {
      requireThat(command.direction === -1 || command.direction === 1, 'Некорректное перемещение шаблона.');
      const index = next.presets.findIndex(item => item.id === command.presetId);
      requireThat(index >= 0, 'Шаблон уже удалён.', 409);
      const target = index + command.direction;
      if (target >= 0 && target < next.presets.length && next.presets[target].pinned === next.presets[index].pinned) {
        [next.presets[index], next.presets[target]] = [next.presets[target], next.presets[index]]; changed = true;
      }
      break;
    }
    case 'preset-toggle-pin': {
      requireThat(typeof command.pinned === 'boolean', 'Некорректное закрепление шаблона.');
      const index = next.presets.findIndex(item => item.id === command.presetId);
      requireThat(index >= 0, 'Шаблон уже удалён.', 409);
      const [preset] = next.presets.splice(index, 1);
      preset.pinned = command.pinned;
      const pinnedCount = next.presets.filter(item => item.pinned).length;
      next.presets.splice(pinnedCount, 0, preset);
      changed = true;
      break;
    }
    case 'preset-reorder': {
      requireThat(command.position === 'before' || command.position === 'after', 'Некорректное перемещение шаблона.');
      const index = next.presets.findIndex(item => item.id === command.presetId);
      const targetIndex = next.presets.findIndex(item => item.id === command.targetId);
      requireThat(index >= 0 && targetIndex >= 0, 'Шаблон уже удалён.', 409);
      requireThat(next.presets[index].pinned === next.presets[targetIndex].pinned, 'Закреплённые шаблоны перемещаются внутри своей группы.');
      if (index !== targetIndex) {
        const [preset] = next.presets.splice(index, 1);
        const destination = next.presets.findIndex(item => item.id === command.targetId);
        next.presets.splice(destination + (command.position === 'after' ? 1 : 0), 0, preset);
        changed = true;
      }
      break;
    }
    case 'preset-apply': {
      requireThat(command.draftRevision === next.draftRevision, 'Опрос изменён в другой панели. Загрузите актуальную версию.', 409);
      requireThat(next.poll?.status !== 'running', 'Сначала завершите текущий опрос.', 409);
      const preset = next.presets.find(item => item.id === command.presetId);
      requireThat(preset, 'Шаблон уже удалён.', 409);
      if (next.poll?.status === 'ended') next.poll = null;
      next.draft = structuredClone(preset.draft); next.draftRevision++; changed = true;
      outcome = preset.name;
      break;
    }
    case 'preset-next': {
      requireThat(next.poll?.status !== 'running', 'Сначала завершите текущий опрос.', 409);
      requireThat(next.presets.length > 0, 'Сначала создайте хотя бы один шаблон.');
      const serializedDraft = JSON.stringify(next.draft);
      const current = next.presets.findIndex(preset => JSON.stringify(preset.draft) === serializedDraft);
      const preset = next.presets[(current + 1) % next.presets.length];
      next.draft = structuredClone(preset.draft);
      next.draftRevision++;
      changed = true;
      outcome = preset.name;
      break;
    }
    case 'settings-import': {
      requireThat(command.draftRevision === next.draftRevision, 'Опрос изменён в другой панели. Загрузите актуальную версию.', 409);
      requireThat(!next.poll, 'Сначала закройте текущий опрос.', 409);
      const settings = command.settings;
      requireThat(settings && typeof settings === 'object' && settings.schema === 1 && ['projectCHAT', 'Vela', 'Cue'].includes(settings.app), 'Этот файл настроек не поддерживается.');
      requireThat(Array.isArray(settings.presets) && settings.presets.length <= 30, 'В файле должно быть не больше 30 шаблонов.');
      next.draft = validateDraft(settings.draft);
      next.presets = settings.presets.map(preset => ({
        id: randomUUID(),
        name: validatePresetName(preset?.name),
        draft: validateDraft(preset?.draft),
        pinned: preset?.pinned === true,
        createdAt: now,
        updatedAt: now,
      }));
      next.widget = validateWidget(settings.widget ?? defaultWidget());
      next.chatOverlay = validateChatOverlay(settings.chatOverlay ?? chatOverlayDefaults);
      next.contestOverlay = validateContestOverlay(settings.contestOverlay ?? contestOverlayDefaults);
      next.draftRevision++;
      changed = true;
      break;
    }
    case 'contest-overlay-update': {
      requireThat(command.settings && typeof command.settings === 'object' && !Array.isArray(command.settings), 'Некорректные настройки конкурса.');
      next.contestOverlay = validateContestOverlay({ ...next.contestOverlay, ...command.settings });
      changed = true;
      break;
    }
    case 'chat-overlay-update': {
      requireThat(command.settings && typeof command.settings === 'object' && !Array.isArray(command.settings), 'Некорректные настройки чата.');
      next.chatOverlay = validateChatOverlay({ ...next.chatOverlay, ...command.settings });
      changed = true;
      break;
    }
    case 'widget-update': {
      next.widget = validateWidget(command.widget);
      changed = true;
      break;
    }
    case 'activity-avatar': {
      requireThat(p && command.pollId === p.id, 'Этот опрос уже сменился.', 409);
      requireThat(typeof command.eventId === 'string' && isTwitchImage(command.avatarUrl), 'Некорректное изображение зрителя.');
      const entry = p.activity.find(item => item.id === command.eventId);
      if (entry && entry.avatarUrl !== command.avatarUrl) { entry.avatarUrl = command.avatarUrl; changed = true; }
      break;
    }
    case 'finish':
    case 'extend':
    case 'poll-rules':
    case 'option-add':
    case 'visibility':
    case 'vote':
    case 'clear': {
      requireThat(p && command.pollId === p.id, 'Этот опрос уже сменился. Обновите панель.', 409);
      if (command.type === 'visibility') {
        requireThat(typeof command.visible === 'boolean', 'Некорректная видимость.');
        changed ||= p.visible !== command.visible;
        p.visible = command.visible;
      } else if (command.type === 'clear') {
        requireThat(p.status !== 'running', 'Сначала завершите текущий опрос.', 409);
        next.poll = null; changed = true;
      } else if (command.type === 'finish') {
        if (p.status === 'running') { p.status = 'ended'; p.endedAt = now; changed = true; }
      } else if (command.type === 'extend') {
        requireThat(p.status === 'running', 'Опрос уже завершён.', 409);
        requireThat(p.deadline + 30000 - p.startedAt <= 7200000, 'Максимальная длительность с продлениями — 2 часа.');
        p.deadline += 30000; changed = true;
      } else if (command.type === 'poll-rules') {
        requireThat(p.status === 'running', 'Опрос уже завершён.', 409);
        requireThat(command.secret !== undefined || command.allowChange !== undefined, 'Нет изменений правил.');
        if (command.secret !== undefined) {
          requireThat(typeof command.secret === 'boolean', 'Некорректное правило отображения результатов.');
          changed ||= p.secret !== command.secret;
          p.secret = command.secret;
        }
        if (command.allowChange !== undefined) {
          requireThat(typeof command.allowChange === 'boolean', 'Некорректное правило переголосования.');
          changed ||= p.allowChange !== command.allowChange;
          p.allowChange = command.allowChange;
        }
      } else if (command.type === 'option-add') {
        requireThat(p.status === 'running', 'Опрос уже завершён.', 409);
        requireThat(p.options.length < 6, 'В опросе уже максимальное число вариантов.');
        requireThat(typeof command.name === 'string' && command.name.trim().length > 0 && command.name.trim().length <= 40, 'Название варианта должно содержать от 1 до 40 символов.');
        requireThat(typeof command.word === 'string', 'Добавьте ключевое слово.');
        const word = normalize(command.word);
        requireThat(word.length > 0 && word.length <= 24 && !/\s/u.test(word), 'Ключевое слово: до 24 символов, без пробелов.');
        requireThat(!p.options.some(option => option.word === word), 'Такое ключевое слово уже используется.');
        p.options.push({ id: randomUUID(), name: command.name.trim(), word, votes: 0 });
        p.allowChange = true;
        p.deadline = Math.min(p.startedAt + 7200000, Math.max(p.deadline, now + 30000));
        changed = true;
      } else {
        if (p.status !== 'running') { outcome = 'closed'; break; }
        if ((command.source ?? 'test') !== (p.source ?? 'test')) { outcome = 'wrong-source'; break; }
        if (p.source === 'twitch' && (command.broadcasterId !== p.broadcasterId || !Number.isFinite(command.sentAt) || command.sentAt < p.startedAt || command.sentAt >= p.deadline)) { outcome = 'wrong-channel-or-time'; break; }
        requireThat(typeof command.viewerId === 'string' && command.viewerId.length > 0 && command.viewerId.length <= 128 && typeof command.eventId === 'string' && command.eventId.length > 0 && command.eventId.length <= 128 && typeof command.message === 'string' && command.message.length <= 500, 'Некорректное сообщение.');
        if (p.source === 'twitch') requireThat(typeof command.viewerName === 'string' && command.viewerName.length > 0 && command.viewerName.length <= 50, 'Некорректное имя зрителя.');
        if (p.events.includes(command.eventId)) { outcome = 'duplicate-event'; break; }
        const option = p.options.find(o => o.word === normalize(command.message));
        if (!option) { outcome = 'unmatched'; break; }
        // Remember no-op matches too, so their redelivery cannot undo a later choice.
        p.events.push(command.eventId); changed = true;
        const existing = p.voters.find(entry => entry[0] === command.viewerId);
        if (existing && (!p.allowChange || existing[1] === option.id)) { outcome = 'already-voted'; break; }
        const previousOptionId = existing?.[1];
        if (existing) { p.options.find(o => o.id === existing[1]).votes--; existing[1] = option.id; }
        else p.voters.push([command.viewerId, option.id]);
        option.votes++; outcome = existing ? 'changed' : 'counted';
        const activityName = typeof command.viewerName === 'string' && command.viewerName.length > 0 && command.viewerName.length <= 50 ? command.viewerName : '';
        const activityAt = Number.isFinite(command.sentAt) ? command.sentAt : now;
        if (p.source === 'twitch' || activityName) {
          const previousEntry = p.activity.find(entry => entry.viewerId === command.viewerId);
          if (previousEntry) p.activity.splice(p.activity.indexOf(previousEntry), 1);
          p.activity.push({ id: command.eventId, viewerId: command.viewerId, viewerName: activityName, avatarUrl: previousEntry?.avatarUrl || '', optionId: option.id, ...(existing ? { previousOptionId } : {}), at: activityAt });
          if (p.activity.length > 50) p.activity.splice(0, p.activity.length - 50);
        }
      }
      break;
    }
    default: throw new PollError('Неизвестная команда.');
  }
  if (next.poll?.status === 'running' && now >= next.poll.deadline) {
    next.poll.status = 'ended';
    next.poll.endedAt = next.poll.deadline;
    changed = true;
  }
  if (changed) next.revision++;
  return { state: changed ? next : state, changed, outcome };
}
