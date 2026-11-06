export const widgetIds = [
  "activity",
  "timer",
  "counter",
  "notes",
  "todos",
  "archive",
] as const
export type WidgetId = (typeof widgetIds)[number]

export type TimerState = {
  duration: number
  remaining: number
  deadline: number | null
}

export const maxTimerDuration = 24 * 60 * 60

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
    (timer.duration ?? 0) < 1 ||
    (timer.duration ?? 0) > maxTimerDuration ||
    !Number.isInteger(timer.remaining) ||
    (timer.remaining ?? -1) < 0 ||
    (timer.remaining ?? 0) > maxTimerDuration
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
  if (!filtered.length && value.length) return [...widgetIds]
  // The live console is essential: always restore it at the top, even from
  // layouts saved before it became a permanent block.
  return ["activity", ...filtered.filter((id) => id !== "activity")]
}

export function restoreDashboardBlocks(value: unknown): WidgetId[] {
  if (
    value &&
    typeof value === "object" &&
    "version" in value &&
    value.version === 2 &&
    "order" in value
  )
    return normalizeWidgetOrder(value.order)
  const order = normalizeWidgetOrder(value)
  // The old notes block also held tasks; keep both visible after splitting it.
  if (
    Array.isArray(value) &&
    order.includes("notes") &&
    !order.includes("todos")
  )
    order.splice(order.indexOf("notes") + 1, 0, "todos")
  return order
}

export function reorderDashboardBlock(
  order: WidgetId[],
  id: WidgetId,
  over: WidgetId
): WidgetId[] {
  const next = normalizeWidgetOrder(order)
  const from = next.indexOf(id),
    to = next.indexOf(over)
  if (
    id === "activity" ||
    over === "activity" ||
    from < 1 ||
    to < 1 ||
    from === to
  )
    return next
  next.splice(from, 1)
  next.splice(to, 0, id)
  return next
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
  const remaining = Math.min(
    maxTimerDuration,
    timerRemaining(timer, now) + seconds
  )
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

// Keep entered digits in place; add separators as each pair fills from the left.
export function formatTimerInput(value: string): string {
  const text = value.replace(/[^\d:]/g, "")
  if (!text.includes(":")) {
    return (
      text
        .slice(0, 6)
        .match(/\d{1,2}/g)
        ?.join(":") || ""
    )
  }
  const parts = text.split(":").slice(0, 3)
  const last = parts.length - 1
  if (parts[last].length > 2 && parts.length < 3) {
    parts.push(parts[last].slice(2, 4))
    parts[last] = parts[last].slice(0, 2)
  }
  return parts
    .map((part, index) => part.slice(0, index === 0 ? 3 : 2))
    .join(":")
}

// The clock always begins with hours; omitted trailing groups mean zero.
export function parseTimerDuration(value: string): number | null {
  const text = value.trim()
  if (!/^\d{1,2}(?::\d{1,2}){0,2}$/.test(text)) return null
  const parts = text.split(":").map(Number)
  if (parts.length > 1 && parts.slice(1).some((part) => part > 59)) return null
  const seconds = parts[0] * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
  return seconds >= 1 && seconds <= maxTimerDuration ? seconds : null
}
