import { useState } from "react"

import { PollDraftFields } from "@/components/poll-draft-fields"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useToast } from "@/components/ui/toast"
import {
  createBlankDraft,
  type Draft,
  type Preset,
  type PresetDialogState,
  validateDraft,
} from "@/domain/polls"

type PresetDialogsProps = {
  dialog: PresetDialogState | null
  pendingDelete: Preset | null
  busy: boolean
  onSave: (name: string, draft: Draft) => Promise<boolean>
  onClose: () => void
  onDeleteChange: (preset: Preset | null) => void
  onConfirmDelete: (preset: Preset) => void
}

export function PresetDialogs({
  dialog,
  pendingDelete,
  busy,
  onSave,
  onClose,
  onDeleteChange,
  onConfirmDelete,
}: PresetDialogsProps) {
  return (
    <>
      {dialog && (
        <PresetEditorDialog
          key={dialog.mode === "edit" ? dialog.preset.id : "new"}
          dialog={dialog}
          busy={busy}
          onSave={onSave}
          onClose={onClose}
        />
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && onDeleteChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Удалить «{pendingDelete?.name}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Шаблон будет удалён с этого компьютера. Текущий опрос не
              изменится.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => pendingDelete && onConfirmDelete(pendingDelete)}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PresetEditorDialog({
  dialog,
  busy,
  onSave,
  onClose,
}: {
  dialog: PresetDialogState
  busy: boolean
  onSave: (name: string, draft: Draft) => Promise<boolean>
  onClose: () => void
}) {
  const editing = dialog.mode === "edit"
  const showToast = useToast()
  const [name, setName] = useState(editing ? dialog.preset.name : "")
  const [draft, setDraft] = useState<Draft>(() =>
    editing ? structuredClone(dialog.preset.draft) : createBlankDraft()
  )
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const changeDraft = (update: (current: Draft) => Draft) => {
    setDraft(update)
    setError("")
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError("Добавьте название шаблона.")
      showToast({ message: "Добавьте название шаблона.", tone: "error" })
      return
    }
    const draftError = validateDraft(draft)
    if (draftError) {
      setError(draftError)
      showToast({ message: draftError, tone: "error" })
      return
    }
    setSaving(true)
    if (!(await onSave(name.trim(), draft))) {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && !saving && onClose()}
    >
      <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border-subtle px-6 py-5 pr-14">
          <DialogTitle className="text-lg">
            {editing ? "Редактирование шаблона" : "Новый шаблон"}
          </DialogTitle>
        </DialogHeader>

        <form
          className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]"
          onSubmit={(event) => void submit(event)}
        >
          <div className="min-h-0 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-2">
                  <label
                    className="text-xs text-muted-foreground"
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
                    aria-invalid={!!error && !name.trim()}
                    onChange={(event) => {
                      setName(event.target.value)
                      setError("")
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Голоса</div>
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
                    <ToggleGroupItem value="twitch">Twitch-чат</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              <PollDraftFields
                draft={draft}
                idPrefix="preset"
                onChange={changeDraft}
                extraSettings={
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Отображение
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
                      className="grid w-full grid-cols-2 rounded-xl border border-border-subtle bg-surface-subtle p-1"
                    >
                      <ToggleGroupItem value="stream">
                        На стриме
                      </ToggleGroupItem>
                      <ToggleGroupItem value="panel">
                        Только в панели
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                }
              />
            </div>
          </div>

          <div className="flex min-h-17 items-center justify-end gap-4 border-t border-border-subtle bg-muted/35 px-6 py-4">
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || saving}
                onClick={onClose}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={busy || saving}>
                {busy || saving
                  ? "Сохранение…"
                  : editing
                    ? "Сохранить"
                    : "Создать"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
