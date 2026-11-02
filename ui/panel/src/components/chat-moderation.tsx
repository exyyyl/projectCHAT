import { useEffect, useRef, useState, type ReactNode } from "react"
import { Popover } from "radix-ui"
import { Ban, GripVertical, Info, Timer, Trash2 } from "lucide-react"
import type { ChatMessage } from "@/domain/chat"
import {
  swipeModeration,
  moderationRejection,
  releaseModerationSwipe,
  timeoutSteps,
  type ModerationAction,
} from "@/domain/chat-moderation"
import { trackPointerSwipe } from "@/domain/swipe-tracker"
import "./chat-moderation.css"

export function ModeratedMessage({
  message,
  canDelete,
  canTimeout,
  isSelf = false,
  onModerate,
  children,
  delivery,
}: {
  message: ChatMessage
  delivery?: "sending" | "failed"
  canDelete: boolean
  canTimeout: boolean
  isSelf?: boolean
  onModerate: (
    action: ModerationAction,
    message: ChatMessage,
    duration?: number
  ) => Promise<void>
  children: ReactNode
}) {
  const refusalAnimation = useRef<Animation | null>(null)
  const [feedback, setFeedback] = useState("")
  const permissions = { canDelete, canTimeout, isSelf }
  const row = useRef<HTMLDivElement>(null)
  const decline = useRef<HTMLButtonElement>(null)
  const handle = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const restoreFocus = useRef<HTMLElement | null>(null)
  const [pending, setPending] = useState<ReturnType<
    typeof swipeModeration
  > | null>(null)
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState(false)
  const [width, setWidth] = useState(600)
  const preview = swipeModeration(offset, width)
  const drag = useRef<{
    id: number
    x: number
    y: number
    locked: boolean
    width: number
  } | null>(null)
  const stopTracking = useRef<(() => void) | null>(null)
  const moved = useRef(false)
  const lock = useRef(false)
  const cancel = () => {
    stopTracking.current?.()
    stopTracking.current = null
    drag.current = null
    setOffset(0)
  }
  const enabled = !message.deleted && !delivery && (canDelete || canTimeout)
  if (pending && (!enabled || !canTimeout || isSelf)) setPending(null)
  const confirmation =
    pending && enabled && canTimeout && !isSelf ? pending : null
  const dismiss = () => {
    cancel()
    setPending(null)
    const target = restoreFocus.current?.isConnected
      ? restoreFocus.current
      : row.current
    target?.focus({ preventScroll: true })
  }
  const dragging = offset !== 0
  useEffect(() => {
    if (!dragging && !confirmation) return
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        stopTracking.current?.()
        stopTracking.current = null
        drag.current = null
        setOffset(0)
        setPending(null)
        const target = restoreFocus.current?.isConnected
          ? restoreFocus.current
          : row.current
        target?.focus({ preventScroll: true })
      }
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  }, [dragging, confirmation])
  useEffect(() => {
    if (confirmation) decline.current?.focus({ preventScroll: true })
  }, [confirmation])
  useEffect(
    () => () => {
      stopTracking.current?.()
      refusalAnimation.current?.cancel()
    },
    []
  )
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(""), 2200)
    return () => clearTimeout(timer)
  }, [feedback])
  const explain = (text: string, shake = false) => {
    cancel()
    setPending(null)
    setFeedback(text)
    if (
      shake &&
      row.current &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      refusalAnimation.current?.cancel()
      refusalAnimation.current = row.current.animate(
        [
          { translate: "0px 0px" },
          { translate: "12px 0px" },
          { translate: "-10px 0px" },
          { translate: "7px 0px" },
          { translate: "-4px 0px" },
          { translate: "0px 0px" },
        ],
        { duration: 360, easing: "cubic-bezier(0.2, 0, 0.2, 1)" }
      )
    }
  }
  const run = async (action: ModerationAction, duration?: number) => {
    cancel()
    setPending(null)
    if (lock.current || !enabled) return
    const rejection = moderationRejection(action, permissions)
    if (rejection) {
      explain(rejection, true)
      return
    }
    setFeedback("")
    lock.current = true
    row.current?.focus({ preventScroll: true })
    setBusy(true)
    try {
      await onModerate(action, message, duration)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const request = (
    choice: ReturnType<typeof swipeModeration>,
    focusTarget: HTMLElement | null = null
  ) => {
    cancel()
    setMenuOpen(false)
    if (choice.action === "delete") {
      void run("delete")
      return
    }
    if (!enabled || lock.current) return
    const rejection = moderationRejection(choice.action, permissions)
    if (rejection) {
      explain(rejection, true)
      return
    }
    setFeedback("")
    restoreFocus.current = focusTarget
    setPending(choice)
  }
  return (
    <div
      ref={row}
      tabIndex={-1}
      className="chat-moderation-row"
      data-confirming={Boolean(confirmation) || undefined}
      data-feedback={Boolean(feedback) || undefined}
      data-enabled={enabled || undefined}
      data-delivery={delivery}
      data-dragging={offset !== 0 || undefined}
      data-ready={preview.ready || undefined}
      aria-busy={busy}
      onPointerDown={(event) => {
        moved.current = false
        if (
          !enabled ||
          busy ||
          Boolean(confirmation) ||
          !event.isPrimary ||
          event.button !== 0 ||
          ((event.target as HTMLElement).closest(
            "button, a, input, select, label"
          ) &&
            !(event.target as HTMLElement).closest(".chat-swipe-handle"))
        )
          return
        setFeedback("")
        refusalAnimation.current?.cancel()
        setWidth(event.currentTarget.clientWidth)
        moved.current = false
        drag.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          locked: false,
          width: event.currentTarget.clientWidth,
        }
        const owner = event.currentTarget
        stopTracking.current?.()
        stopTracking.current = trackPointerSwipe(window, event.pointerId, {
          move: (event) => {
            const current = drag.current
            if (!current || current.id !== event.pointerId) return
            const dx = event.clientX - current.x,
              dy = event.clientY - current.y
            if (!current.locked) {
              if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
                cancel()
                return
              }
              if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.5) return
              current.locked = true
              moved.current = true
              try {
                owner.setPointerCapture(event.pointerId)
              } catch {
                /* Window tracking remains active without capture. */
              }
              window.getSelection()?.removeAllRanges()
            }
            event.preventDefault()
            setOffset(
              Math.max(
                canDelete ? -Math.min(150, width) : 0,
                Math.min(
                  canTimeout || isSelf ? Math.min(520, current.width * 0.9) : 0,
                  dx
                )
              )
            )
          },
          release: (event) => {
            if (!drag.current || drag.current.id !== event.pointerId) return
            const dx = event.clientX - drag.current.x
            const current = drag.current
            const result = releaseModerationSwipe(
              dx,
              current.width,
              permissions
            )
            const locked = current.locked
            cancel()
            if (!locked) return
            if (result.hint) {
              explain(result.hint, Boolean(result.rejection))
              return
            }
            request(result.choice)
          },
          cancel,
        })
      }}
      onDragStart={(event) => {
        if (drag.current) event.preventDefault()
      }}
      onClickCapture={(event) => {
        if (moved.current) {
          event.preventDefault()
          event.stopPropagation()
          moved.current = false
        }
      }}
    >
      {confirmation && (
        <div
          className="chat-swipe-confirmation"
          data-action={confirmation.action}
          role="group"
          aria-label={`${message.viewerName}: ${confirmation.label}. Подтвердить?`}
        >
          {confirmation.action === "ban" ? (
            <Ban aria-hidden="true" />
          ) : (
            <Timer aria-hidden="true" />
          )}
          <div className="chat-swipe-confirmation-copy">
            <strong>
              {confirmation.action === "ban"
                ? "Бан навсегда?"
                : `Мут на ${confirmation.label}?`}
            </strong>
            <span>{message.viewerName}</span>
          </div>
          <div className="chat-swipe-confirmation-buttons">
            <button
              type="button"
              className="chat-swipe-confirm-yes"
              onClick={() =>
                void run(confirmation.action, confirmation.duration)
              }
            >
              Да
            </button>
            <button ref={decline} type="button" onClick={dismiss}>
              Нет
            </button>
          </div>
        </div>
      )}
      {offset !== 0 && !confirmation && (
        <div
          className="chat-swipe-label"
          data-action={preview.action}
          aria-live="polite"
        >
          {offset < 0 ? (
            <>
              <Trash2 aria-hidden="true" />
              Удалить
            </>
          ) : (
            <>
              {preview.action === "ban" ? (
                <Ban aria-hidden="true" />
              ) : (
                <Timer aria-hidden="true" />
              )}
              {moderationRejection(preview.action, permissions) ||
                (preview.ready ? preview.label : "Потяните дальше")}
            </>
          )}
        </div>
      )}
      <article
        className="chat-home-message"
        data-deleted={message.deleted || undefined}
        inert={Boolean(confirmation || feedback)}
        aria-hidden={Boolean(confirmation || feedback) || undefined}
        style={{
          opacity: feedback ? 0 : undefined,
          transform: confirmation
            ? "translateX(100%)"
            : offset
              ? `translateX(${offset}px)`
              : undefined,
        }}
      >
        {children}
      </article>
      {feedback && !confirmation && (
        <div className="chat-swipe-feedback" role="status">
          {isSelf ? <Ban aria-hidden="true" /> : <Info aria-hidden="true" />}
          <span>{feedback}</span>
        </div>
      )}
      {enabled && !confirmation && (
        <Popover.Root open={menuOpen && !busy} onOpenChange={setMenuOpen}>
          <Popover.Trigger asChild>
            <button
              ref={handle}
              type="button"
              className="chat-swipe-handle"
              disabled={busy}
              aria-label={`Потянуть сообщение ${message.viewerName}`}
            >
              <GripVertical aria-hidden="true" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="chat-message-menu"
              side="bottom"
              align="start"
              sideOffset={8}
              collisionPadding={12}
              aria-label={`Действия с сообщением ${message.viewerName}`}
              onPointerDown={(event) => event.stopPropagation()}
              onCloseAutoFocus={(event) => event.preventDefault()}
              onEscapeKeyDown={() =>
                handle.current?.focus({ preventScroll: true })
              }
            >
              <p className="chat-message-menu-hint">
                Потяните сообщение, чтобы выбрать действие
              </p>
              {isSelf && (
                <p className="chat-message-menu-hint">Себя отстранить нельзя</p>
              )}
              {canTimeout && !isSelf && (
                <>
                  <h2>Отстранить из чата</h2>
                  <div className="chat-message-menu-timeouts">
                    {timeoutSteps.map((step) => (
                      <button
                        key={step.duration}
                        type="button"
                        onClick={() =>
                          request(
                            { action: "timeout", ...step, ready: true },
                            handle.current
                          )
                        }
                      >
                        {step.label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="chat-message-menu-ban"
                    type="button"
                    onClick={() =>
                      request(
                        { action: "ban", label: "Бан навсегда", ready: true },
                        handle.current
                      )
                    }
                  >
                    <Ban aria-hidden="true" />
                    Бан навсегда
                  </button>
                </>
              )}
              {canDelete && (
                <button
                  className="chat-message-menu-delete"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    void run("delete")
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Удалить сообщение
                </button>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  )
}
