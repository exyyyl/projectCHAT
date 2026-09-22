import { useEffect, useState, type ReactNode } from "react"
import {
  Gift,
  Grid3X3,
  LayoutTemplate,
  ListChecks,
  MousePointer2,
  PanelsTopLeft,
  WifiOff,
  type LucideIcon,
} from "lucide-react"

import type { Contest } from "@/domain/contest"
import type { Poll } from "@/domain/polls"
import { SHOW_INPUT_OVERLAY } from "@/domain/release-features"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import type { AppView, TabView } from "@/domain/app-navigation"

type AppSidebarProps = {
  view: TabView
  connected: boolean
  poll: Poll | null
  contest: Contest | null
  account: ReactNode
  onNavigate: (view: AppView) => void
}

const pollNavigation = [
  { id: "polls", label: "Опросы", icon: ListChecks },
  { id: "presets", label: "Шаблоны", icon: LayoutTemplate },
  { id: "widget", label: "Виджеты", icon: PanelsTopLeft },
] as const

const secondaryNavigation = [
  { id: "contests", label: "Конкурсы", icon: Gift },
  ...(SHOW_INPUT_OVERLAY
    ? [
        {
          id: "input-overlay" as const,
          label: "Клавиши",
          icon: MousePointer2,
        },
      ]
    : []),
  { id: "stream-dock", label: "Stream Dock", icon: Grid3X3 },
] as const

export function AppSidebar({
  view,
  connected,
  poll,
  contest,
  account,
  onNavigate,
}: AppSidebarProps) {
  return (
    <aside className="app-sidebar">
      <nav className="sidebar-navigation" aria-label="Разделы приложения">
        <div
          className="sidebar-primary"
          role="group"
          aria-label="Опросы, шаблоны и виджеты"
        >
          {pollNavigation.map((item) => (
            <SidebarNavButton
              key={item.id}
              item={item}
              active={view === item.id}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </div>
        <div className="sidebar-secondary">
          {secondaryNavigation.map((item) => (
            <SidebarNavButton
              key={item.id}
              item={item}
              active={view === item.id}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </div>
      </nav>
      <div className="sidebar-bottom">
        {!connected && (
          <span className="sidebar-offline">
            <WifiOff aria-hidden="true" />
            Нет связи
          </span>
        )}
        <SidebarActivity
          poll={poll}
          contest={contest}
          collapsed={false}
          onNavigate={onNavigate}
        />
        <div className="sidebar-profile">{account}</div>
      </div>
    </aside>
  )
}

function SidebarNavButton({
  item,
  active,
  onClick,
}: {
  item: { id: AppView; label: string; icon: LucideIcon }
  active: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      className="sidebar-link"
      data-active={active || undefined}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
      <span>{item.label}</span>
    </button>
  )
}

function SidebarActivity({
  poll,
  contest,
  collapsed,
  onNavigate,
}: {
  poll: Poll | null
  contest: Contest | null
  collapsed: boolean
  onNavigate: (view: AppView) => void
}) {
  const activePoll = poll?.status === "running" ? poll : null
  const activeContest =
    contest && contest.status !== "finished" ? contest : null
  const [now, setNow] = useState(0)
  const hasActivity = Boolean(activePoll || activeContest)

  useEffect(() => {
    if (!hasActivity) return
    const firstTick = window.setTimeout(() => setNow(Date.now()), 0)
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearTimeout(firstTick)
      window.clearInterval(timer)
    }
  }, [hasActivity])

  if (!hasActivity) return null

  return (
    <div className="mb-2 space-y-1" aria-label="Текущая активность">
      {activePoll && (
        <ActivityButton
          label="Опрос идёт"
          title={activePoll.question}
          value={formatRemaining(activePoll.deadline, now)}
          icon={<ListChecks />}
          collapsed={collapsed}
          onClick={() => onNavigate("polls")}
        />
      )}
      {activeContest && (
        <ActivityButton
          label={contestStatus(activeContest)}
          title={`#${activeContest.keyword}`}
          value={
            activeContest.status === "collecting"
              ? formatRemaining(activeContest.deadline, now)
              : `${activeContest.participants.length}`
          }
          icon={<Gift />}
          collapsed={collapsed}
          onClick={() => onNavigate("contests")}
        />
      )}
    </div>
  )
}

function ActivityButton({
  label,
  title,
  value,
  icon,
  collapsed,
  onClick,
}: {
  label: string
  title: string
  value: string
  icon: ReactNode
  collapsed: boolean
  onClick: () => void
}) {
  const button = (
    <button
      type="button"
      className={cn(
        "group w-full rounded-lg bg-brand/7 text-left ring-1 ring-brand/10 transition-colors ring-inset hover:bg-brand/11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        collapsed ? "flex h-10 items-center justify-center" : "px-3 py-2.5"
      )}
      aria-label={`${label}, ${value}, ${title}`}
      onClick={onClick}
    >
      {collapsed ? (
        <span className="text-brand [&_svg]:size-4">{icon}</span>
      ) : (
        <>
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-brand [&_svg]:size-3.5">{icon}</span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {label}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-brand tabular-nums">
              {value}
            </span>
          </span>
          <span className="mt-1 block truncate pl-5.5 text-[11px] text-muted-foreground transition-colors group-hover:text-foreground/75">
            {title}
          </span>
        </>
      )}
    </button>
  )

  if (!collapsed) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <span>{label}</span>
        <span className="font-mono text-background/70">{value}</span>
      </TooltipContent>
    </Tooltip>
  )
}

function formatRemaining(deadline: number, now: number) {
  if (!now) return "--:--"
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

function contestStatus(contest: Contest) {
  if (contest.status === "collecting") return "Идёт набор"
  if (contest.status === "ready") return "Рулетка готова"
  return "Победитель выбран"
}
