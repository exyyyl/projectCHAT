import {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react"
import { Clock3, GripVertical, Pin, Plus, Radio, Trash2 } from "lucide-react"

import { PresetEditor } from "@/components/preset-editor"
import {
  LibraryContent,
  LibraryRail,
  LibraryWorkspace,
} from "@/components/page-layout"
import { Button } from "@/components/ui/button"
import {
  formatTime,
  type Draft,
  type Preset,
  type PresetDialogState,
} from "@/domain/polls"
import { useDemoMode } from "@/hooks/use-demo-mode"

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
  const animatedOrder = useRef("")

  if (selectedId !== previousSelectedId) {
    setPreviousSelectedId(selectedId)
    if (selectedId) setActiveId(selectedId)
  }

  const activePreset =
    presets.find((preset) => preset.id === activeId) || presets[0]

  useLayoutEffect(() => {
    const order = presets
      .map((preset) => `${preset.id}:${preset.pinned ? "pinned" : "regular"}`)
      .join("|")
    if (order === animatedOrder.current) return
    animatedOrder.current = order

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
  })

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
    <LibraryWorkspace aria-label="Шаблоны" data-editing={!!dialog}>
      <LibraryRail className={dialog ? "hidden" : undefined}>
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

        <div className="mt-3 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
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
                    className={`w-full rounded-xl py-3 pr-3 pl-9 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset ${
                      active
                        ? "bg-surface-raised text-foreground"
                        : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
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
        </div>
      </LibraryRail>

      <LibraryContent>
        {dialog ? (
          <PresetEditor
            key={dialog.mode === "edit" ? dialog.preset.id : dialog.editorId}
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
      </LibraryContent>
    </LibraryWorkspace>
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
  const { enabled: demoEnabled } = useDemoMode()
  const { draft } = preset

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ containerType: "inline-size" }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
        <div className="mx-auto max-w-2xl">
          <div className="min-w-0">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <h2 className="min-w-0 text-xl leading-snug font-semibold tracking-[-0.02em] [overflow-wrap:anywhere]">
                {preset.name}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="-mt-1 shrink-0"
                disabled={!canManage || busy}
                aria-label={
                  preset.pinned ? "Открепить шаблон" : "Закрепить шаблон"
                }
                aria-pressed={preset.pinned}
                onClick={onTogglePin}
              >
                <Pin
                  className={
                    preset.pinned
                      ? "fill-brand/20 text-brand"
                      : "text-muted-foreground"
                  }
                />
              </Button>
            </div>
            {draft.question.trim() !== preset.name.trim() && (
              <p className="mt-2 text-sm leading-relaxed [overflow-wrap:anywhere] text-muted-foreground">
                {draft.question}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Property icon={<Clock3 />}>
                {formatTime(draft.duration)}
              </Property>
              <Property icon={<Radio />}>
                {draft.source === "twitch" || !demoEnabled ? "Twitch" : "Демо"}
              </Property>
              <Property>
                {draft.showOverlay ? "Виджет включён" : "Без виджета"}
              </Property>
              {draft.secret && <Property>Скрытые результаты</Property>}
              {draft.allowChange && <Property>Можно переголосовать</Property>}
              {applied && <span className="text-xs text-brand">В опросе</span>}
            </div>

            <div className="mt-6 space-y-1 rounded-lg bg-surface-subtle p-1">
              {draft.options.map((option, optionIndex) => (
                <div
                  key={option.id}
                  className="group flex min-h-11 items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-surface-raised/70"
                >
                  <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground/55 tabular-nums">
                    {optionIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium [overflow-wrap:anywhere]">
                    {option.name}
                  </span>
                  <span className="max-w-[40%] truncate font-mono text-xs text-brand/75">
                    {option.word}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="preset-detail-footer grid min-h-17 shrink-0 grid-cols-[auto_1fr_auto_auto] items-center gap-2 bg-panel-muted px-4 py-3 transition-colors">
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={!canManage || busy}
          onClick={onDelete}
        >
          <Trash2 />
          <span className="sr-only">Удалить шаблон</span>
        </Button>
        <span />
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
                ? "Опрос идёт"
                : "Использовать"}
        </Button>
      </div>
    </div>
  )
}

function Property({
  icon,
  children,
}: {
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <span className="flex min-h-5 items-start gap-2 text-xs leading-5 text-muted-foreground [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0">
      {icon || (
        <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/45" />
      )}
      {children}
    </span>
  )
}
