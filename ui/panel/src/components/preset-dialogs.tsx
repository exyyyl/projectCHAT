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
import type { Preset } from "@/domain/polls"

type PresetDialogsProps = {
  pendingDelete: Preset | null
  onDeleteChange: (preset: Preset | null) => void
  onConfirmDelete: (preset: Preset) => void
}

export function PresetDialogs({
  pendingDelete,
  onDeleteChange,
  onConfirmDelete,
}: PresetDialogsProps) {
  return (
    <AlertDialog
      open={!!pendingDelete}
      onOpenChange={(open) => !open && onDeleteChange(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить «{pendingDelete?.name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Текущий опрос останется без изменений.
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
  )
}
