import { useState } from "react"
import { ArrowLeft } from "lucide-react"

import { PollDraftFields } from "@/components/poll-draft-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useToast } from "@/components/ui/toast"
import {
  createBlankDraft,
  type Draft,
  type PresetDialogState,
  validateDraft,
} from "@/domain/polls"

type PresetEditorProps = {
  dialog: PresetDialogState
  busy: boolean
  onSave: (name: string, draft: Draft) => Promise<boolean>
  onClose: () => void
}

export function PresetEditor({
  dialog,
  busy,
  onSave,
  onClose,
}: PresetEditorProps) {
  const editing = dialog.mode === "edit"
  const showToast = useToast()
  const [name, setName] = useState(editing ? dialog.preset.name : "")
  const [draft, setDraft] = useState<Draft>(() =>
    editing ? structuredClone(dialog.preset.draft) : createBlankDraft()
  )
  const [saving, setSaving] = useState(false)

  const changeDraft = (update: (current: Draft) => Draft) => setDraft(update)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      showToast({ message: "Добавьте название шаблона.", tone: "error" })
      return
    }
    const draftError = validateDraft(draft)
    if (draftError) {
      showToast({ message: draftError, tone: "error" })
      return
    }
    setSaving(true)
    if (!(await onSave(name.trim(), draft))) setSaving(false)
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => void submit(event)}
    >
      <div className="flex h-16 shrink-0 items-center gap-3 px-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={busy || saving}
          aria-label="Вернуться к шаблону"
          onClick={onClose}
        >
          <ArrowLeft />
        </Button>
        <h2 className="text-lg font-semibold tracking-[-0.02em]">
          {editing ? "Редактировать шаблон" : "Новый шаблон"}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto max-w-2xl space-y-7 pt-2">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="preset-name"
              >
                Название
              </label>
              <Input
                id="preset-name"
                autoFocus
                maxLength={50}
                placeholder="Выбор следующей игры"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Источник голосов
              </div>
              <ToggleGroup
                type="single"
                value={draft.source}
                onValueChange={(value) =>
                  value &&
                  changeDraft((item) => ({
                    ...item,
                    source: value as Draft["source"],
                  }))
                }
              >
                <ToggleGroupItem value="test">Демо</ToggleGroupItem>
                <ToggleGroupItem value="twitch">Twitch</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <PollDraftFields
            draft={draft}
            idPrefix="preset"
            onChange={changeDraft}
            extraSettings={
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Виджет
                </div>
                <ToggleGroup
                  type="single"
                  value={draft.showOverlay ? "stream" : "panel"}
                  onValueChange={(value) =>
                    value &&
                    changeDraft((item) => ({
                      ...item,
                      showOverlay: value === "stream",
                    }))
                  }
                  className="grid w-full grid-cols-2 rounded-xl bg-surface-subtle p-1"
                >
                  <ToggleGroupItem value="stream">Показывать</ToggleGroupItem>
                  <ToggleGroupItem value="panel">Скрыть</ToggleGroupItem>
                </ToggleGroup>
              </div>
            }
          />
        </div>
      </div>

      <div className="flex h-17 shrink-0 items-center justify-end gap-2 bg-white/[0.018] px-6">
        <Button
          type="button"
          variant="ghost"
          disabled={busy || saving}
          onClick={onClose}
        >
          Отмена
        </Button>
        <Button type="submit" className="min-w-26" disabled={busy || saving}>
          {busy || saving ? "Сохраняем…" : editing ? "Сохранить" : "Создать"}
        </Button>
      </div>
    </form>
  )
}
