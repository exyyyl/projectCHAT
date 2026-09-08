import { useState } from "react"

import { AppSidebar, type AppView } from "@/components/app-sidebar"
import { PollWorkspace } from "@/components/poll-workspace"
import { PresetDialogs } from "@/components/preset-dialogs"
import { PresetLibrary } from "@/components/preset-library"
import { SettingsPage } from "@/components/settings-page"
import { TwitchAccount } from "@/components/twitch-account"
import { WidgetPage } from "@/components/widget-page"
import { TooltipProvider } from "@/components/ui/tooltip"
import { validateDraft } from "@/domain/polls"
import { usePollController } from "@/hooks/use-poll-controller"

export function App() {
  const controller = usePollController()
  const [view, setView] = useState<AppView>("polls")
  const {
    state,
    draft,
    twitch,
    connected,
    busy,
    error,
    privatePreview,
    selectedPreset,
    presetDialog,
    presetName,
    deletePreset,
    twitchClient,
    poll,
    canEdit,
    twitchWarning,
  } = controller

  if (!state || !draft)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Подключение…
      </div>
    )

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-panel text-foreground">
        <AppSidebar
          view={view}
          connected={connected}
          onNavigate={setView}
          account={
            <TwitchAccount
              placement="sidebar"
              state={twitch}
              onCommand={(type) => void controller.twitchCommand(type)}
              onOpenSettings={() => setView("settings")}
            />
          }
        />

        <main className="min-w-0 flex-1 overflow-y-auto bg-panel">
          {error && (
            <div
              role="alert"
              className="border-b border-destructive/15 bg-destructive/8 px-6 py-3 text-sm text-red-200 lg:px-8"
            >
              {error}
            </div>
          )}
          {twitchWarning && (
            <div
              role="status"
              className="border-b border-amber-300/10 bg-amber-400/8 px-6 py-3 text-sm text-amber-100 lg:px-8"
            >
              {twitchWarning}
            </div>
          )}

          {view === "polls" && (
            <PollWorkspace
              poll={poll}
              draft={draft}
              connected={connected}
              busy={busy}
              twitchPhase={twitch.phase}
              privatePreview={privatePreview}
              widget={state.widget}
              onChangeDraft={controller.changeDraft}
              onStart={() => void controller.start()}
              onClear={() => void controller.clear()}
              onSetOutput={(visible) => void controller.setOutput(visible)}
              onTogglePreview={() =>
                controller.setPrivatePreview((value) => !value)
              }
              onRun={controller.run}
              onVote={(option) => void controller.vote(option)}
              onSimulate={controller.simulate}
            />
          )}

          {view === "presets" && (
            <PresetLibrary
              presets={state.presets}
              selectedId={selectedPreset}
              canEdit={canEdit}
              canCreate={!validateDraft(draft)}
              busy={busy}
              onCreate={() => {
                controller.setPresetName(draft.question)
                controller.setPresetDialog({ mode: "create" })
              }}
              onApply={(preset) => {
                void controller.applyPreset(preset).then((applied) => {
                  if (applied) setView("polls")
                })
              }}
              onUpdate={(preset) =>
                void controller.run("preset-update", {
                  presetId: preset.id,
                  draft,
                })
              }
              onRename={(preset) => {
                controller.setPresetName(preset.name)
                controller.setPresetDialog({ mode: "rename", preset })
              }}
              onMove={(preset, direction) =>
                void controller.run("preset-move", {
                  presetId: preset.id,
                  direction,
                })
              }
              onDelete={controller.setDeletePreset}
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
              twitchClient={twitchClient}
              onImport={controller.importSettings}
              onTwitchClientChange={controller.setTwitchClient}
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
        </main>

        <PresetDialogs
          dialog={presetDialog}
          name={presetName}
          draft={draft}
          pendingDelete={deletePreset}
          onNameChange={controller.setPresetName}
          onSave={() => void controller.savePreset()}
          onClose={() => controller.setPresetDialog(null)}
          onDeleteChange={controller.setDeletePreset}
          onConfirmDelete={(preset) => {
            void controller.run("preset-delete", { presetId: preset.id })
            controller.setDeletePreset(null)
          }}
        />
      </div>
    </TooltipProvider>
  )
}

export default App
