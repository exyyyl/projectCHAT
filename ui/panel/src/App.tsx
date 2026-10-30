import { useEffect, useReducer, useState } from "react"
import {
  Gift,
  LayoutTemplate,
  ListChecks,
  PanelsTopLeft,
  Settings2,
  CircleDashed,
  MessageCircle,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { AnimatedSidebar } from "@/components/animated-sidebar"
import { HoverSidebar } from "@/components/hover-sidebar"
import { AppTitleBar } from "@/components/app-title-bar"
import { ContestPage } from "@/components/contest-page"
import { ChatHomePage } from "@/components/chat-home-page"
import { DecisionWheelPage } from "@/components/decision-wheel-page"
import { PollWorkspace } from "@/components/poll-workspace"
import { PresetDialogs } from "@/components/preset-dialogs"
import { PresetLibrary } from "@/components/preset-library"
import { SettingsPage } from "@/components/settings-page"
import { TwitchAccount } from "@/components/twitch-account"
import { WidgetPage } from "@/components/widget-page"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ToastProvider, ToastViewport, useToast } from "@/components/ui/toast"
import { useContestController } from "@/hooks/use-contest-controller"
import { usePollController } from "@/hooks/use-poll-controller"
import { useDemoMode } from "@/hooks/use-demo-mode"

import {
  initialNavigation,
  navigationReducer,
  type AppView,
  type WorkspaceTab,
} from "@/domain/app-navigation"
import type { PresetDialogState, Draft } from "@/domain/polls"

const newTabItems = [
  {
    id: "home",
    label: "Главная",
    description: "Чат и зрители",
    icon: MessageCircle,
  },
  {
    id: "polls",
    label: "Опросы",
    description: "Голосование в Twitch-чате",
    icon: ListChecks,
    wide: true,
    accent: true,
  },
  {
    id: "contests",
    label: "Конкурсы",
    description: "Выбор победителя",
    icon: Gift,
  },
  {
    id: "presets",
    label: "Шаблоны",
    description: "Готовые сценарии",
    icon: LayoutTemplate,
  },
  {
    id: "decision-wheel",
    label: "Рулетка",
    description: "Что выбрать дальше",
    icon: CircleDashed,
  },
  {
    id: "widget",
    label: "Виджеты",
    description: "Оформление для OBS",
    icon: PanelsTopLeft,
  },
  {
    id: "settings",
    label: "Настройки",
    description: "Приложение и аккаунт",
    icon: Settings2,
    wide: true,
  },
] satisfies ReadonlyArray<{
  id: AppView
  label: string
  description: string
  icon: typeof ListChecks
  wide?: boolean
  accent?: boolean
}>

export function App() {
  return (
    <ToastProvider>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </ToastProvider>
  )
}

