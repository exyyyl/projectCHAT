import type { ReactNode } from "react"
import {
  Keyboard,
  LayoutTemplate,
  ListChecks,
  PanelsTopLeft,
  WifiOff,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type AppView =
  "polls" | "presets" | "widget" | "stream-dock" | "settings"

type AppSidebarProps = {
  view: AppView
  connected: boolean
  streamDockComingSoon: boolean
  account: ReactNode
  onNavigate: (view: AppView) => void
}

const pollNavigation = [
  { id: "polls", label: "Опросы", icon: ListChecks },
  { id: "presets", label: "Шаблоны", icon: LayoutTemplate },
  { id: "widget", label: "Виджет", icon: PanelsTopLeft },
] as const

export function AppSidebar({
  view,
  connected,
  streamDockComingSoon,
  account,
  onNavigate,
}: AppSidebarProps) {
  return (
    <aside className="flex h-screen w-55 shrink-0 flex-col border-r border-border-subtle bg-[#0d1014] p-3">
      <nav className="pt-2" aria-label="Разделы приложения">
        <div className="space-y-0.5 rounded-xl bg-white/[0.025] p-1">
          {pollNavigation.map((item) => {
            const Icon = item.icon
            const active = view === item.id
            return (
              <Button
                key={item.id}
                variant="ghost"
                className={`h-10 w-full justify-start gap-3 rounded-lg px-3 ${
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
        </div>

        <Button
          variant="ghost"
          className={`mt-3 h-10 w-full justify-start gap-3 rounded-lg px-3 ${
            view === "stream-dock"
              ? "bg-surface-raised text-foreground hover:bg-surface-raised"
              : "text-muted-foreground"
          }`}
          aria-current={view === "stream-dock" ? "page" : undefined}
          onClick={() => onNavigate("stream-dock")}
        >
          <Keyboard className={view === "stream-dock" ? "text-brand" : ""} />
          Stream Dock
          {streamDockComingSoon && (
            <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-medium tracking-wide text-muted-foreground uppercase">
              Скоро
            </span>
          )}
        </Button>
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

      <div className="mt-auto rounded-xl bg-white/[0.025] p-1">{account}</div>
    </aside>
  )
}
