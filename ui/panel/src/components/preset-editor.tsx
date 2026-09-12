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
  const [name, setName] = useState(
    editing ? dialog.preset.name : dialog.name || ""
  )
  const [draft, setDraft] = useState<Draft>(() =>
    editing
      ? structuredClone(dialog.preset.draft)
      : dialog.draft
        ? structuredClone(dialog.draft)
        : createBlankDraft()
  )
  const [saving, setSaving] = useState(false)
  const [showValidation, setShowValidation] = useState(false)

  const changeDraft = (update: (current: Draft) => Draft) => setDraft(update)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setShowValidation(true)
      document.querySelector<HTMLElement>("#preset-name")?.focus()
      showToast({ message: "Добавьте название шаблона.", tone: "error" })
      return
    }
    const draftError = validateDraft(draft)
    if (draftError) {
      setShowValidation(true)
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      )
      showToast({ message: draftError, tone: "error" })
      return
    }
    setShowValidation(false)
    setSaving(true)
    if (!(await onSave(name.trim(), draft))) setSaving(false)
  }

  return (
    <form
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      onSubmit={(event) => void submit(event)}
    >
      <div className="flex h-16 shrink-0 items-center gap-3 px-6 lg:px-8">
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6 pt-2">
          <div className="rounded-2xl bg-surface-subtle p-5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="preset-name"
            >
              Название шаблона
            </label>
            <Input
              id="preset-name"
              autoFocus
              maxLength={50}
              placeholder="Выбор следующей игры"
              value={name}
              aria-invalid={showValidation && !name.trim() ? true : undefined}
              className="mt-2 h-11 bg-background/35 text-base font-medium"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <PollDraftFields
            draft={draft}
            idPrefix="preset"
            layout="split"
            showValidation={showValidation}
            onChange={changeDraft}
            extraSettings={
              <div className="space-y-5">
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
                    className="grid w-full grid-cols-2 rounded-xl border border-border-subtle bg-background/30 p-1"
                  >
                    <ToggleGroupItem value="twitch">Twitch</ToggleGroupItem>
                    <ToggleGroupItem value="test">Демо</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Виджет в OBS
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
                    className="grid w-full grid-cols-2 rounded-xl border border-border-subtle bg-background/30 p-1"
                  >
                    <ToggleGroupItem value="stream">Включён</ToggleGroupItem>
                    <ToggleGroupItem value="panel">Скрыт</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            }
          />
        </div>
      </div>

      <div className="flex h-17 shrink-0 items-center justify-end gap-2 bg-panel-muted px-6 transition-colors">
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
