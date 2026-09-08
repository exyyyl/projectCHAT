import type { ReactNode } from "react"
import {
  LayoutTemplate,
  ListChecks,
  PanelsTopLeft,
  Settings2,
  WifiOff,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type AppView = "polls" | "presets" | "widget" | "settings"

type AppSidebarProps = {
  view: AppView
  connected: boolean
  account: ReactNode
  onNavigate: (view: AppView) => void
}

const navigation = [
  { id: "polls", label: "Опросы", icon: ListChecks },
  { id: "presets", label: "Шаблоны", icon: LayoutTemplate },
  { id: "widget", label: "Виджет", icon: PanelsTopLeft },
] as const

export function AppSidebar({
  view,
  connected,
  account,
  onNavigate,
}: AppSidebarProps) {
  return (
    <aside className="flex h-screen w-55 shrink-0 flex-col border-r border-border-subtle bg-[#0d1014] p-3">
      <nav className="space-y-1 pt-2" aria-label="Разделы приложения">
        {navigation.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <Button
              key={item.id}
              variant="ghost"
              className={`h-10 w-full justify-start gap-3 px-3 ${
                active
                  ? "bg-surface-raised text-foreground hover:bg-surface-raised"
                  : "text-muted-foreground"
              }`}
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon className={active ? "text-brand" : ""} />
              {item.label}
            </Button>
          )
        })}
      </nav>

      {!connected && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="mt-2 flex h-8 items-center gap-2 px-3 text-xs text-destructive">
              <WifiOff className="size-3.5" />
              Нет связи
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">
            Нет связи с локальным сервером
          </TooltipContent>
        </Tooltip>
      )}

      <div className="mt-auto flex items-center gap-1 border-t border-border-subtle pt-3">
        <div className="min-w-0 flex-1">{account}</div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-lg"
              className={
                view === "settings"
                  ? "bg-surface-raised text-brand"
                  : "text-muted-foreground"
              }
              aria-label="Настройки приложения"
              onClick={() => onNavigate("settings")}
            >
              <Settings2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Настройки приложения</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}
