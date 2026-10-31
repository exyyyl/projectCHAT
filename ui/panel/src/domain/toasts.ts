export type ToastTone = "default" | "success" | "warning" | "error"
export type ToastInput = {
  message: string
  description?: string
  tone?: ToastTone
  duration?: number
}
export type ToastItem = ToastInput & {
  id: number
  count: number
  leaving: boolean
}

export function createToastStore({
  schedule = setTimeout,
  cancel = clearTimeout,
} = {}) {
  let items: ToastItem[] = []
  let nextId = 0
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  const listeners = new Set<() => void>()
  const publish = () => {
    for (const listener of listeners) listener()
  }
  const clearTimer = (id: number) => {
    const timer = timers.get(id)
    if (timer !== undefined) cancel(timer)
    timers.delete(id)
  }
  const remove = (id: number) => {
    clearTimer(id)
    items = items.filter((item) => item.id !== id)
    publish()
  }
  const finishDismiss = (id: number) => {
    if (items.find((item) => item.id === id)?.leaving) remove(id)
  }
  const dismiss = (id: number) => {
    if (!items.some((item) => item.id === id && !item.leaving)) return
    clearTimer(id)
    items = items.map((item) =>
      item.id === id ? { ...item, leaving: true } : item
    )
    timers.set(
      id,
      schedule(() => finishDismiss(id), 450)
    )
    publish()
  }

  return {
    snapshot: () => items,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    show(input: string | ToastInput) {
      const toast = typeof input === "string" ? { message: input } : input
      const tone = toast.tone ?? "default"
      const existing = items.find(
        (item) =>
          item.message === toast.message && (item.tone ?? "default") === tone
      )
      const id = existing?.id ?? ++nextId
      clearTimer(id)
      if (existing) {
        items = items.map((item) =>
          item.id === id
            ? { ...item, ...toast, count: item.count + 1, leaving: false }
            : item
        )
      } else {
        items = [...items, { ...toast, id, count: 1, leaving: false }]
        for (const evicted of items.slice(0, -3)) clearTimer(evicted.id)
        items = items.slice(-3)
      }
      timers.set(
        id,
        schedule(() => dismiss(id), toast.duration ?? 4200)
      )
      publish()
    },
    dismiss,
    finishDismiss,
    dispose() {
      for (const id of timers.keys()) clearTimer(id)
    },
  }
}
