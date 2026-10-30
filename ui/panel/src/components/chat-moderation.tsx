import { useEffect, useRef, useState, type ReactNode } from "react"
import { Popover } from "radix-ui"
import { Shield, Timer, Trash2, X } from "lucide-react"
import { FormSegmented, FormSwitch } from "./form-controls"
import type { TwitchState } from "@/domain/polls"
import type { ChatMessage } from "@/domain/chat"
import "./chat-moderation.css"

export type ModerationAction = "delete" | "timeout"
export function ModerationSettings({
  twitch,
  gestures,
  duration,
  onGestures,
  onDuration,
  onReconnect,
}: {
  twitch: TwitchState
  gestures: boolean
  duration: number
  onGestures: (value: boolean) => void
  onDuration: (value: number) => void
  onReconnect: () => void
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="chat-moderation-trigger"
          type="button"
          aria-label="Модерация чата"
        >
          <Shield aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="chat-rail-settings"
          align="end"
          sideOffset={10}
          collisionPadding={12}
        >
          <div className="chat-rail-settings-heading">
            <strong>Модерация</strong>
            <Popover.Close asChild>
              <button type="button" aria-label="Закрыть модерацию">
                <X aria-hidden="true" />
              </button>
            </Popover.Close>
          </div>
          <FormSwitch
            label="Свайпы по сообщениям"
            checked={gestures}
            onCheckedChange={onGestures}
          />
          <p className="chat-moderation-help">
            Влево — удалить сообщение. Вправо — тайм-аут. Действие сработает
            после длинного свайпа; Escape отменяет.
          </p>
          <FormSegmented
            label="Тайм-аут"
            value={String(duration)}
            options={[
              ["60", "1 мин"],
              ["300", "5 мин"],
              ["600", "10 мин"],
            ]}
            onChange={(value) => onDuration(Number(value))}
          />
          {(!twitch.canDeleteMessages || !twitch.canTimeout) && (
            <button
              className="chat-moderation-reconnect"
              type="button"
              onClick={onReconnect}
            >
              Переподключить Twitch для модерации
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function ModeratedMessage({
  message,
  canDelete,
  canTimeout,
  gestures,
  duration,
  onModerate,
  children,
  delivery,
}: {
  message: ChatMessage
  delivery?: "sending" | "failed"
  canDelete: boolean
  canTimeout: boolean
  gestures: boolean
  duration: number
  onModerate: (action: ModerationAction, message: ChatMessage) => Promise<void>
  children: ReactNode
}) {
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState(false)
  const drag = useRef<{
    id: number
    x: number
    y: number
    locked: boolean
  } | null>(null)
  const moved = useRef(false)
  const lock = useRef(false)
  const cancel = () => {
    drag.current = null
    setOffset(0)
  }
  const dragging = offset !== 0
  useEffect(() => {
    if (!dragging) return
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        drag.current = null
        setOffset(0)
      }
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  }, [dragging])
  const run = async (action: ModerationAction) => {
    cancel()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try {
      await onModerate(action, message)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const enabled = !message.deleted && !delivery && (canDelete || canTimeout)
  return (
    <div
      className="chat-moderation-row"
      data-enabled={enabled || undefined}
      data-delivery={delivery}
      data-dragging={offset !== 0 || undefined}
      data-ready={Math.abs(offset) >= 110 || undefined}
      aria-busy={busy}
      onPointerDown={(event) => {
        moved.current = false
        if (
          !enabled ||
          !gestures ||
          busy ||
          !event.isPrimary ||
          event.button !== 0 ||
          (event.target as HTMLElement).closest("button, a, input")
        )
          return
        moved.current = false
        drag.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          locked: false,
        }
      }}
      onPointerMove={(event) => {
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
          event.currentTarget.setPointerCapture(event.pointerId)
          window.getSelection()?.removeAllRanges()
        }
        event.preventDefault()
        setOffset(
          Math.max(canDelete ? -150 : 0, Math.min(canTimeout ? 150 : 0, dx))
        )
      }}
      onPointerUp={(event) => {
        if (!drag.current || drag.current.id !== event.pointerId) return
        const dx = event.clientX - drag.current.x
        const committed = drag.current.locked && Math.abs(dx) >= 110
        cancel()
        if (committed && (dx < 0 ? canDelete : canTimeout))
          void run(dx < 0 ? "delete" : "timeout")
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
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
      {offset !== 0 && (
        <div
          className="chat-swipe-label"
          data-action={offset < 0 ? "delete" : "timeout"}
          aria-live="polite"
        >
          {offset < 0 ? (
            <>
              <Trash2 aria-hidden="true" />
              Удалить
            </>
          ) : (
            <>
              <Timer aria-hidden="true" />
              {duration / 60} мин
            </>
          )}
        </div>
      )}
      <article
        className="chat-home-message"
        data-deleted={message.deleted || undefined}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
      >
        {children}
      </article>
      {enabled && (
        <div className="chat-moderation-actions">
          {canDelete && (
            <button
              type="button"
              aria-label={`Удалить сообщение ${message.viewerName}`}
              disabled={busy}
              onClick={() => void run("delete")}
            >
              <Trash2 aria-hidden="true" />
            </button>
          )}
          {canTimeout && (
            <button
              type="button"
              aria-label={`Тайм-аут ${message.viewerName} на ${duration / 60} мин`}
              disabled={busy}
              onClick={() => void run("timeout")}
            >
              <Timer aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
