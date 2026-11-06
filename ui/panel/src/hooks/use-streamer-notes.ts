import { useEffect, useState } from "react"
import type { StreamerNote } from "@/domain/chat"

export type StreamerNotePatch = Partial<
  Pick<StreamerNote, "text" | "completed">
>
async function command(body: Record<string, unknown>) {
  const response = await fetch("/api/chat/streamer-notes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Poll-Client": "panel" },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok)
    throw new Error(
      data.error || "Не удалось сохранить заметку. Попробуйте ещё раз."
    )
  return data as { note?: StreamerNote }
}

export function useStreamerNotes(enabled: boolean) {
  const [notes, setNotes] = useState<StreamerNote[] | null>(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void fetch("/api/chat/streamer-notes", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error || "Не удалось загрузить заметки.")
        if (!controller.signal.aborted) {
          setNotes(data.notes)
          setError("")
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Не удалось загрузить заметки."
          )
      })
    return () => controller.abort()
  }, [enabled, retry])
  const add = async (text: string, task: boolean) => {
    const { note } = await command({ type: "add", text, task })
    setNotes((current) => [note!, ...(current || [])])
  }
  const update = async (id: string, patch: StreamerNotePatch) => {
    const { note } = await command({ type: "update", id, patch })
    setNotes(
      (current) => current?.map((item) => (item.id === id ? note! : item)) || []
    )
    return note!
  }
  const remove = async (id: string) => {
    await command({ type: "delete", id })
    setNotes((current) => current?.filter((note) => note.id !== id) || [])
  }
  return {
    notes,
    error,
    reload: () => setRetry((value) => value + 1),
    add,
    update,
    remove,
  }
}
export type StreamerNotesController = ReturnType<typeof useStreamerNotes>
