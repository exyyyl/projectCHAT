import { useEffect, useRef } from "react"
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Gift,
  Grid3X3,
  LayoutTemplate,
  ListChecks,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelsTopLeft,
  Settings2,
  X,
} from "lucide-react"

import type { TabView, WorkspaceTab } from "@/domain/app-navigation"
import { SHOW_INPUT_OVERLAY } from "@/domain/release-features"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const sections: Partial<
  Record<TabView, { label: string; icon: typeof ListChecks }>
> = {
  polls: { label: "Опросы", icon: ListChecks },
  presets: { label: "Шаблоны", icon: LayoutTemplate },
  widget: { label: "Виджеты", icon: PanelsTopLeft },
  ...(SHOW_INPUT_OVERLAY
    ? {
        "input-overlay": {
          label: "Клавиши",
          icon: MousePointer2,
        },
      }
    : {}),
  contests: { label: "Конкурсы", icon: Gift },
  "stream-dock": { label: "Stream Dock", icon: Grid3X3 },
  new: { label: "Новая вкладка", icon: Plus },
  settings: { label: "Настройки", icon: Settings2 },
}

export function AppTitleBar({
  sidebarCollapsed,
  onToggleSidebar,
  tabs = [],
  activeId,
  onSelect,
  onClose,
  onCreate,
  onHistory,
}: {
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
  tabs?: WorkspaceTab[]
  activeId?: string
  onSelect?: (id: string) => void
  onClose?: (id: string) => void
  onCreate?: () => void
  onHistory?: (offset: -1 | 1) => void
}) {
  const activeTab = useRef<HTMLDivElement>(null)
  useEffect(() => {
    activeTab.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeId, tabs, sidebarCollapsed])

  return (
    <header
      className="app-titlebar app-drag-region"
      data-mac={
        (Boolean(window.streamPollsDesktop) &&
          navigator.userAgent.includes("Mac")) ||
        undefined
      }
    >
      <div className="app-titlebar-tools">
        {onToggleSidebar && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                aria-label={
                  sidebarCollapsed ? "Показать сайдбар" : "Скрыть сайдбар"
                }
                aria-expanded={!sidebarCollapsed}
                onClick={onToggleSidebar}
              >
                {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {sidebarCollapsed ? "Показать сайдбар" : "Скрыть сайдбар"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="app-history">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Назад"
          disabled={!tabs.find((tab) => tab.id === activeId)?.position}
          onClick={() => onHistory?.(-1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Вперёд"
          disabled={(() => {
            const tab = tabs.find((tab) => tab.id === activeId)
            return !tab || tab.position === tab.history.length - 1
          })()}
          onClick={() => onHistory?.(1)}
        >
          <ChevronRight />
        </Button>
      </div>
      <nav className="app-tabs" aria-label="Вкладки">
        {tabs.map((tab) => {
          const view = tab.history[tab.position]
          const { label, icon: Icon } = sections[view] || sections.polls!
          const active = activeId === tab.id
          return (
            <div
              key={tab.id}
              ref={active ? activeTab : undefined}
              className="app-tab"
              data-active={active || undefined}
            >
              <button
                type="button"
                className="app-tab-select"
                title={label}
                aria-current={active ? "page" : undefined}
                onClick={() => onSelect?.(tab.id)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
              {tabs.length > 1 && (
                <button
                  type="button"
                  className="app-tab-close"
                  aria-label={`Закрыть вкладку «${label}»`}
                  onClick={(event) => {
                    const current = event.currentTarget.parentElement
                    const target = active
                      ? current?.previousElementSibling ||
                        current?.nextElementSibling
                      : activeTab.current
                    target
                      ?.querySelector<HTMLButtonElement>(".app-tab-select")
                      ?.focus()
                    onClose?.(tab.id)
                  }}
                >
                  <X aria-hidden="true" />
                </button>
              )}
            </div>
          )
        })}
        {tabs.length === 0 && (
          <span className="px-3 text-xs text-muted-foreground">Cue</span>
        )}
      </nav>
      {onCreate && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="app-tab-add"
          aria-label="Новая вкладка"
          onClick={onCreate}
        >
          <Plus />
        </Button>
      )}
    </header>
  )
}
