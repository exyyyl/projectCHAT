import {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react"
import { Clock3, GripVertical, Pin, Plus, Radio, Trash2 } from "lucide-react"

import { PresetEditor } from "@/components/preset-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  formatTime,
  type Draft,
  type Preset,
  type PresetDialogState,
} from "@/domain/polls"

type PresetLibraryProps = {
  presets: Preset[]
  selectedId: string | null
  dialog: PresetDialogState | null
  canApply: boolean
  applyBlocked: boolean
  canManage: boolean
  canCreate: boolean
  busy: boolean
  onCreate: () => void
  onApply: (preset: Preset) => void
  onEdit: (preset: Preset) => void
  onTogglePin: (preset: Preset) => void
  onReorder: (
    preset: Preset,
    target: Preset,
    position: "before" | "after"
  ) => void
  onDelete: (preset: Preset) => void
  onSave: (name: string, draft: Draft) => Promise<boolean>
  onCloseEditor: () => void
}

export function PresetLibrary({
  presets,
  selectedId,
  dialog,
  canApply,
  applyBlocked,
  canManage,
  canCreate,
  busy,
  onCreate,
  onApply,
  onEdit,
  onTogglePin,
  onReorder,
  onDelete,
  onSave,
  onCloseEditor,
}: PresetLibraryProps) {
  const [activeId, setActiveId] = useState<string | null>(
    selectedId || presets[0]?.id || null
  )
  const [previousSelectedId, setPreviousSelectedId] = useState(selectedId)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<"before" | "after">("before")
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const positions = useRef(new Map<string, number>())

  if (selectedId !== previousSelectedId) {
    setPreviousSelectedId(selectedId)
    if (selectedId) setActiveId(selectedId)
  }

  const activePreset =
    presets.find((preset) => preset.id === activeId) || presets[0]

  useLayoutEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    const nextPositions = new Map<string, number>()
    for (const preset of presets) {
      const element = itemRefs.current.get(preset.id)
      if (!element) continue
      const top = element.getBoundingClientRect().top
      nextPositions.set(preset.id, top)
      const previousTop = positions.current.get(preset.id)
      const delta = previousTop === undefined ? 0 : previousTop - top
      if (!reducedMotion && Math.abs(delta) > 1)
        element.animate(
          [
            { transform: `translateY(${delta}px)` },
            { transform: "translateY(0)" },
          ],
          { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" }
        )
    }
    positions.current = nextPositions
  }, [presets])

  const startDrag = (event: DragEvent<HTMLDivElement>, preset: Preset) => {
    if (!canManage || busy || dialog) return event.preventDefault()
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", preset.id)
    setDraggedId(preset.id)
  }

  const dragOver = (event: DragEvent<HTMLDivElement>, preset: Preset) => {
    const dragged = presets.find((item) => item.id === draggedId)
    if (
      !dragged ||
      dragged.id === preset.id ||
      dragged.pinned !== preset.pinned
    )
      return
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDropTargetId(preset.id)
    const bounds = event.currentTarget.getBoundingClientRect()
    setDropPosition(
      event.clientY < bounds.top + bounds.height / 2 ? "before" : "after"
    )
  }

  const drop = (event: DragEvent<HTMLDivElement>, target: Preset) => {
    event.preventDefault()
    const dragged = presets.find((item) => item.id === draggedId)
    if (dragged && dragged.id !== target.id && dragged.pinned === target.pinned)
      onReorder(dragged, target, dropPosition)
    setDraggedId(null)
    setDropTargetId(null)
  }

  return (
    <section
      className="grid h-full min-h-0 grid-cols-[18rem_minmax(0,1fr)] max-lg:grid-cols-[15rem_minmax(0,1fr)]"
      aria-label="Шаблоны"
    >
      <div className="flex min-h-0 flex-col bg-[#0e1116] p-3">
        <Button
          variant="secondary"
          className="h-11 w-full justify-start gap-3 px-3"
          disabled={!canManage || !canCreate || busy}
          onClick={onCreate}
        >
          <span className="flex size-6 items-center justify-center rounded-md bg-brand text-primary-foreground">
            <Plus className="size-3.5" />
          </span>
          Новый шаблон
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {presets.length}/30
          </span>
        </Button>

        <ScrollArea className="mt-3 min-h-0 flex-1">
          <div className="space-y-1">
            {presets.map((preset) => {
              const active = preset.id === activePreset?.id
              return (
                <div
                  key={preset.id}
                  ref={(element) => {
                    if (element) itemRefs.current.set(preset.id, element)
                    else itemRefs.current.delete(preset.id)
                  }}
                  draggable={canManage && !busy && !dialog}
                  className={`group relative rounded-xl transition-[background,opacity,box-shadow] ${
                    draggedId === preset.id ? "opacity-40" : "opacity-100"
                  } ${
                    dropTargetId === preset.id
                      ? dropPosition === "before"
                        ? "before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:rounded-full before:bg-brand"
                        : "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand"
                      : ""
                  }`}
                  onDragStart={(event) => startDrag(event, preset)}
                  onDragOver={(event) => dragOver(event, preset)}
                  onDrop={(event) => drop(event, preset)}
                  onDragEnd={() => {
                    setDraggedId(null)
                    setDropTargetId(null)
                  }}
                >
                  <button
                    className={`w-full rounded-xl py-3 pr-3 pl-9 text-left transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 focus-visible:outline-none ${
                      active
                        ? "bg-surface-raised text-foreground"
                        : "text-muted-foreground hover:bg-white/[0.025] hover:text-foreground"
                    }`}
                    aria-current={active ? "true" : undefined}
                    onClick={() => setActiveId(preset.id)}
                  >
                    <GripVertical className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground/35 transition-colors group-hover:text-muted-foreground" />
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {preset.name}
                      </span>
                      {preset.pinned && (
                        <Pin className="size-3.5 shrink-0 fill-brand/15 text-brand/70" />
                      )}
                      {selectedId === preset.id && (
                        <span className="size-1.5 shrink-0 rounded-full bg-brand" />
                      )}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground/75">
                      {preset.draft.question || "Без вопроса"}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col">
        {dialog ? (
          <PresetEditor
            key={dialog.mode === "edit" ? dialog.preset.id : "new"}
            dialog={dialog}
            busy={busy}
            onSave={onSave}
            onClose={onCloseEditor}
          />
        ) : activePreset ? (
          <PresetDetails
            preset={activePreset}
            applied={selectedId === activePreset.id}
            canApply={canApply}
            applyBlocked={applyBlocked}
            canManage={canManage}
            busy={busy}
            onApply={() => onApply(activePreset)}
            onEdit={() => onEdit(activePreset)}
            onTogglePin={() => onTogglePin(activePreset)}
            onDelete={() => onDelete(activePreset)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-xs text-center">
              <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-surface-raised text-brand">
                <Plus className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">Первый шаблон</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Сохраните опрос, который пригодится снова.
              </p>
              <Button
                className="mt-5"
                disabled={!canManage || !canCreate || busy}
                onClick={onCreate}
              >
                Создать шаблон
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function PresetDetails({
  preset,
  applied,
  canApply,
  applyBlocked,
  canManage,
  busy,
  onApply,
  onEdit,
  onTogglePin,
  onDelete,
}: {
  preset: Preset
  applied: boolean
  canApply: boolean
  applyBlocked: boolean
  canManage: boolean
  busy: boolean
  onApply: () => void
  onEdit: () => void
  onTogglePin: () => void
  onDelete: () => void
}) {
  const { draft } = preset

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start gap-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-2xl font-semibold tracking-[-0.03em]">
                  {preset.name}
                </h2>
                {applied && (
                  <Badge className="bg-brand/12 text-brand">В опросе</Badge>
                )}
              </div>
              <p className="mt-3 max-w-2xl text-lg leading-snug text-foreground/90">
                {draft.question}
              </p>
            </div>

            <Button
              variant={preset.pinned ? "secondary" : "ghost"}
              size="sm"
              disabled={!canManage || busy}
              aria-pressed={preset.pinned}
              onClick={onTogglePin}
            >
              <Pin
                className={preset.pinned ? "fill-brand/20 text-brand" : ""}
              />
              {preset.pinned ? "Закреплён" : "Закрепить"}
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <MetaBadge>
              <Clock3 /> {formatTime(draft.duration)}
            </MetaBadge>
            <MetaBadge>
              <Radio /> {draft.source === "twitch" ? "Twitch" : "Демо"}
            </MetaBadge>
            <MetaBadge>
              {draft.showOverlay ? "Виджет включён" : "Без виджета"}
            </MetaBadge>
            {draft.secret && <MetaBadge>Скрытые результаты</MetaBadge>}
            {draft.allowChange && <MetaBadge>Можно переголосовать</MetaBadge>}
          </div>

          <div className="mt-10 space-y-2">
            {draft.options.map((option, optionIndex) => (
              <div
                key={option.id}
                className="group flex min-h-14 items-center gap-4 rounded-xl bg-surface-subtle px-4 transition-colors hover:bg-surface-raised"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.045] text-xs font-medium text-muted-foreground">
                  {optionIndex + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {option.name}
                </span>
                <span className="max-w-48 truncate rounded-lg bg-brand/8 px-2.5 py-1 font-mono text-xs text-brand/80">
                  {option.word}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-17 shrink-0 items-center justify-between gap-4 bg-white/[0.018] px-6 py-3 lg:px-8">
        <Button
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={!canManage || busy}
          onClick={onDelete}
        >
          <Trash2 />
          Удалить
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={!canManage || busy}
            onClick={onEdit}
          >
            Редактировать
          </Button>
          <Button
            disabled={!canApply || !canManage || busy || applied}
            onClick={onApply}
          >
            {applied
              ? "Уже выбран"
              : !canManage
                ? "Нет подключения"
                : applyBlocked
                  ? "Сначала завершите опрос"
                  : "Использовать в опросе"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function MetaBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-white/[0.035] px-2.5 text-xs text-muted-foreground [&_svg]:size-3.5">
      {children}
    </span>
  )
}
