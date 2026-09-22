import { randomInt as secureRandomInt } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PollError } from './polls.mjs';

const emptyState = now => ({
  schema: 1,
  revision: 0,
  serverNow: now(),
  contest: null,
});

const cleanText = (value, limit) => typeof value === 'string'
  ? value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, limit)
  : '';

const normalizeKeyword = value => cleanText(value, 32).toLocaleLowerCase('ru');
const audienceRoles = ['viewer', 'subscriber', 'vip', 'moderator'];
const demoNames = ['PixelFox', 'NightOwl', 'LimeCat', 'MoonByte', 'Kira', 'NoScope', 'SoftPanda', 'Nova'];
const demoReplies = ['Я здесь!', 'Вижу сообщение', 'Да, это я', 'Спасибо!', 'На месте 👋'];

function validateSetup(setup) {
  const mode = setup?.mode === 'active' ? 'active' : 'keyword';
  const keyword = cleanText(setup?.keyword, 32);
  const duration = Number(setup?.duration);
  if (mode === 'keyword' && !keyword) throw new PollError('Добавьте слово для участия.');
  if (mode === 'keyword' && /\s/u.test(keyword)) throw new PollError('Слово для участия должно быть без пробелов.');
  if (!Number.isInteger(duration) || duration < 10 || duration > 3600) throw new PollError('Укажите время от 10 до 3600 секунд.');
  const allowedRoles = Array.isArray(setup?.allowedRoles)
    ? [...new Set(setup.allowedRoles.filter(role => audienceRoles.includes(role)))]
    : [...audienceRoles];
  if (!allowedRoles.length) throw new PollError('Выберите хотя бы одну группу зрителей.');
  return {
    mode,
    keyword: mode === 'keyword' ? keyword : '',
    duration,
    source: setup?.source === 'test' ? 'test' : 'twitch',
    antiSpam: mode === 'keyword' && setup?.antiSpam === true,
    allowedRoles,
  };
}

const migrateContest = contest => {
  if (!contest) return null;
  const stored = { ...contest };
  delete stored.title;
  return {
    ...stored,
    mode: contest.mode === 'active' ? 'active' : 'keyword',
    antiSpam: contest.antiSpam === true,
    allowedRoles: Array.isArray(contest.allowedRoles) && contest.allowedRoles.some(role => audienceRoles.includes(role))
      ? [...new Set(contest.allowedRoles.filter(role => audienceRoles.includes(role)))]
      : [...audienceRoles],
    winnerHistory: Array.isArray(contest.winnerHistory)
      ? contest.winnerHistory.filter(id => typeof id === 'string')
      : contest.winner?.id ? [contest.winner.id] : [],
    participants: Array.isArray(contest.participants)
      ? contest.participants.map(participant => ({
        ...participant,
        login: cleanText(participant.login || participant.name, 50),
        roles: Array.isArray(participant.roles) && participant.roles.some(role => audienceRoles.includes(role))
          ? [...new Set(participant.roles.filter(role => audienceRoles.includes(role)))]
          : ['viewer'],
        eligible: participant.eligible !== false,
        excludedReason: participant.eligible === false ? cleanText(participant.excludedReason, 20) || 'manual' : '',
      }))
      : [],
  };
};

