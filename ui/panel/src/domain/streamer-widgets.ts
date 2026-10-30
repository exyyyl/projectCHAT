export const widgetIds = ["activity", "timer", "counter", "notes", "archive"] as const
export type WidgetId = (typeof widgetIds)[number]

export type TimerState = {
  duration: number
  remaining: number
  deadline: number | null
}

export const defaultTimer: TimerState = { duration: 300, remaining: 300, deadline: null }

export function timerRemaining(timer: TimerState, now: number) {
  return timer.deadline === null
    ? timer.remaining
    : Math.max(0, Math.ceil((timer.deadline - now) / 1000))
}

export function startTimer(timer: TimerState, now: number): TimerState {
  const remaining = timerRemaining(timer, now) || timer.duration
  return { ...timer, remaining, deadline: now + remaining * 1000 }
}

export function pauseTimer(timer: TimerState, now: number): TimerState {
  return { ...timer, remaining: timerRemaining(timer, now), deadline: null }
}

export function resetTimer(timer: TimerState): TimerState {
  return { ...timer, remaining: timer.duration, deadline: null }
}

export function normalizeTimer(value: unknown, now: number): TimerState {
  if (!value || typeof value !== "object") return defaultTimer
  const timer = value as Partial<TimerState>
  if (!Number.isInteger(timer.duration) || (timer.duration ?? 0) < 10 || (timer.duration ?? 0) > 36000 || !Number.isInteger(timer.remaining) || (timer.remaining ?? -1) < 0 || (timer.remaining ?? 0) > 36000) return defaultTimer
  if (timer.deadline !== null && (!Number.isSafeInteger(timer.deadline) || (timer.deadline ?? 0) < 0)) return defaultTimer
  const normalized = timer as TimerState
  return normalized.deadline !== null && normalized.deadline <= now
    ? { ...normalized, remaining: 0, deadline: null }
    : normalized
}

export function normalizeWidgetOrder(value: unknown): WidgetId[] {
  if (!Array.isArray(value)) return [...widgetIds]
  const filtered = [...new Set(value.filter((id): id is WidgetId => widgetIds.includes(id)))]
  return filtered.length || value.length === 0 ? filtered : [...widgetIds]
}