function AppContent() {
  const controller = usePollController()
  const versionReady = Boolean(controller.state)
  useEffect(() => {
    if (versionReady)
      void window.streamPollsDesktop?.markVersionHealthy?.().catch(() => {})
  }, [versionReady])
  const contestController = useContestController()
  const showToast = useToast()
  const { enabled: demoEnabled } = useDemoMode()
  const [navigation, dispatch] = useReducer(
    navigationReducer,
    undefined,
    initialNavigation
  )
  const activeTab = navigation.tabs.find(
    (tab) => tab.id === navigation.activeId
  )!
  const view = activeTab.history[activeTab.position]
  const navigate = (next: AppView) => dispatch({ type: "navigate", view: next })
  const [sidebarManuallyCollapsed, setSidebarManuallyCollapsed] = useState(
    () => localStorage.getItem("vela-sidebar-collapsed") === "true"
  )
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 1100px)").matches
  )
  const [compactPinned, setCompactPinned] = useState(false)
  const [sidebarPeek, setSidebarPeek] = useState(false)
  const sidebarCollapsed = compact || sidebarManuallyCollapsed
  const hoverSidebarOpen = sidebarCollapsed && (sidebarPeek || compactPinned)
  const toggleSidebar = () => {
    if (compact) {
      setCompactPinned((current) => !current)
      setSidebarPeek(false)
      return
    }
    const next = !sidebarManuallyCollapsed
    localStorage.setItem("vela-sidebar-collapsed", String(next))
    setSidebarManuallyCollapsed(next)
    setSidebarPeek(false)
  }
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1100px)")
    const update = () => {
      setCompact(media.matches)
      setCompactPinned(false)
      setSidebarPeek(false)
    }
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      if (event.key.toLowerCase() === "t") {
        event.preventDefault()
        dispatch({ type: "create", id: crypto.randomUUID() })
      } else if (event.key.toLowerCase() === "w") {
        event.preventDefault()
        dispatch({ type: "close", id: navigation.activeId })
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [navigation.activeId])
  const {
    state,
    draft,
    twitch,
    connected,
    error,
    deletePreset,
    poll,
    twitchWarning,
    changeDraft,
  } = controller

  useEffect(() => {
    if (error) showToast({ message: error, tone: "error" })
  }, [error, showToast])

  useEffect(() => {
    if (twitchWarning)
      showToast({ message: twitchWarning, tone: "warning", duration: 6500 })
  }, [showToast, twitchWarning])

  useEffect(() => {
    if (!demoEnabled && draft?.source === "test" && !poll)
      changeDraft((current) => ({ ...current, source: "twitch" }))
  }, [changeDraft, demoEnabled, draft?.source, poll])

  if (!state || !draft)
    return (
      <div className="app-shell">
        <AppTitleBar
          sidebarCollapsed={sidebarCollapsed && !compactPinned}
          onToggleSidebar={toggleSidebar}
        />
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          Подключение…
        </div>
        <ToastViewport />
      </div>
    )

  return (
    <div className="app-shell">
      <AppTitleBar
        sidebarCollapsed={sidebarCollapsed && !compactPinned}
        onToggleSidebar={toggleSidebar}
        tabs={navigation.tabs}
        activeId={navigation.activeId}
        onSelect={(id) => dispatch({ type: "select", id })}
        onClose={(id) => dispatch({ type: "close", id })}
        onCreate={() => dispatch({ type: "create", id: crypto.randomUUID() })}
        onHistory={(offset) => dispatch({ type: "history", offset })}
      />
      <div className="app-body">
        <AnimatedSidebar collapsed={sidebarCollapsed}>
          <AppSidebar
            view={view}
            connected={connected}
            poll={poll}
            contest={contestController.contest}
            onNavigate={navigate}
            account={
              <TwitchAccount
                state={twitch}
                active={view === "settings"}
                onClick={() => navigate("settings")}
              />
            }
          />
        </AnimatedSidebar>
        {sidebarCollapsed && (
          <>
            <div
              className="app-sidebar-edge"
              onMouseEnter={() => setSidebarPeek(true)}
              aria-hidden="true"
            />
            <HoverSidebar
              open={hoverSidebarOpen}
              onClose={() => setSidebarPeek(false)}
            >
              <AppSidebar
                view={view}
                connected={connected}
                poll={poll}
                contest={contestController.contest}
                onNavigate={(next) => {
                  navigate(next)
                  setSidebarPeek(false)
                  setCompactPinned(false)
                }}
                account={
                  <TwitchAccount
                    state={twitch}
                    active={view === "settings"}
                    onClick={() => {
                      navigate("settings")
                      setSidebarPeek(false)
                      setCompactPinned(false)
                    }}
                  />
                }
              />
            </HoverSidebar>
          </>
        )}

        <main className="app-content">
          {navigation.tabs.map((tab) => (
            <div
              key={tab.id}
              className={tab.id === navigation.activeId ? "h-full" : "hidden"}
            >
              <TabWorkspace
                tab={tab}
                controller={controller}
                contestController={contestController}
                onNavigate={(next) =>
                  dispatch({ type: "navigate", tabId: tab.id, view: next })
                }
              />
            </div>
          ))}
        </main>

        <PresetDialogs
          pendingDelete={deletePreset}
          onDeleteChange={controller.setDeletePreset}
          onConfirmDelete={(preset) => {
            void controller.run("preset-delete", { presetId: preset.id })
            controller.setDeletePreset(null)
          }}
        />
      </div>
      <ToastViewport />
    </div>
  )
}

