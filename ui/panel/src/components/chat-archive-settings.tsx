import { useState } from "react"
import { Popover } from "radix-ui"
import { Settings2 } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { FormField } from "./form-controls"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog"
import { useToast } from "./ui/toast"
import {
  archiveLimitRanges,
  validArchiveLimits,
} from "../../../../public/chat-archive-settings.js"
import type { ChatArchiveCleanup, ChatArchiveSummary } from "@/domain/chat"

const megabyte = 1024 * 1024
export function ChatArchiveSettings({
  summary,
  onCleanup,
}: {
  summary: ChatArchiveSummary | null
  onCleanup: (change: ChatArchiveCleanup) => void
}) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [messages, setMessages] = useState("")
  const [size, setSize] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const toast = useToast()
  const limits = {
    maxMessages: Number(messages),
    maxBytes: Number(size) * megabyte,
  }
  const valid =
    validArchiveLimits(limits) && /^\d+$/.test(messages) && /^\d+$/.test(size)
  const changed =
    summary &&
    (limits.maxMessages !== summary.maxMessages ||
      limits.maxBytes !== summary.maxBytes)
  const save = async () => {
    if (!valid || busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/chat/archive/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Poll-Client": "panel",
        },
        body: JSON.stringify(limits),
      })
      if (response.status === 404)
        throw new Error("Перезапустите Cue, чтобы обновить настройки архива.")
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Не удалось сохранить лимиты")
      onCleanup(data)
      setConfirm(false)
      setOpen(false)
      toast({
        message: "Лимиты архива сохранены",
        tone: data.compacted === false ? "warning" : "success",
        description:
          data.compacted === false
            ? "Сжать файл базы не удалось. Свободное место будет использовано повторно."
            : undefined,
      })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось сохранить лимиты"
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Popover.Root
        open={open}
        onOpenChange={(value) => {
          if (busy) return
          setOpen(value)
          if (value && summary) {
            setMessages(String(summary.maxMessages))
            setSize(String(summary.maxBytes / megabyte))
            setError("")
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className="chat-rail-settings-trigger"
            aria-label="Настроить архив чата"
            disabled={!summary}
          >
            <Settings2 aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="chat-rail-settings"
            side="left"
            align="start"
            sideOffset={12}
            collisionPadding={12}
          >
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (!valid || !changed) return
                if (
                  summary &&
                  (limits.maxMessages < summary.maxMessages ||
                    limits.maxBytes < summary.maxBytes)
                )
                  setConfirm(true)
                else void save()
              }}
            >
              <h3 className="text-sm font-medium">Архив чата</h3>
              <FormField
                label="Максимум записей"
                htmlFor="archive-message-limit"
              >
                <Input
                  id="archive-message-limit"
                  type="number"
                  min={archiveLimitRanges.maxMessages[0]}
                  max={archiveLimitRanges.maxMessages[1]}
                  step={1}
                  value={messages}
                  onChange={(e) => setMessages(e.target.value)}
                  disabled={busy}
                />
              </FormField>
              <FormField label="Размер базы, МБ" htmlFor="archive-size-limit">
                <Input
                  id="archive-size-limit"
                  type="number"
                  min={16}
                  max={2048}
                  step={1}
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  disabled={busy}
                />
              </FormField>
              <p className="text-xs text-muted-foreground">
                Общий лимит для всех каналов. При заполнении удаляются самые
                старые сообщения; заметки сохраняются.
              </p>
              {error && !confirm && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy || !valid || !changed}>
                {busy ? "Сохранение…" : "Сохранить"}
              </Button>
            </form>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <AlertDialog
        open={confirm}
        onOpenChange={(value) => {
          if (!busy) setConfirm(value)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Уменьшить лимиты архива?</AlertDialogTitle>
            <AlertDialogDescription>
              Самые старые сообщения сверх новых лимитов будут удалены во всех
              каналах. Заметки сохранятся. Удаление нельзя отменить.
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
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              {busy ? "Сохранение…" : "Применить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
