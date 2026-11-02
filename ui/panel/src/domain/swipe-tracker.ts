type SwipeCallbacks = {
  move: (event: PointerEvent) => void
  release: (event: PointerEvent) => void
  cancel: () => void
}

// Capture is an optimization, not the lifetime of a gesture. Window listeners
// keep tracking when a handle transfers capture, or a row loses capture mid-drag.
export function trackPointerSwipe(
  target: EventTarget,
  pointerId: number,
  callbacks: SwipeCallbacks
): () => void {
  let active = true
  const stop = () => {
    if (!active) return
    active = false
    target.removeEventListener("pointermove", move, true)
    target.removeEventListener("pointerup", release, true)
    target.removeEventListener("pointercancel", cancelPointer, true)
    target.removeEventListener("blur", blur, true)
  }
  const move = (event: Event) => {
    if (active && (event as PointerEvent).pointerId === pointerId)
      callbacks.move(event as PointerEvent)
  }
  const release = (event: Event) => {
    if (!active || (event as PointerEvent).pointerId !== pointerId) return
    stop()
    callbacks.release(event as PointerEvent)
  }
  const cancel = () => {
    if (active) {
      stop()
      callbacks.cancel()
    }
  }
  const blur = (event: Event) => {
    if (event.target === target) cancel()
  }
  const cancelPointer = (event: Event) => {
    if ((event as PointerEvent).pointerId === pointerId) cancel()
  }
  target.addEventListener("pointermove", move, {
    capture: true,
    passive: false,
  })
  target.addEventListener("pointerup", release, true)
  target.addEventListener("pointercancel", cancelPointer, true)
  target.addEventListener("blur", blur, true)
  return stop
}
