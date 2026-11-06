import { useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ChatNote } from "@/domain/chat"

export function ViewerNoteEditor({
  channelId,
  viewerId,
  note,
  onSaved,
}: {
  channelId: string
  viewerId: string
  note?: ChatNote
  onSaved: (note: ChatNote | null) => void
}) {
  const [text, setText] = useState(note?.text || "")
  const [saved, setSaved] = useState(note?.text || "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const save = async (value: string) => {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/chat/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Poll-Client": "panel",
        },
        body: JSON.stringify({ type: "set", channelId, viewerId, text: value }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(
          data.error || "Не удалось сохранить заметку. Попробуйте ещё раз."
        )
      const next = data.note as ChatNote | null
      setText(next?.text || "")
      setSaved(next?.text || "")
      onSaved(next)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось сохранить заметку."
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="chat-profile-note-form">
      <Textarea
        value={text}
        maxLength={Math.max(2000, saved.length)}
        disabled={busy}
        placeholder="Что стоит запомнить о зрителе?"
        aria-label="Заметка о зрителе"
        onChange={(event) => setText(event.target.value)}
      />
      <div className="chat-profile-note-footer">
        <span>
          {text.length} / {Math.max(2000, saved.length)}
        </span>
        <div className="flex items-center gap-2">
          {saved && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Удалить заметку"
              disabled={busy}
              onClick={() => void save("")}
            >
              <Trash2 />
            </Button>
          )}
          <Button
            type="button"
            disabled={busy || text.trim() === saved}
            onClick={() => void save(text)}
          >
            {busy ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
