import { useEffect, useReducer, useState } from "react"
import { AppLoadingSkeleton } from "@/components/loading-skeletons"
import { SectionTransition } from "@/components/section-transition"
import {
  Gift,
  HandCoins,
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
import { TemplateLibrary } from "@/components/template-library"
import type { SaveTemplate } from "@/components/template-save-button"
import {
  type LibraryTemplate,
  type LibraryKind,
  type TemplateKind,
} from "@/domain/templates"
import type { WidgetKind } from "@/components/widget-kind-tabs"
import type { SettingsSection } from "@/domain/settings-navigation"
import { SettingsPage } from "@/components/settings-page"
import { TwitchAccount } from "@/components/twitch-account"
import { WidgetPage } from "@/components/widget-page"
import { TooltipProvider } from "@/components/ui/tooltip"
import { revealErrorJournal } from "@/domain/diagnostics"
import { ToastProvider, ToastViewport, useToast } from "@/components/ui/toast"
import { useContestController } from "@/hooks/use-contest-controller"
import { usePollController } from "@/hooks/use-poll-controller"
import { useDemoMode } from "@/hooks/use-demo-mode"

import {
  initialNavigation,
  isViewAvailable,
  isSidebarCollapsed,
  navigationReducer,
  type NavigationState,
  type NavigationAction,
  type AppView,
  type WorkspaceTab,
} from "@/domain/app-navigation"
import type { PresetDialogState, Draft } from "@/domain/polls"

const newTabItems = [
  {
    id: "home",
    label: "Студия",
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
    id: "donations",
    label: "Донаты",
    description: "",
    icon: HandCoins,
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
    (state: NavigationState, action: NavigationAction) =>
      navigationReducer(state, action, import.meta.env.PROD),
    undefined,
    initialNavigation
  )
  const activeTab = navigation.tabs.find(
    (tab) => tab.id === navigation.activeId
  )!
  const view = activeTab.history[activeTab.position]
  const navigate = (next: AppView) => dispatch({ type: "navigate", view: next })
  const openDiagnostics = () => {
    navigate("settings")
    window.setTimeout(revealErrorJournal, 0)
  }
  const [sidebarManuallyCollapsed, setSidebarManuallyCollapsed] = useState(
    () => localStorage.getItem("vela-sidebar-collapsed") === "true"
  )
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 1100px)").matches
  )
  const [compactPinned, setCompactPinned] = useState(false)
  const [sidebarPeek, setSidebarPeek] = useState(false)
  const sidebarCollapsed = isSidebarCollapsed(
    view,
    compact,
    sidebarManuallyCollapsed
  )
  const hoverSidebarOpen = sidebarCollapsed && (sidebarPeek || compactPinned)
  const toggleSidebar = () => {
    if (view === "settings") return
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
      <div
        className="app-shell"
        data-settings={view === "settings" || undefined}
      >
        <AppTitleBar
          sidebarCollapsed={sidebarCollapsed && !compactPinned}
          onToggleSidebar={view === "settings" ? undefined : toggleSidebar}
        />
        <AppLoadingSkeleton sidebarVisible={!sidebarCollapsed} />
        <ToastViewport onOpenDiagnostics={openDiagnostics} />
      </div>
    )

  return (
    <div className="app-shell" data-settings={view === "settings" || undefined}>
      <AppTitleBar
        sidebarCollapsed={sidebarCollapsed && !compactPinned}
        onToggleSidebar={view === "settings" ? undefined : toggleSidebar}
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
            settings={{
              section: activeTab.settingsSection || "general",
              onSelect: (section) =>
                dispatch({ type: "settings-section", section }),
              onExit: () =>
                navigate(
                  activeTab.history
                    .slice(0, activeTab.position)
                    .findLast(
                      (item): item is AppView =>
                        item !== "settings" && item !== "new"
                    ) || "home"
                ),
            }}
            connected={connected}
            poll={poll}
            contest={contestController.contest}
            onNavigate={navigate}
            account={
              <TwitchAccount
                state={twitch}
                active={view === "settings"}
                onClick={() => {
                  dispatch({ type: "settings-section", section: "general" })
                  navigate("settings")
                }}
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
                settings={{
                  section: activeTab.settingsSection || "general",
                  onSelect: (section) => {
                    dispatch({ type: "settings-section", section })
                    setSidebarPeek(false)
                    setCompactPinned(false)
                  },
                  onExit: () => {
                    navigate(
                      activeTab.history
                        .slice(0, activeTab.position)
                        .findLast(
                          (item): item is AppView =>
                            item !== "settings" && item !== "new"
                        ) || "home"
                    )
                    setSidebarPeek(false)
                    setCompactPinned(false)
                  },
                }}
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
                      dispatch({ type: "settings-section", section: "general" })
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
          <SectionTransition
            transitionKey={`${activeTab.id}:${view}`}
            className="h-full"
          >
            {navigation.tabs.map((tab) => (
              <div
                key={tab.id}
                className={tab.id === navigation.activeId ? "h-full" : "hidden"}
              >
                <TabWorkspace
                  tab={tab}
                  active={tab.id === navigation.activeId}
                  onSettingsSectionChange={(section) =>
                    dispatch({
                      type: "settings-section",
                      tabId: tab.id,
                      section,
                    })
                  }
                  controller={controller}
                  contestController={contestController}
                  onNavigate={(next) =>
                    dispatch({ type: "navigate", tabId: tab.id, view: next })
                  }
                />
              </div>
            ))}
          </SectionTransition>
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
      <ToastViewport onOpenDiagnostics={openDiagnostics} />
    </div>
  )
}

