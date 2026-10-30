import { Gift, ListChecks, MessageCircle } from "lucide-react"

export type WidgetKind = "polls" | "chat" | "contests"
export function WidgetKindTabs({
  kind,
  onChange,
}: {
  kind: WidgetKind
  onChange: (kind: WidgetKind) => void
}) {
  const options = [
    { id: "polls", label: "Опросы", Icon: ListChecks },
    { id: "chat", label: "Чат", Icon: MessageCircle },
    { id: "contests", label: "Конкурсы", Icon: Gift },
  ] as const
  return (
    <div className="widget-kind-tabs" role="group" aria-label="Тип оверлея">
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={kind === id}
          onClick={() => {
            if (kind !== id) onChange(id as WidgetKind)
          }}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
