import { CircleAlert, RotateCw, Trash2 } from "lucide-react"
import { useState } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import { Button } from "./ui/button"

export function ChatDeliveryError({
  error,
  disabled,
  onRetry,
  onDiscard,
}: {
  error?: string
  disabled: boolean
  onRetry: () => void
  onDiscard: () => void
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const reason = error || "Не удалось отправить сообщение. Попробуйте ещё раз."
  return (
    <span className="chat-home-delivery-error" role="alert">
      <Tooltip
        delayDuration={150}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      >
        <TooltipTrigger asChild>
          <button
            type="button"
            className="chat-delivery-reason"
            aria-label={`Причина ошибки отправки: ${reason}`}
            // Radix closes triggers on pointerdown as well as click.
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault()
              setDetailsOpen(true)
            }}
          >
            <CircleAlert aria-hidden="true" />
            <span>Не отправлено</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          className="chat-delivery-details"
          showArrow={false}
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
        >
          <p>{reason}</p>
        </TooltipContent>
      </Tooltip>
      <span className="chat-delivery-actions">
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={disabled}
              onClick={onRetry}
              aria-label="Повторить отправку сообщения"
            >
              <RotateCw aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent showArrow={false} side="top" sideOffset={6}>
            Повторить отправку
          </TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              className="chat-delivery-discard"
              variant="ghost"
              size="icon-xs"
              onClick={onDiscard}
              aria-label="Удалить неотправленное сообщение"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent showArrow={false} side="top" sideOffset={6}>
            Удалить сообщение
          </TooltipContent>
        </Tooltip>
      </span>
    </span>
  )
}

export function ChatSendingIndicator() {
  return (
    <span className="chat-home-delivery-state" role="status">
      <span className="sr-only">Отправка сообщения</span>
      <span className="chat-delivery-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </span>
  )
}
