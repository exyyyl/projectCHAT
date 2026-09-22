import { useId, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"

import {
  FormActions,
  FormField,
  FormSegmented,
} from "@/components/form-controls"
import { PollDraftFields } from "@/components/poll-draft-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { useDemoMode } from "@/hooks/use-demo-mode"
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
  const nameId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const editing = dialog.mode === "edit"
  const showToast = useToast()
  const { enabled: demoEnabled } = useDemoMode()
  const [name, setName] = useState(
    editing ? dialog.preset.name : dialog.name || ""
  )
  const [draft, setDraft] = useState<Draft>(() =>
    (() => {
      const initial = editing
        ? structuredClone(dialog.preset.draft)
        : dialog.draft
          ? structuredClone(dialog.draft)
          : createBlankDraft()
      return !demoEnabled && initial.source === "test"
        ? { ...initial, source: "twitch" }
        : initial
    })()
  )
  const [saving, setSaving] = useState(false)
  const [showValidation, setShowValidation] = useState(false)

  const changeDraft = (update: (current: Draft) => Draft) => setDraft(update)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setShowValidation(true)
      nameRef.current?.focus()
      showToast({ message: "Добавьте название шаблона.", tone: "error" })
      return
    }
    const draftError = validateDraft(draft)
    if (draftError) {
      setShowValidation(true)
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus()
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
      ref={formRef}
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      onSubmit={(event) => void submit(event)}
    >
      <div className="flex h-16 shrink-0 items-center gap-2 px-4">
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
        <h2 className="text-sm font-medium">
          {editing ? "Редактировать шаблон" : "Новый шаблон"}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8">
        <div className="mx-auto max-w-5xl space-y-6 pt-2">
          <PollDraftFields
            draft={draft}
            idPrefix="preset"
            leadingFields={
              <FormField label="Название шаблона" htmlFor={nameId}>
                <Input
                  id={nameId}
                  ref={nameRef}
                  autoFocus
                  maxLength={50}
                  placeholder="Выбор следующей игры"
                  value={name}
                  aria-invalid={
                    showValidation && !name.trim() ? true : undefined
                  }
                  onChange={(event) => setName(event.target.value)}
                />
              </FormField>
            }
            showValidation={showValidation}
            onChange={changeDraft}
            extraSettings={
              <div className="space-y-5">
                {demoEnabled && (
                  <FormSegmented
                    label="Голоса"
                    value={draft.source}
                    options={[
                      ["twitch", "Twitch"],
                      ["test", "Демо"],
                    ]}
                    onChange={(source) =>
                      changeDraft((item) => ({
                        ...item,
                        source: source as Draft["source"],
                      }))
                    }
                  />
                )}
                <FormSegmented
                  label="Виджет в OBS"
                  value={draft.showOverlay ? "stream" : "panel"}
                  options={[
                    ["stream", "Включён"],
                    ["panel", "Скрыт"],
                  ]}
                  onChange={(value) =>
                    changeDraft((item) => ({
                      ...item,
                      showOverlay: value === "stream",
                    }))
                  }
                />
              </div>
            }
            actions={
              <FormActions
                secondary={
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11"
                    disabled={busy || saving}
                    onClick={onClose}
                  >
                    Отмена
                  </Button>
                }
                primary={
                  <Button
                    type="submit"
                    className="h-11 w-full"
                    disabled={busy || saving}
                  >
                    {busy || saving
                      ? "Сохраняем…"
                      : editing
                        ? "Сохранить"
                        : "Создать"}
                  </Button>
                }
              />
            }
          />
        </div>
      </div>
    </form>
  )
}
