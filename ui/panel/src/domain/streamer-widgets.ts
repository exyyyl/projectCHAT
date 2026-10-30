export const widgetIds = [
  "activity",
  "timer",
  "counter",
  "notes",
  "archive",
] as const
export type WidgetId = (typeof widgetIds)[number]

export type TimerState = {
  duration: number
  remaining: number
  deadline: number | null
}

export const defaultTimer: TimerState = {
  duration: 300,
  remaining: 300,
  deadline: null,
}

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
  if (
    !Number.isInteger(timer.duration) ||
    (timer.duration ?? 0) < 10 ||
    (timer.duration ?? 0) > 36000 ||
    !Number.isInteger(timer.remaining) ||
    (timer.remaining ?? -1) < 0 ||
    (timer.remaining ?? 0) > 36000
  )
    return defaultTimer
  if (
    timer.deadline !== null &&
    (!Number.isSafeInteger(timer.deadline) || (timer.deadline ?? 0) < 0)
  )
    return defaultTimer
  const normalized = timer as TimerState
  return normalized.deadline !== null && normalized.deadline <= now
    ? { ...normalized, remaining: 0, deadline: null }
    : normalized
}

export function normalizeWidgetOrder(value: unknown): WidgetId[] {
  if (!Array.isArray(value)) return [...widgetIds]
  const filtered = [
    ...new Set(value.filter((id): id is WidgetId => widgetIds.includes(id))),
  ]
  return filtered.length || value.length === 0 ? filtered : [...widgetIds]
}

export type CounterState = {
  label: string
  value: number
  step: number
  reset: number
}
export const defaultCounter: CounterState = {
  label: "Счётчик",
  value: 0,
  step: 1,
  reset: 0,
}
export const counterValue = (value: number) =>
  Math.max(-1_000_000, Math.min(1_000_000, Math.round(value)))
export function normalizeCounter(value: unknown): CounterState {
  if (!value || typeof value !== "object") return defaultCounter
  const saved = value as Partial<CounterState>
  return {
    label:
      typeof saved.label === "string"
        ? saved.label.slice(0, 32)
        : defaultCounter.label,
    value: Number.isSafeInteger(saved.value) ? counterValue(saved.value!) : 0,
    step:
      Number.isSafeInteger(saved.step) &&
      saved.step! >= 1 &&
      saved.step! <= 100000
        ? saved.step!
        : 1,
    reset: Number.isSafeInteger(saved.reset) ? counterValue(saved.reset!) : 0,
  }
}

export function extendTimer(
  timer: TimerState,
  seconds: number,
  now: number
): TimerState {
  const remaining = Math.min(36000, timerRemaining(timer, now) + seconds)
  return {
    ...timer,
    remaining,
    deadline: timer.deadline === null ? null : now + remaining * 1000,
  }
}

export const activityIds = [
  "polls",
  "contests",
  "decision-wheel",
  "presets",
  "widget",
] as const
export type ActivityId = (typeof activityIds)[number]
export function normalizeActivities(value: unknown): ActivityId[] {
  if (!Array.isArray(value)) return ["polls", "contests", "decision-wheel"]
  return [
    ...new Set(
      value.filter((id): id is ActivityId => activityIds.includes(id))
    ),
  ]
}