function TabWorkspace({
  tab,
  active,
  onSettingsSectionChange,
  controller,
  contestController,
  onNavigate: navigate,
}: {
  tab: WorkspaceTab
  active: boolean
  onSettingsSectionChange: (section: SettingsSection) => void
  controller: ReturnType<typeof usePollController>
  contestController: ReturnType<typeof useContestController>
  onNavigate: (view: AppView) => void
}) {
  const { state, draft, twitch, connected, busy, poll, canEdit, changeDraft } =
    controller
  const { enabled: demoEnabled } = useDemoMode()
  const [presetDialog, setPresetDialog] = useState<PresetDialogState | null>(
    null
  )
  const [loadedTemplateIds, setLoadedTemplateIds] = useState<
    Partial<Record<TemplateKind, string>>
  >({})
  const [templateGeneration, setTemplateGeneration] = useState({
    wheel: 0,
    contest: 0,
    widget: 0,
  })
  const [widgetKind, setWidgetKind] = useState<WidgetKind>("polls")
  const [wheelSpinning, setWheelSpinning] = useState(false)
  const showToast = useToast()
  const view = tab.history[tab.position]
  useEffect(() => {
    if (active && view === "home" && contestController.error)
      showToast({ message: contestController.error, tone: "error" })
  }, [active, view, contestController.error, showToast])

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
    setPresetDialog(null)
    return true
  }
  const templates = state?.templates || []
  const associatedTemplates = templates.filter(
    (template) => loadedTemplateIds[template.kind] === template.id
  )
  const loadedWheelTemplate = associatedTemplates.find(
    (template) => template.kind === "wheel"
  )
  const loadedContestTemplate = associatedTemplates.find(
    (template) => template.kind === "contest"
  )
  const saveTemplate: SaveTemplate = async (template, replaceId) => {
    const result = replaceId
      ? await controller.run("template-update", {
          templateId: replaceId,
          template,
        })
      : await controller.run("template-create", { template })
    if (!result) return false
    const id = replaceId || result.state.templates?.at(-1)?.id
    if (id)
      setLoadedTemplateIds((current) => ({ ...current, [template.kind]: id }))
    showToast({ message: replaceId ? "Шаблон обновлён" : "Шаблон сохранён" })
    return true
  }
  const blockedTemplate = (template: LibraryTemplate) => {
    if (template.kind === "poll" && poll?.status === "running")
      return "Опрос идёт"
    if (
      template.kind === "contest" &&
      contestController.contest &&
      contestController.contest.status !== "finished"
    )
      return "Конкурс идёт"
    if (template.kind === "wheel" && wheelSpinning) return "Рулетка крутится"
    return null
  }
  const applyTemplate = async (template: LibraryTemplate, edit = false) => {
    if (template.kind === "poll" && edit) {
      setPresetDialog({ mode: "edit", preset: template })
      return
    }
    const reason = blockedTemplate(template)
    if (reason) {
      showToast({ message: reason, tone: "warning" })
      return
    }
    if (template.kind === "poll") {
      if (await controller.applyPreset(template)) {
        if (!demoEnabled)
          changeDraft((current) =>
            current.source === "test"
              ? { ...current, source: "twitch" }
              : current
          )
        navigate("polls")
      }
      return
    }
    if (template.kind.endsWith("-widget")) {
      if (
        !(await controller.run("template-apply", { templateId: template.id }))
      )
        return
      setWidgetKind(
        template.kind === "poll-widget"
          ? "polls"
          : template.kind === "chat-widget"
            ? "chat"
            : "contests"
      )
    }
    setLoadedTemplateIds((current) => ({
      ...current,
      [template.kind]: template.id,
    }))
    setTemplateGeneration((value) => ({
      ...value,
      [template.kind === "contest"
        ? "contest"
        : template.kind === "wheel"
          ? "wheel"
          : "widget"]:
        value[
          template.kind === "contest"
            ? "contest"
            : template.kind === "wheel"
              ? "wheel"
              : "widget"
        ] + 1,
    }))
    navigate(
      template.kind === "contest"
        ? "contests"
        : template.kind === "wheel"
          ? "decision-wheel"
          : "widget"
    )
  }
  const createTemplate = (kind: LibraryKind) => {
    if (kind === "poll") {
      setPresetDialog({ mode: "create", editorId: crypto.randomUUID() })
      return
    }
    if (
      kind === "contest" &&
      contestController.contest &&
      contestController.contest.status !== "finished"
    ) {
      showToast({
        message:
          "Можно сохранить текущий конкурс в шаблон из раздела «Конкурсы».",
        tone: "warning",
      })
    }
    setLoadedTemplateIds((current) => ({ ...current, [kind]: undefined }))
    if (kind.endsWith("-widget")) {
      setWidgetKind(
        kind === "poll-widget"
          ? "polls"
          : kind === "chat-widget"
            ? "chat"
            : "contests"
      )
      setTemplateGeneration((value) => ({ ...value, widget: value.widget + 1 }))
    }
    navigate(
      kind === "contest"
        ? "contests"
        : kind === "wheel"
          ? "decision-wheel"
          : "widget"
    )
    showToast({
      message: `Настройте ${kind.endsWith("-widget") ? "виджет" : kind === "contest" ? "конкурс" : "рулетку"} и нажмите «Сохранить шаблон».`,
    })
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
            activityControls={{
              pollDisabled: !connected || busy,
              contestDisabled:
                !contestController.connected || contestController.busy,
              finishPoll: () => {
                if (poll) void controller.run("finish", { pollId: poll.id })
              },
              closeContest: () => {
                void contestController.close()
              },
              drawContest: () => {
                void contestController.draw()
              },
            }}
            onNavigate={navigate}
          />
        </div>
      )}
      {tab.visited.includes("decision-wheel") && (
        <div className={view === "decision-wheel" ? "h-full" : "hidden"}>
          <DecisionWheelPage
            key={`wheel-${templateGeneration.wheel}`}
            template={loadedWheelTemplate}
            onSpinningChange={setWheelSpinning}
            onSaveTemplate={
              isViewAvailable("presets", import.meta.env.PROD) && connected
                ? saveTemplate
                : undefined
            }
          />
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
                    disabled={!isViewAvailable(item.id, import.meta.env.PROD)}
                    data-wide={item.wide || undefined}
                    data-accent={item.accent || undefined}
                    onClick={() => navigate(item.id)}
                  >
                    <span className="new-tab-tile-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="new-tab-tile-copy">
                      <span className="new-tab-tile-title">
                        {item.label}
                        {!isViewAvailable(item.id, import.meta.env.PROD) && (
                          <span className="section-soon">Скоро</span>
                        )}
                      </span>
                      {item.description && (
                        <span className="new-tab-tile-description">
                          {item.description}
                        </span>
                      )}
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
            canCreatePreset={
              isViewAvailable("presets", import.meta.env.PROD) &&
              state.presets.length < 30
            }
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

      {isViewAvailable("presets", import.meta.env.PROD) && (
        <div
          className={view === "presets" ? "h-full" : "hidden"}
          aria-hidden={view === "presets" ? undefined : true}
        >
          <TemplateLibrary
            templates={[
              ...state.presets.map((preset) => ({
                ...preset,
                kind: "poll" as const,
                data: preset.draft,
              })),
              ...templates,
            ]}
            dialog={presetDialog}
            connected={connected}
            busy={busy}
            onCreate={createTemplate}
            onUse={(template) => void applyTemplate(template)}
            onEdit={(template) => void applyTemplate(template, true)}
            blocked={blockedTemplate}
            onPin={(template) =>
              void controller.run(
                template.kind === "poll"
                  ? "preset-toggle-pin"
                  : "template-update",
                template.kind === "poll"
                  ? { presetId: template.id, pinned: !template.pinned }
                  : {
                      templateId: template.id,
                      template: { pinned: !template.pinned },
                    }
              )
            }
            onReorder={(template, target) =>
              void controller.run(
                template.kind === "poll"
                  ? "preset-reorder"
                  : "template-reorder",
                template.kind === "poll"
                  ? {
                      presetId: template.id,
                      targetId: target.id,
                      position: "before",
                    }
                  : { templateId: template.id, targetId: target.id }
              )
            }
            onDelete={async (template) =>
              !!(await controller.run(
                template.kind === "poll" ? "preset-delete" : "template-delete",
                template.kind === "poll"
                  ? { presetId: template.id }
                  : { templateId: template.id }
              ))
            }
            onSavePoll={savePreset}
            onCloseEditor={() => setPresetDialog(null)}
          />
        </div>
      )}

      {tab.visited.includes("settings") && (
        <div className={view === "settings" ? "h-full" : "hidden"}>
          <SettingsPage
            section={tab.settingsSection || "general"}
            active={active && view === "settings"}
            onSectionChange={onSettingsSectionChange}
            draft={draft}
            presets={state.presets}
            templates={templates}
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
            key={`contest-${templateGeneration.contest}`}
            template={loadedContestTemplate}
            onSaveTemplate={
              isViewAvailable("presets", import.meta.env.PROD) && connected
                ? saveTemplate
                : undefined
            }
            twitchConnected={twitch.phase === "connected"}
            controller={contestController}
          />
        </div>
      )}

      {tab.visited.includes("widget") && (
        <div className={view === "widget" ? "h-full" : "hidden"}>
          <WidgetPage
            key={`widget-${templateGeneration.widget}`}
            initialKind={widgetKind}
            templates={associatedTemplates}
            onSaveTemplate={
              isViewAvailable("presets", import.meta.env.PROD) && connected
                ? saveTemplate
                : undefined
            }
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
