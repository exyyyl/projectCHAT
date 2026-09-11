import { useEffect, useState } from "react"

import { AppSidebar, type AppView } from "@/components/app-sidebar"
import { PollWorkspace } from "@/components/poll-workspace"
import { PresetDialogs } from "@/components/preset-dialogs"
import { PresetLibrary } from "@/components/preset-library"
import { SettingsPage } from "@/components/settings-page"
import { StreamDockPage } from "@/components/stream-dock-page"
import { TwitchAccount } from "@/components/twitch-account"
import { WidgetPage } from "@/components/widget-page"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ToastProvider, useToast } from "@/components/ui/toast"
import { usePollController } from "@/hooks/use-poll-controller"

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
  const showToast = useToast()
  const [view, setView] = useState<AppView>("polls")
  const {
    state,
    draft,
    twitch,
    connected,
    busy,
    error,
    selectedPreset,
    presetDialog,
    deletePreset,
    poll,
    canEdit,
    canApplyPreset,
    twitchWarning,
  } = controller

  useEffect(() => {
    if (error) showToast({ message: error, tone: "error" })
  }, [error, showToast])

  useEffect(() => {
    if (twitchWarning)
      showToast({ message: twitchWarning, tone: "warning", duration: 6500 })
  }, [showToast, twitchWarning])

  if (!state || !draft)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Подключение…
      </div>
    )

  return (
    <div className="flex h-screen overflow-hidden bg-panel text-foreground">
      <AppSidebar
        view={view}
        connected={connected}
        onNavigate={setView}
        account={
          <TwitchAccount
            state={twitch}
            active={view === "settings"}
            onClick={() => setView("settings")}
          />
        }
      />

      <main className="min-w-0 flex-1 overflow-y-auto bg-panel">
        {view === "polls" && (
          <PollWorkspace
            poll={poll}
            draft={draft}
            connected={connected}
            busy={busy}
            twitchPhase={twitch.phase}
            widget={state.widget}
            onChangeDraft={controller.changeDraft}
            onStart={() => void controller.start()}
            onClear={() => void controller.clear()}
            onSetOutput={(visible) => void controller.setOutput(visible)}
            onRun={controller.run}
            onVote={(option) => void controller.vote(option)}
            onSimulate={controller.simulate}
          />
        )}

        {view === "presets" && (
          <PresetLibrary
            presets={state.presets}
            selectedId={selectedPreset}
            dialog={presetDialog}
            canApply={canApplyPreset}
            applyBlocked={poll?.status === "running"}
            canManage={connected}
            canCreate={state.presets.length < 30}
            busy={busy}
            onCreate={() => controller.setPresetDialog({ mode: "create" })}
            onApply={(preset) => {
              void controller.applyPreset(preset).then((applied) => {
                if (applied) setView("polls")
              })
            }}
            onEdit={(preset) =>
              controller.setPresetDialog({ mode: "edit", preset })
            }
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
            onSave={controller.savePreset}
            onCloseEditor={() => controller.setPresetDialog(null)}
          />
        )}

        {view === "settings" && (
          <SettingsPage
            draft={draft}
            presets={state.presets}
            widget={state.widget}
            canImport={canEdit}
            busy={busy}
            twitch={twitch}
            onImport={controller.importSettings}
            onTwitchCommand={(type) => void controller.twitchCommand(type)}
          />
        )}

        {view === "widget" && (
          <WidgetPage
            poll={poll}
            draft={draft}
            widget={state.widget}
            busy={busy}
            onUpdate={(widget) =>
              void controller.run("widget-update", { widget })
            }
            onSetOutput={(visible) => void controller.setOutput(visible)}
          />
        )}

        {view === "stream-dock" && <StreamDockPage />}
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
  )
}

export default App
