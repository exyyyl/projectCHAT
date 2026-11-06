import { ChatArchiveSettings } from "./chat-archive-settings"
import { useRef, useState } from "react"
import { Popover } from "radix-ui"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/toast"
import type { ChatArchiveCleanup, ChatArchiveSummary } from "@/domain/chat"

export function ChatArchiveControls({
  channelId,
  summary,
  onCleanup,
}: {
  channelId: string
  summary: ChatArchiveSummary | null
  onCleanup: (change: ChatArchiveCleanup) => void
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<"deleted" | "all" | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const trigger = useRef<HTMLButtonElement>(null)
  const toast = useToast()
  const choose = (next: "deleted" | "all") => {
    setError("")
    setOpen(false)
    setScope(next)
  }
  const clear = async () => {
    if (!scope || busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/chat/archive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Poll-Client": "panel",
        },
        body: JSON.stringify({ channelId, scope }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(
          data.error || "Не удалось очистить архив. Попробуйте ещё раз."
        )
      onCleanup(data)
      setScope(null)
      toast({
        message: data.removed
          ? `Из архива удалено: ${data.removed}`
          : "Нет сообщений для очистки",
        description:
          data.compacted === false
            ? "Сообщения удалены. Сжать файл базы не удалось; освободившееся место будет использоваться повторно."
            : undefined,
        tone: data.compacted === false ? "warning" : "success",
      })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось очистить архив. Попробуйте ещё раз."
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex items-center gap-1">
      <ChatArchiveSettings summary={summary} onCleanup={onCleanup} />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            ref={trigger}
            type="button"
            className="chat-rail-settings-trigger"
            aria-label="Очистить архив чата"
            disabled={!channelId || !summary?.feedCount}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="chat-rail-settings"
            side="right"
            align="start"
            sideOffset={12}
            collisionPadding={12}
            onCloseAutoFocus={(event) => {
              if (scope) event.preventDefault()
            }}
          >
            <div className="grid gap-2">
              <Button
                variant="ghost"
                className="justify-start"
                disabled={!summary?.count}
                onClick={() => choose("deleted")}
              >
                Только удалённые
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => choose("all")}
              >
                Всю историю
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <AlertDialog
        open={Boolean(scope)}
        onOpenChange={(value) => {
          if (!value && !busy) setScope(null)
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            trigger.current?.focus()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {scope === "deleted"
                ? "Очистить удалённые сообщения?"
                : "Очистить всю историю чата?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {scope === "deleted"
                ? "Из архива этого канала исчезнут сообщения с пометкой «Удалено»."
                : "Из архива этого канала исчезнут все сообщения и события."}{" "}
              Заметки сохранятся. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault()
                void clear()
              }}
            >
              {busy ? "Очистка…" : "Очистить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
