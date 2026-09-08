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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Draft, Preset, PresetDialogState } from "@/domain/polls"
import { Keyword } from "@/components/poll-results"

type PresetDialogsProps = {
  dialog: PresetDialogState | null
  name: string
  draft: Draft | null
  pendingDelete: Preset | null
  onNameChange: (value: string) => void
  onSave: () => void
  onClose: () => void
  onDeleteChange: (preset: Preset | null) => void
  onConfirmDelete: (preset: Preset) => void
}

export function PresetDialogs({
  dialog,
  name,
  draft,
  pendingDelete,
  onNameChange,
  onSave,
  onClose,
  onDeleteChange,
  onConfirmDelete,
}: PresetDialogsProps) {
  return (
    <>
      <Dialog open={!!dialog} onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "rename"
                ? "Переименовать шаблон"
                : "Новый шаблон"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                className="text-xs text-muted-foreground"
                htmlFor="preset-name"
              >
                Название
              </label>
              <Input
                id="preset-name"
                autoFocus
                maxLength={50}
                placeholder="Например, выбор следующей игры"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && onSave()}
              />
            </div>
            {dialog?.mode === "create" && draft && (
              <div className="rounded-xl border border-border-subtle bg-surface-subtle p-4">
                <div className="truncate text-sm font-medium">
                  {draft.question}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {draft.options.map((option) => (
                    <Keyword key={option.id}>{option.word}</Keyword>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-muted-foreground">
                  Параметры текущего опроса будут сохранены в шаблон.
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={onSave} disabled={!name.trim()}>
              {dialog?.mode === "rename" ? "Переименовать" : "Создать шаблон"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              Шаблон будет удалён с этого компьютера. Текущий черновик не
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
