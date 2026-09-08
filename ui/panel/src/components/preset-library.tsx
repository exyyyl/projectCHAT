import {
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  Plus,
  Save,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Preset } from "@/domain/polls"

type PresetLibraryProps = {
  presets: Preset[]
  selectedId: string | null
  canEdit: boolean
  canCreate: boolean
  busy: boolean
  onCreate: () => void
  onApply: (preset: Preset) => void
  onUpdate: (preset: Preset) => void
  onRename: (preset: Preset) => void
  onMove: (preset: Preset, direction: -1 | 1) => void
  onDelete: (preset: Preset) => void
}

export function PresetLibrary({
  presets,
  selectedId,
  canEdit,
  canCreate,
  busy,
  onCreate,
  onApply,
  onUpdate,
  onRename,
  onMove,
  onDelete,
}: PresetLibraryProps) {
  return (
    <section className="p-6 lg:p-8">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Шаблоны</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Готовые опросы для быстрого запуска
          </p>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {presets.length}/30
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
        <button
          className="group flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface-subtle text-muted-foreground transition-colors hover:border-brand/40 hover:bg-brand/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
          disabled={!canEdit || !canCreate}
          onClick={onCreate}
        >
          <span className="flex size-9 items-center justify-center rounded-full border border-border-strong bg-surface-raised transition-colors group-hover:border-brand/30 group-hover:text-brand">
            <Plus className="size-4" />
          </span>
          <span className="text-sm font-medium">Новый шаблон</span>
        </button>

        {presets.map((preset, index) => (
          <article
            key={preset.id}
            className={`group relative min-h-36 overflow-hidden rounded-xl border transition-colors ${
              selectedId === preset.id
                ? "border-brand/35 bg-brand/8"
                : "border-border-subtle bg-surface-subtle hover:border-border-strong hover:bg-surface-raised"
            }`}
          >
            <button
              className="flex size-full min-h-36 flex-col items-start p-4 pr-11 text-left disabled:opacity-40"
              disabled={!canEdit || busy}
              onClick={() => onApply(preset)}
            >
              <span className="max-w-full truncate text-[15px] font-medium">
                {preset.name}
              </span>
              <span className="mt-2 line-clamp-2 text-sm leading-snug text-muted-foreground">
                {preset.draft.question}
              </span>
              <span className="mt-auto pt-4 text-[11px] text-muted-foreground/70">
                Вариантов: {preset.draft.options.length}
              </span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-3 right-3 rounded-md opacity-60 hover:opacity-100"
                  disabled={!canEdit || busy}
                >
                  <MoreHorizontal />
                  <span className="sr-only">
                    Действия с шаблоном {preset.name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => onUpdate(preset)}>
                  <Save />
                  Обновить содержимое
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onRename(preset)}>
                  Переименовать
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={index === 0}
                  onSelect={() => onMove(preset, -1)}
                >
                  <ArrowLeft />
                  Переместить влево
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={index === presets.length - 1}
                  onSelect={() => onMove(preset, 1)}
                >
                  <ArrowRight />
                  Переместить вправо
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onDelete(preset)}
                >
                  <Trash2 />
                  Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </article>
        ))}
      </div>
    </section>
  )
}
