import {
  ChevronDown,
  HardDrive,
  ListChecks,
  ListTodo,
  ArrowUpDown,
  StickyNote,
  Timer,
  Hash,
  UsersRound,
  Plus,
  Minus,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react"
import {
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { AnimatedSettings } from "./animated-settings"
import { widgetIds, type WidgetId } from "@/domain/streamer-widgets"
import "./dashboard-blocks-menu.css"

type MenuBlock = {
  id: WidgetId | "participants"
  label: string
  icon: LucideIcon
}

const blocks: Record<WidgetId | "participants", MenuBlock> = {
  participants: { id: "participants", label: "Участники", icon: UsersRound },
  activity: { id: "activity", label: "Сейчас", icon: ListChecks },
  timer: { id: "timer", label: "Таймер", icon: Timer },
  counter: { id: "counter", label: "Счётчик", icon: Hash },
  notes: { id: "notes", label: "Заметки", icon: StickyNote },
  todos: { id: "todos", label: "Список дел", icon: ListTodo },
  archive: { id: "archive", label: "Архив чата", icon: HardDrive },
}

function BlockRow({
  block,
  enabled,
  onToggle,
}: {
  block: MenuBlock
  enabled: boolean
  onToggle: () => void
}) {
  const Icon = block.icon
  return (
    <li className="dashboard-block-row" data-enabled={enabled || undefined}>
      <button
        type="button"
        className="dashboard-block-toggle"
        aria-pressed={enabled}
        aria-label={`${enabled ? "Убрать" : "Добавить"} блок ${block.label}`}
        onClick={onToggle}
      >
        <Icon aria-hidden="true" />
        <span>{block.label}</span>
        {enabled ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}
      </button>
    </li>
  )
}

export function DashboardBlocksMenu({
  order,
  onChange,
  participants,
  onParticipantsChange,
  onArrange,
}: {
  onArrange: () => void
  participants: boolean
  onParticipantsChange: (value: boolean) => void
  order: WidgetId[]
  onChange: Dispatch<SetStateAction<WidgetId[]>>
}) {
  const prefix = useId()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const toggle = (id: MenuBlock["id"]) => {
    if (id === "participants") return onParticipantsChange(!participants)
    onChange((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }
  // "Сейчас" is permanent, so it never appears in the menu.
  const added: MenuBlock[] = [
    ...(participants ? [blocks.participants] : []),
    ...order.filter((id) => id !== "activity").map((id) => blocks[id]),
  ]
  const available: MenuBlock[] = [
    ...(participants ? [] : [blocks.participants]),
    ...widgetIds
      .filter((id) => id !== "activity" && !order.includes(id))
      .map((id) => blocks[id]),
  ]
  return (
    <div
      className="dashboard-blocks-menu"
      data-open={open || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          trigger.current?.focus()
        }
      }}
    >
      <button
        type="button"
        className="dashboard-blocks-trigger"
        ref={trigger}
        aria-label="Настроить блоки Студии"
        aria-expanded={open}
        aria-controls={prefix + "-content"}
        onClick={() => setOpen((value) => !value)}
      >
        <LayoutGrid aria-hidden="true" />
        <span>Блоки</span>
        <ChevronDown aria-hidden="true" />
      </button>
      <AnimatedSettings active={open ? "blocks" : null}>
        {() => (
          <div
            id={prefix + "-content"}
            className="dashboard-blocks-content"
            role="region"
            aria-label="Блоки Студии"
          >
            {added.length > 0 && (
              <section
                className="dashboard-blocks-group"
                aria-labelledby={prefix + "-added"}
              >
                <div className="dashboard-blocks-group-heading">
                  <h3 id={prefix + "-added"}>На экране</h3>
                  {order.length > 2 && (
                    <button
                      type="button"
                      className="dashboard-blocks-arrange"
                      aria-label="Изменить порядок блоков"
                      title="Изменить порядок"
                      onClick={() => {
                        setOpen(false)
                        onArrange()
                      }}
                    >
                      <ArrowUpDown aria-hidden="true" />
                    </button>
                  )}
                </div>
                <ul className="dashboard-blocks-list">
                  {added.map((block) => (
                    <BlockRow
                      key={block.id}
                      block={block}
                      enabled
                      onToggle={() => toggle(block.id)}
                    />
                  ))}
                </ul>
              </section>
            )}
            {available.length > 0 && (
              <section
                className="dashboard-blocks-group"
                aria-labelledby={prefix + "-available"}
              >
                <h3 id={prefix + "-available"}>Можно добавить</h3>
                <ul className="dashboard-blocks-list">
                  {available.map((block) => (
                    <BlockRow
                      key={block.id}
                      block={block}
                      enabled={false}
                      onToggle={() => toggle(block.id)}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </AnimatedSettings>
    </div>
  )
}
