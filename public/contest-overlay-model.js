export const contestOverlayDefaults = Object.freeze({ enabled: true, font: 'geist', layout: 'stacked', alignment: 'auto', width: 480, fontSize: 24, radius: 18, opacity: 92, accentColor: '#c7ed98', backgroundColor: '#141416', textColor: '#f4f4f5', showTimer: true, showCount: true, showRecent: true });
export const contestOverlayRanges = Object.freeze({ width: [280, 1200], fontSize: [16, 40], radius: [0, 40], opacity: [0, 100] });

// The broadcast feed must never include chat messages, role data or internal IDs.
export function publicContest(contest) {
  if (!contest) return null;
  const participants = Array.isArray(contest.participants) ? contest.participants.filter(item => item.eligible !== false) : [];
  return {
    id: contest.id, status: contest.status, mode: contest.mode,
    keyword: contest.mode === 'keyword' ? contest.keyword : '',
    numberMin: contest.mode === 'number' ? contest.numberMin : null,
    numberMax: contest.mode === 'number' ? contest.numberMax : null,
    winningNumber: contest.mode === 'number' && contest.status !== 'collecting' ? contest.winningNumber : null,
    deadline: Number.isFinite(contest.deadline) ? contest.deadline : 0, drawnAt: Number.isFinite(contest.drawnAt) ? contest.drawnAt : 0,
    participantCount: participants.length,
    recentNames: participants.slice(-8).map(item => item.name),
    winner: contest.winner ? { name: contest.winner.name } : null,
  };
}
export function contestPresentation(contest, now) {
  if (!contest) return { phase: 'idle', seconds: 0, name: '' };
  const seconds = Math.max(0, Math.ceil((contest.deadline - now) / 1000));
  const elapsed = now - contest.drawnAt;
  const rolling = contest.status === 'winner' && contest.mode !== 'number' && elapsed >= 0 && elapsed < 2400 && contest.recentNames.length > 0;
  const name = rolling ? contest.recentNames[Math.floor(elapsed / 120) % contest.recentNames.length] : contest.winner?.name || '';
  return { phase: rolling ? 'drawing' : contest.winner ? 'winner' : contest.status, seconds, name };
}
