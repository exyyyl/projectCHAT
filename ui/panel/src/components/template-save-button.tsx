import { useId, useState } from "react"
import { BookmarkPlus } from "lucide-react"
import { Popover } from "radix-ui"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import type {
  SavedTemplate,
  TemplateKind,
  TemplateData,
} from "@/domain/templates"

export type SaveTemplate = (
  template: {
    name: string
    kind: TemplateKind
    data: TemplateData[TemplateKind]
  },
  replaceId?: string
) => Promise<boolean>
export function TemplateSaveButton({
  kind,
  data,
  onSave,
  current,
  disabled = false,
  compact = false,
  iconOnly = false,
}: {
  kind: TemplateKind
  data: TemplateData[TemplateKind]
  onSave: SaveTemplate
  current?: SavedTemplate
  disabled?: boolean
  compact?: boolean
  iconOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const id = useId()
  const save = async (copy = false) => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      if (
        await onSave(
          { name: name.trim(), kind, data },
          copy ? undefined : current?.id
        )
      )
        setOpen(false)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Popover.Root
      open={open}
      onOpenChange={(value) => {
        if (!saving) {
          setOpen(value)
          if (value) setName(current?.name || "")
        }
      }}
    >
      <Popover.Trigger asChild>
        <Button
          variant={compact || iconOnly ? "ghost" : "outline"}
          size={iconOnly ? "icon-sm" : "sm"}
          disabled={disabled}
          aria-label="Сохранить шаблон"
          title={compact || iconOnly ? "Сохранить шаблон" : undefined}
        >
          <BookmarkPlus />
          {!iconOnly && (compact ? "Шаблон" : "Сохранить шаблон")}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="template-save-popover"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <label htmlFor={id}>Название шаблона</label>
            <Input
              id={id}
              maxLength={50}
              value={name}
              autoFocus
              disabled={saving}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, пятничный стрим"
            />
            <div className="template-save-actions">
              {current && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving || !name.trim()}
                  onClick={() => void save(true)}
                >
                  Создать копию
                </Button>
              )}
              <Button type="submit" size="sm" disabled={saving || !name.trim()}>
                {saving ? "Сохранение…" : current ? "Обновить" : "Сохранить"}
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
