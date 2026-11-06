import { useEffect, useState, type ReactNode } from "react"
import {
  ArrowLeft,
  Settings2,
  Palette,
  RefreshCw,
  FileUp,
  Puzzle,
  FileWarning,
  Info,
  Gift,
  HandCoins,
  CircleDashed,
  LayoutTemplate,
  ListChecks,
  PanelsTopLeft,
  WifiOff,
  MessageCircle,
  type LucideIcon,
} from "lucide-react"

import {
  settingsTitles,
  type SettingsSection,
} from "@/domain/settings-navigation"
import type { Contest } from "@/domain/contest"
import type { Poll } from "@/domain/polls"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  isViewAvailable,
  type AppView,
  type TabView,
} from "@/domain/app-navigation"

type AppSidebarProps = {
  settings?: {
    section: SettingsSection
    onSelect: (section: SettingsSection) => void
    onExit: () => void
  }
  view: TabView
  connected: boolean
  poll: Poll | null
  contest: Contest | null
  account: ReactNode
  onNavigate: (view: AppView) => void
}

const navigation = [
  { id: "home", label: "Студия", icon: MessageCircle },
  { id: "polls", label: "Опросы", icon: ListChecks },
  { id: "presets", label: "Шаблоны", icon: LayoutTemplate },
  { id: "widget", label: "Виджеты", icon: PanelsTopLeft },
  { id: "contests", label: "Конкурсы", icon: Gift },
  { id: "decision-wheel", label: "Рулетка", icon: CircleDashed },
  { id: "donations", label: "Донаты", icon: HandCoins },
] as const

const settingsNavigation: ReadonlyArray<{
  id: SettingsSection
  icon: LucideIcon
}> = [
  { id: "general", icon: Settings2 },
  { id: "appearance", icon: Palette },
  { id: "updates", icon: RefreshCw },
  { id: "data", icon: FileUp },
  { id: "plugins", icon: Puzzle },
  { id: "diagnostics", icon: FileWarning },
  { id: "about", icon: Info },
]

export function AppSidebar({
  view,
  settings,
  connected,
  poll,
  contest,
  account,
  onNavigate,
}: AppSidebarProps) {
  return (
    <aside
      className={cn(
        "app-sidebar",
        view === "settings" && "app-sidebar--settings"
      )}
    >
      {view === "settings" && settings ? (
        <nav className="sidebar-navigation" aria-label="Разделы настроек">
          {settingsNavigation.map(({ id, icon: Icon }) => (
            <button
              type="button"
              className="sidebar-link"
              aria-label={settingsTitles[id]}
              key={id}
              data-active={settings.section === id || undefined}
              aria-current={settings.section === id ? "page" : undefined}
              onClick={() => settings.onSelect(id)}
            >
              <Icon aria-hidden="true" />
              <span>{settingsTitles[id]}</span>
            </button>
          ))}
        </nav>
      ) : (
        <nav className="sidebar-navigation" aria-label="Разделы приложения">
          {navigation.map((item) => (
            <SidebarNavButton
              key={item.id}
              item={item}
              active={view === item.id}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </nav>
      )}
      <div className="sidebar-bottom">
        {!connected && (
          <span
            className="sidebar-offline"
            role="status"
            aria-label="Нет связи"
          >
            <WifiOff aria-hidden="true" />
            <span>Нет связи</span>
          </span>
        )}
        <SidebarActivity
          poll={poll}
          contest={contest}
          collapsed={false}
          onNavigate={onNavigate}
        />
        {view === "settings" && settings ? (
          <button
            type="button"
            className="sidebar-link sidebar-settings-back"
            aria-label="Назад"
            onClick={settings.onExit}
          >
            <ArrowLeft aria-hidden="true" />
            <span>Назад</span>
          </button>
        ) : (
          <div className="sidebar-profile">{account}</div>
        )}
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
  const available = isViewAvailable(item.id)
  return (
    <button
      type="button"
      className="sidebar-link"
      data-active={active || undefined}
      disabled={!available}
      aria-label={available ? item.label : `${item.label} — Скоро`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
      <span>{item.label}</span>
      {!available && <span className="section-soon">Скоро</span>}
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
    <div className="sidebar-activities" aria-label="Текущая активность">
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
        "sidebar-activity group w-full text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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
            <span className="shrink-0 text-xs text-foreground tabular-nums">
              {value}
            </span>
          </span>
          <span className="mt-1 block truncate pl-5.5 text-xs text-muted-foreground transition-colors group-hover:text-foreground/75">
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
