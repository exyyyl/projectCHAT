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
type DeletablePreset = { id: string; name: string }

type PresetDialogsProps<T extends DeletablePreset> = {
  pendingDelete: T | null
  onDeleteChange: (preset: T | null) => void
  onConfirmDelete: (preset: T) => void
}

export function PresetDialogs<T extends DeletablePreset>({
  pendingDelete,
  onDeleteChange,
  onConfirmDelete,
}: PresetDialogsProps<T>) {
  return (
    <AlertDialog
      open={!!pendingDelete}
      onOpenChange={(open) => !open && onDeleteChange(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить «{pendingDelete?.name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Текущие настройки останутся без изменений.
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