function TabWorkspace({
  tab,
  controller,
  contestController,
  onNavigate: navigate,
}: {
  tab: WorkspaceTab
  controller: ReturnType<typeof usePollController>
  contestController: ReturnType<typeof useContestController>
  onNavigate: (view: AppView) => void
}) {
  const {
    state,
    draft,
    twitch,
    connected,
    busy,
    poll,
    canEdit,
    canApplyPreset,
    changeDraft,
  } = controller
  const { enabled: demoEnabled } = useDemoMode()
  const [presetDialog, setPresetDialog] = useState<PresetDialogState | null>(
    null
  )
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const view = tab.history[tab.position]
  const savePreset = async (name: string, presetDraft: Draft) => {
    const result =
      presetDialog?.mode === "edit"
        ? await controller.run("preset-update", {
            presetId: presetDialog.preset.id,
            name: name.trim(),
            draft: presetDraft,
          })
        : await controller.run("preset-create", {
            name: name.trim(),
            draft: presetDraft,
          })
    if (!result) return false
    if (presetDialog?.mode === "create")
      setSelectedPreset(result.state.presets.at(-1)?.id || null)
    setPresetDialog(null)
    return true
  }
  if (!state || !draft) return null
  return (
    <>
      {view === "home" && (
        <div className="h-full">
          <ChatHomePage
            key={twitch.userId || "offline"}
            emoteProvider={state.chatOverlay?.emoteProvider}
            twitch={twitch}
            poll={poll}
            contest={contestController.contest}
            onNavigate={navigate}
          />
        </div>
      )}
      {tab.visited.includes("decision-wheel") && (
        <div className={view === "decision-wheel" ? "h-full" : "hidden"}>
          <DecisionWheelPage />
        </div>
      )}
      {view === "new" && (
        <div className="new-tab-page">
          <div className="new-tab-lobby">
            <h1>Куда перейти?</h1>
            <div className="new-tab-grid">
              {newTabItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="new-tab-tile"
                    data-wide={item.wide || undefined}
                    data-accent={item.accent || undefined}
                    onClick={() => navigate(item.id)}
                  >
                    <span className="new-tab-tile-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="new-tab-tile-copy">
                      <span className="new-tab-tile-title">{item.label}</span>
                      <span className="new-tab-tile-description">
                        {item.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
      {tab.visited.includes("polls") && (
        <div className={view === "polls" ? "h-full" : "hidden"}>
          <PollWorkspace
            poll={poll}
            draft={draft}
            connected={connected}
            busy={busy}
            twitchPhase={twitch.phase}
            onChangeDraft={changeDraft}
            onStart={() => void controller.start()}
            onClear={() => void controller.clear()}
            onSetOutput={(visible) => void controller.setOutput(visible)}
            onRun={controller.run}
            onVote={(option) => void controller.vote(option)}
            onSimulate={controller.simulate}
            canCreatePreset={state.presets.length < 30}
            onSaveAsPreset={(presetDraft) => {
              setPresetDialog({
                mode: "create",
                editorId: crypto.randomUUID(),
                draft: structuredClone(presetDraft),
                name: presetDraft.question.trim().slice(0, 50),
              })
              navigate("presets")
            }}
          />
        </div>
      )}

      <div
        className={view === "presets" ? "h-full" : "hidden"}
        aria-hidden={view === "presets" ? undefined : true}
      >
        <PresetLibrary
          presets={state.presets}
          selectedId={selectedPreset}
          dialog={presetDialog}
          canApply={canApplyPreset}
          applyBlocked={poll?.status === "running"}
          canManage={connected}
          canCreate={state.presets.length < 30}
          busy={busy}
          onCreate={() =>
            setPresetDialog({
              mode: "create",
              editorId: crypto.randomUUID(),
            })
          }
          onApply={(preset) => {
            void controller.applyPreset(preset).then((applied) => {
              if (applied) {
                if (!demoEnabled)
                  changeDraft((current) =>
                    current.source === "test"
                      ? { ...current, source: "twitch" }
                      : current
                  )
                navigate("polls")
              }
            })
          }}
          onEdit={(preset) => setPresetDialog({ mode: "edit", preset })}
          onTogglePin={(preset) =>
            void controller.run("preset-toggle-pin", {
              presetId: preset.id,
              pinned: !preset.pinned,
            })
          }
          onReorder={(preset, target, position) =>
            void controller.run("preset-reorder", {
              presetId: preset.id,
              targetId: target.id,
              position,
            })
          }
          onDelete={controller.setDeletePreset}
          onSave={savePreset}
          onCloseEditor={() => setPresetDialog(null)}
        />
      </div>

      {tab.visited.includes("settings") && (
        <div className={view === "settings" ? "h-full" : "hidden"}>
          <SettingsPage
            draft={draft}
            presets={state.presets}
            widget={state.widget}
            contestOverlay={state.contestOverlay}
            chatOverlay={state.chatOverlay}
            canImport={canEdit}
            busy={busy}
            twitch={twitch}
            onImport={controller.importSettings}
            onTwitchCommand={(type) => void controller.twitchCommand(type)}
          />
        </div>
      )}

      {tab.visited.includes("contests") && (
        <div className={view === "contests" ? "h-full" : "hidden"}>
          <ContestPage
            twitchConnected={twitch.phase === "connected"}
            controller={contestController}
          />
        </div>
      )}

      {tab.visited.includes("widget") && (
        <div className={view === "widget" ? "h-full" : "hidden"}>
          <WidgetPage
            contest={contestController.contest}
            poll={poll}
            draft={draft}
            widget={state.widget}
            contestOverlay={state.contestOverlay}
            onUpdateContestOverlay={(patch) =>
              void controller.updateContestOverlay(patch)
            }
            chatOverlay={state.chatOverlay}
            busy={busy}
            onUpdateChatOverlay={(patch) =>
              void controller.updateChatOverlay(patch)
            }
            onUpdate={(patch) => void controller.updateWidget(patch)}
            onSetOutput={(visible) => void controller.setOutput(visible)}
          />
        </div>
      )}
    </>
  )
}

export default App
