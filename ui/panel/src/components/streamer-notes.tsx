import { useId, useRef, useState } from "react"
import { Check, Plus, Trash2, StickyNote, ListTodo } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { StreamerNote } from "@/domain/chat"
import type {
  StreamerNotesController,
  StreamerNotePatch as Patch,
} from "@/hooks/use-streamer-notes"
import "./streamer-notes.css"

function NoteRow({
  note,
  onUpdate,
  onDelete,
}: {
  note: StreamerNote
  onUpdate: (id: string, patch: Patch) => Promise<StreamerNote>
  onDelete: (id: string) => Promise<void>
}) {
  const [text, setText] = useState(note.text)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const lock = useRef(false)
  const save = async (patch: Patch = {}) => {
    if (
      lock.current ||
      (!Object.keys(patch).length && text.trim() === note.text)
    )
      return
    lock.current = true
    setBusy(true)
    setError("")
    try {
      const updated = await onUpdate(note.id, { text, ...patch })
      setText(updated.text)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось сохранить заметку."
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const remove = async () => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError("")
    try {
      await onDelete(note.id)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось удалить заметку."
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <div
      className="streamer-note"
      data-task={note.task || undefined}
      data-completed={note.completed || undefined}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          void save()
      }}
    >
      <div className="streamer-note-body">
        {note.task && (
          <button
            type="button"
            role="checkbox"
            aria-checked={note.completed}
            aria-label={`Выполнено: ${note.text}`}
            className="streamer-note-check"
            disabled={busy}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => void save({ completed: !note.completed })}
          >
            {note.completed && <Check aria-hidden="true" />}
          </button>
        )}
        <Textarea
          value={text}
          maxLength={5000}
          aria-label={note.task ? "Текст задачи" : "Текст заметки"}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="streamer-note-actions">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={
              note.task ? "Удалить задачу" : "Удалить заметку стримера"
            }
            disabled={busy}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => void remove()}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {error && (
        <p className="streamer-notes-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function StreamerNotes({
  task,
  controller,
}: {
  task: boolean
  controller: StreamerNotesController
}) {
  const {
    notes,
    error: loadError,
    reload,
    add: create,
    update,
    remove,
  } = controller
  const [creating, setCreating] = useState(false)
  const formId = useId()
  const addTrigger = useRef<HTMLButtonElement>(null)
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const draft = useRef<HTMLTextAreaElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const entries =
    notes
      ?.filter((note) => note.task === task)
      .sort((a, b) => b.createdAt - a.createdAt) || []
  const add = async () => {
    if (!text.trim() || busy || notes === null) return
    setBusy(true)
    setError("")
    try {
      await create(text, task)
      setText("")
      setCreating(false)
      requestAnimationFrame(() => {
        if (list.current) list.current.scrollTop = 0
        addTrigger.current?.focus({ preventScroll: true })
      })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось добавить заметку."
      )
    } finally {
      setBusy(false)
    }
  }
  const closeDraft = () => {
    if (busy) return
    setCreating(false)
    setError("")
    addTrigger.current?.focus({ preventScroll: true })
  }
  return (
    <div className="streamer-notes">
      <div className="chat-rail-heading streamer-notes-heading">
        <h2>
          {task ? <ListTodo /> : <StickyNote />}
          {task ? "Список дел" : "Заметки"}
        </h2>
        <button
          ref={addTrigger}
          type="button"
          className="chat-rail-settings-trigger"
          aria-label={task ? "Создать задачу" : "Создать заметку"}
          aria-expanded={creating}
          aria-controls={formId}
          disabled={busy || notes === null}
          onClick={() => {
            setCreating(true)
            setError("")
            requestAnimationFrame(() => draft.current?.focus())
          }}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
      {!entries.length && !creating && !loadError && (
        <p className="streamer-notes-empty">
          {notes === null
            ? "Загрузка…"
            : task
              ? "Пока нет дел"
              : "Пока нет заметок"}
        </p>
      )}

      {creating && (
        <form
          id={formId}
          className="streamer-note-draft"
          onSubmit={(event) => {
            event.preventDefault()
            void add()
          }}
        >
          <Textarea
            ref={draft}
            value={text}
            maxLength={5000}
            aria-label={task ? "Новая задача" : "Новая заметка стримера"}
            placeholder={task ? "Что нужно сделать?" : "Новая заметка…"}
            disabled={busy || notes === null}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !event.nativeEvent.isComposing) {
                event.preventDefault()
                event.stopPropagation()
                closeDraft()
                return
              }
              if (
                event.key === "Enter" &&
                !event.nativeEvent.isComposing &&
                !event.shiftKey &&
                (task || event.ctrlKey || event.metaKey)
              ) {
                event.preventDefault()
                if (!event.repeat) event.currentTarget.form?.requestSubmit()
              }
            }}
          />
          <div className="streamer-note-draft-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={closeDraft}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              size="sm"
              className="w-full"
              disabled={busy || notes === null || !text.trim()}
              aria-label={
                task ? "Добавить задачу" : "Добавить заметку стримера"
              }
            >
              <Plus />
              Добавить
            </Button>
          </div>
        </form>
      )}
      {(error || loadError) && (
        <p className="streamer-notes-error" role="alert">
          {error || loadError}
          {loadError && (
            <button type="button" onClick={reload}>
              Повторить
            </button>
          )}
        </p>
      )}
      {!!entries.length && (
        <div
          ref={list}
          className="streamer-notes-list"
          role="region"
          aria-label={task ? "Список задач" : "Список заметок"}
          tabIndex={0}
        >
          {entries.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              onUpdate={update}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </div>
  )
}