export async function createContest(filename, { now = Date.now, randomInt = secureRandomInt } = {}) {
  let state = emptyState(now);
  try {
    const saved = JSON.parse(await readFile(filename, 'utf8'));
    if (saved?.schema === 1 && Number.isInteger(saved.revision))
      state = { ...saved, contest: migrateContest(saved.contest) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let work = Promise.resolve();
  let disk = Promise.resolve();
  const listeners = new Set();
  const snapshot = () => structuredClone({ ...state, serverNow: now() });
  const publish = () => {
    const value = snapshot();
    for (const listener of listeners) {
      try { listener(value); } catch {}
    }
  };
  const persist = () => {
    const data = JSON.stringify(state, null, 2);
    const task = disk.then(async () => {
      await mkdir(dirname(filename), { recursive: true });
      await writeFile(`${filename}.tmp`, data, { mode: 0o600 });
      await rename(`${filename}.tmp`, filename);
    });
    disk = task.catch(() => {});
    return task;
  };
  const commit = async contest => {
    state = { ...state, revision: state.revision + 1, serverNow: now(), contest };
    await persist();
    publish();
    return snapshot();
  };
  const serial = task => {
    const result = work.then(task);
    work = result.catch(() => {});
    return result;
  };

  const command = command => serial(async () => {
    const current = state.contest;
    if (command.type === 'start') {
      if (current && current.status !== 'finished') throw new PollError('Конкурс уже запущен.', 409);
      const setup = validateSetup(command.setup);
      const broadcasterId = cleanText(command.broadcasterId, 100);
      if (setup.source === 'twitch' && !broadcasterId) throw new PollError('Сначала подключите Twitch.', 409);
      const startedAt = now();
      return commit({
        id: crypto.randomUUID(),
        status: 'collecting',
        ...setup,
        keywordNormalized: normalizeKeyword(setup.keyword),
        broadcasterId,
        startedAt,
        deadline: startedAt + setup.duration * 1000,
        participants: [],
        winner: null,
        winnerMessages: [],
        winnerHistory: [],
      });
    }
    if (!current || command.contestId !== current.id) throw new PollError('Конкурс уже изменился.', 409);
    if (command.type === 'demo') {
      if (current.source !== 'test') throw new PollError('Демо доступно только в тестовом конкурсе.', 409);
      if (current.status === 'collecting') {
        const usedNames = new Set(current.participants.map(participant => participant.name));
        const available = demoNames.filter(name => !usedNames.has(name));
        const name = available.length ? available[randomInt(available.length)] : `Viewer ${current.participants.length + 1}`;
        const participant = {
          id: `demo:${crypto.randomUUID()}`,
          name,
          login: name,
          messageId: crypto.randomUUID(),
          message: current.mode === 'keyword' ? current.keyword : demoReplies[randomInt(demoReplies.length)],
          joinedAt: now(),
          roles: [current.allowedRoles[0] || 'viewer'],
          eligible: true,
          excludedReason: '',
        };
        return commit({ ...current, participants: [...current.participants, participant] });
      }
      if (current.status === 'winner') {
        const entry = { id: crypto.randomUUID(), text: demoReplies[randomInt(demoReplies.length)], at: now() };
        return commit({ ...current, winnerMessages: [...current.winnerMessages, entry].slice(-50) });
      }
      return snapshot();
    }
    if (command.type === 'close') {
      if (current.status !== 'collecting') throw new PollError('Набор уже завершён.', 409);
      return commit({ ...current, status: 'ready', closedAt: now() });
    }
    if (command.type === 'eligibility') {
      if (!['collecting', 'ready'].includes(current.status)) throw new PollError('Состав участников уже зафиксирован.', 409);
      if (typeof command.participantId !== 'string' || typeof command.eligible !== 'boolean') throw new PollError('Некорректный участник.');
      let found = false;
      const participants = current.participants.map(participant => {
        if (participant.id !== command.participantId) return participant;
        found = true;
        return {
          ...participant,
          eligible: command.eligible,
          excludedReason: command.eligible ? '' : 'manual',
        };
      });
      if (!found) throw new PollError('Участник не найден.', 404);
      return commit({ ...current, participants });
    }
    if (command.type === 'clear') {
      if (!['collecting', 'ready'].includes(current.status)) throw new PollError('Состав участников уже зафиксирован.', 409);
      return commit({ ...current, participants: [] });
    }
    if (command.type === 'draw') {
      if (!['collecting', 'ready', 'winner'].includes(current.status)) throw new PollError('Конкурс уже завершён.', 409);
      const used = new Set(current.winnerHistory || []);
      const candidates = current.participants.filter(participant => participant.eligible !== false && !used.has(participant.id));
      if (!candidates.length)
        throw new PollError(used.size ? 'Все допущенные участники уже выбирались.' : 'Пока нет допущенных участников.', 409);
      const winner = candidates[randomInt(candidates.length)];
      return commit({
        ...current,
        status: 'winner',
        winner,
        winnerMessages: [{ id: winner.messageId, text: winner.message, at: winner.joinedAt }],
        winnerHistory: [...used, winner.id],
        closedAt: current.closedAt || now(),
        drawnAt: now(),
      });
    }
    if (command.type === 'finish') return commit({ ...current, status: 'finished', finishedAt: now() });
    if (command.type === 'reset') return commit(null);
    throw new PollError('Неизвестная команда конкурса.');
  });

  const chat = message => serial(async () => {
    const current = state.contest;
    if (!current || message.broadcasterId !== current.broadcasterId) return snapshot();
    if (current.status === 'collecting') {
      if (message.sentAt < current.startedAt || message.sentAt >= current.deadline) return snapshot();
      const text = cleanText(message.text, 300);
      if (!text) return snapshot();
      if (current.mode === 'keyword' && normalizeKeyword(text) !== current.keywordNormalized) return snapshot();
      const roles = Array.isArray(message.roles) && message.roles.some(role => audienceRoles.includes(role))
        ? [...new Set(message.roles.filter(role => audienceRoles.includes(role)))]
        : ['viewer'];
      if (!roles.some(role => current.allowedRoles.includes(role))) return snapshot();
      const existingIndex = current.participants.findIndex(participant => participant.id === message.viewerId);
      if (existingIndex >= 0) {
        const existing = current.participants[existingIndex];
        if (current.mode !== 'keyword' || !current.antiSpam || existing.eligible === false) return snapshot();
        const participants = [...current.participants];
        participants[existingIndex] = { ...existing, eligible: false, excludedReason: 'repeat' };
        return commit({ ...current, participants });
      }
      const participant = {
        id: message.viewerId,
        name: cleanText(message.viewerName, 50),
        login: cleanText(message.viewerLogin || message.viewerName, 50),
        messageId: message.eventId,
        message: text,
        joinedAt: message.sentAt,
        roles,
        eligible: true,
        excludedReason: '',
      };
      return commit({ ...current, participants: [...current.participants, participant].slice(-5000) });
    }
    if (current.status === 'winner' && current.winner?.id === message.viewerId) {
      if (current.winnerMessages.some(entry => entry.id === message.eventId)) return snapshot();
      const entry = { id: message.eventId, text: cleanText(message.text, 300), at: message.sentAt };
      if (!entry.text) return snapshot();
      return commit({ ...current, winnerMessages: [...current.winnerMessages, entry].slice(-50) });
    }
    return snapshot();
  });

  const tick = () => serial(async () => {
    const current = state.contest;
    if (current?.status === 'collecting' && now() >= current.deadline)
      return commit({ ...current, status: 'ready', closedAt: now() });
    return snapshot();
  });

  return {
    snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    command,
    chat,
    tick,
    async drain() { await work; await disk; },
  };
}
