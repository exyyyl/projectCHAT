import type { ContestOverlaySettings } from "../../../../public/contest-overlay-model.js"
import type { ChatOverlaySettings } from "../../../../public/chat-overlay-model.js"
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Check, Download, FileUp } from "lucide-react"

import { type AppTheme, useTheme } from "@/components/theme-provider"
import { TwitchSettings } from "@/components/twitch-settings"
import { UpdateSettings } from "@/components/update-control"
import { StreamDockPage } from "@/components/stream-dock-page"
import { DiagnosticsSettings } from "@/components/diagnostics-settings"
import { Button } from "@/components/ui/button"
import { FormSwitch } from "@/components/form-controls"
import { useToast } from "@/components/ui/toast"
import { useDemoMode } from "@/hooks/use-demo-mode"
import type { Draft, Preset, TwitchState, WidgetSettings } from "@/domain/polls"

type SettingsPageProps = {
  draft: Draft
  presets: Preset[]
  widget: WidgetSettings
  contestOverlay: ContestOverlaySettings
  chatOverlay: ChatOverlaySettings
  canImport: boolean
  busy: boolean
  twitch: TwitchState
  onImport: (settings: unknown) => Promise<boolean>
  onTwitchCommand: (type: "connect" | "disconnect") => void
}

export function SettingsPage({
  draft,
  presets,
  widget,
  contestOverlay,
  chatOverlay,
  canImport,
  busy,
  twitch,
  onImport,
  onTwitchCommand,
}: SettingsPageProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const showToast = useToast()
  const bridge = window.streamPollsDesktop
  const { enabled: demoEnabled, setEnabled: setDemoEnabled } = useDemoMode()
  const [preferences, setPreferences] = useState<DesktopPreferences>()
  const [preferenceBusy, setPreferenceBusy] = useState<
    "openAtLogin" | "runInBackground" | "updateChannel"
  >()

  useEffect(() => {
    if (!bridge) return
    let active = true
    void bridge
      .getPreferences()
      .then((value) => active && setPreferences(value))
      .catch((failure) => {
        if (active)
          showToast({
            message:
              failure instanceof Error
                ? failure.message
                : "Не удалось загрузить настройки приложения.",
            tone: "error",
          })
      })
    return () => {
      active = false
    }
  }, [bridge, showToast])

  const updatePreference = async (
    key: "openAtLogin" | "runInBackground" | "updateChannel",
    value: boolean | DesktopPreferences["updateChannel"]
  ) => {
    if (!bridge) return
    setPreferenceBusy(key)
    try {
      const patch =
        key === "updateChannel"
          ? { updateChannel: value as DesktopPreferences["updateChannel"] }
          : { [key]: value as boolean }
      const next = await bridge.setPreferences(patch)
      setPreferences(next)
      showToast({
        message:
          key === "openAtLogin"
            ? value
              ? "Автозапуск включён"
              : "Автозапуск выключен"
            : key === "runInBackground"
              ? value
                ? "Работа в трее включена"
                : "Работа в трее выключена"
              : value === "beta"
                ? "Бета-обновления включены"
                : "Выбран стабильный канал",
        tone: "success",
      })
    } catch (failure) {
      showToast({
        message:
          failure instanceof Error
            ? failure.message
            : "Не удалось изменить настройку.",
        tone: "error",
      })
    } finally {
      setPreferenceBusy(undefined)
    }
  }

  const exportSettings = () => {
    const settings = {
      schema: 1,
      app: "Cue",
      exportedAt: new Date().toISOString(),
      draft,
      presets: presets.map((preset) => ({
        name: preset.name,
        draft: preset.draft,
        pinned: preset.pinned,
      })),
      widget,
      contestOverlay,
      chatOverlay,
    }
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Cue-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    showToast({ message: "Файл настроек экспортирован", tone: "success" })
  }

  const importSettings = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      if (file.size > 60_000) throw new Error("Файл слишком большой")
      const settings = JSON.parse(await file.text()) as unknown
      if (await onImport(settings))
        showToast({ message: "Настройки импортированы", tone: "success" })
    } catch (failure) {
      showToast({
        message:
          failure instanceof Error
            ? failure.message
            : "Не удалось прочитать файл",
        tone: "error",
      })
    }
  }

  return (
    <section
      aria-label="Настройки"
      className="h-full min-h-0 overflow-y-auto overscroll-contain"
    >
      <div className="mx-auto w-full max-w-4xl px-6 py-7 lg:px-8">
        <h1 className="mb-6 text-lg font-semibold tracking-tight">Настройки</h1>
        <div className="rounded-xl bg-surface-subtle px-5 py-4">
          <TwitchSettings
            state={twitch}
            busy={busy}
            onCommand={onTwitchCommand}
          />
        </div>
        <div className="mt-4 grid min-w-0 items-start gap-4 lg:grid-cols-2">
          <SettingsBlock title="Оформление" wide>
            <ThemeSettings />
          </SettingsBlock>
          <div className="min-w-0 space-y-4">
            <SettingsBlock title="Приложение">
              <div className="space-y-1">
                <PreferenceRow
                  label="Автозапуск"
                  hint={
                    preferenceHint(
                      bridge,
                      preferences,
                      preferences?.openAtLoginSupported
                    ) ??
                    (preferences?.openAtLogin
                      ? "Запускается в трее"
                      : undefined)
                  }
                  checked={preferences?.openAtLogin ?? false}
                  disabled={
                    !preferences?.openAtLoginSupported ||
                    preferenceBusy !== undefined
                  }
                  onCheckedChange={(checked) =>
                    void updatePreference("openAtLogin", checked)
                  }
                />
                <PreferenceRow
                  label="Работа в трее"
                  hint={preferenceHint(
                    bridge,
                    preferences,
                    preferences?.runInBackgroundSupported
                  )}
                  checked={preferences?.runInBackground ?? false}
                  disabled={
                    !preferences?.runInBackgroundSupported ||
                    preferenceBusy !== undefined
                  }
                  onCheckedChange={(checked) =>
                    void updatePreference("runInBackground", checked)
                  }
                />
                <PreferenceRow
                  label="Демо-режим"
                  checked={demoEnabled}
                  disabled={false}
                  onCheckedChange={setDemoEnabled}
                />
              </div>
            </SettingsBlock>
            <SettingsBlock title="Данные">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={exportSettings}>
                  <Download />
                  Экспортировать
                </Button>
                <Button
                  variant="outline"
                  disabled={!canImport || busy}
                  onClick={() => inputRef.current?.click()}
                >
                  <FileUp />
                  Импортировать
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => void importSettings(event)}
                />
              </div>
              {!canImport && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Завершите опрос для импорта.
                </p>
              )}
            </SettingsBlock>
          </div>
          <div className="min-w-0 space-y-4">
            <SettingsBlock title="Обновления">
              <UpdateSettings />
            </SettingsBlock>
            <SettingsBlock title="О Cue" action={<TelegramLink />}>
              <ProjectInfo />
            </SettingsBlock>
          </div>
          <div className="min-w-0 lg:col-span-2">
            <DiagnosticsSettings />
          </div>
          <div className="min-w-0 lg:col-span-2">
            <StreamDockPage />
          </div>
        </div>
      </div>
    </section>
  )
}

const themes: Array<{
  id: AppTheme
  label: string
  background: string
  accent: string
}> = [
  {
    id: "lime",
    label: "Лайм",
    background: "#0d1014",
    accent: "#d3fb75",
  },
  {
    id: "violet",
    label: "Пичи",
    background: "#0f0d14",
    accent: "#b89aff",
  },
  {
    id: "ice",
    label: "Лёд",
    background: "#0a1116",
    accent: "#7ddcff",
  },
  {
    id: "mono",
    label: "Тёмная",
    background: "#050505",
    accent: "#f4f4f5",
  },
]

function ThemeSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="grid grid-cols-2 gap-3 @min-[28rem]:grid-cols-4">
      {themes.map((option) => {
        const selected = theme === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            className="group min-w-0 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background focus-visible:outline-none"
            onClick={() => setTheme(option.id)}
          >
            <span
              aria-hidden="true"
              className={`flex aspect-[2.1] gap-1.5 overflow-hidden rounded-lg p-2 ring-1 transition-[box-shadow] ring-inset ${selected ? "ring-foreground/50" : "ring-border-subtle group-hover:ring-border-strong"}`}
              style={{ background: option.background }}
            >
              <span className="flex w-1/4 flex-col gap-1.5 pt-1">
                <span className="mb-1 size-2 rounded bg-white/20" />
                <span
                  className="h-1.5 w-full rounded-sm"
                  style={{ background: option.accent }}
                />
                <span className="h-1 w-4/5 rounded-sm bg-white/15" />
                <span className="h-1 w-3/5 rounded-sm bg-white/15" />
              </span>
              <span className="flex flex-1 flex-col gap-1.5 rounded bg-white/5 p-2">
                <span className="h-1.5 w-3/5 rounded-sm bg-white/35" />
                <span className="mt-2 h-1 w-full rounded-sm bg-white/10" />
                <span className="h-1 w-4/5 rounded-sm bg-white/10" />
                <span
                  className="mt-auto h-3 w-1/3 rounded-sm"
                  style={{ background: option.accent }}
                />
              </span>
            </span>
            <span className="mt-2 flex items-center justify-between gap-2 text-xs">
              <span>{option.label}</span>
              {selected && <Check className="size-3.5 text-foreground" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function SettingsBlock({
  title,
  wide,
  full,
  action,
  children,
}: {
  title: string
  wide?: boolean
  full?: boolean
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      aria-label={title}
      className={`min-w-0 rounded-xl bg-surface-subtle p-4 ${wide ? "grid gap-4 lg:col-span-2 lg:grid-cols-[9rem_minmax(0,1fr)] lg:gap-6" : "space-y-3"} ${full ? "lg:col-span-2" : ""}`}
    >
      <div className="flex min-h-5 items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-[-0.015em]">{title}</h2>
        {action}
      </div>
      <div className="@container min-w-0">{children}</div>
    </section>
  )
}

function PreferenceRow({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  hint?: ReactNode
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <FormSwitch
      label={label}
      hint={hint}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    />
  )
}

function preferenceHint(
  bridge: typeof window.streamPollsDesktop,
  preferences: DesktopPreferences | undefined,
  supported: boolean | undefined
) {
  if (!bridge) return "Только в приложении"
  if (!preferences) return <Skeleton className="my-1 h-2.5 w-28" />
  return supported ? undefined : "Недоступно на этом устройстве"
}

function ProjectInfo() {
  return (
    <dl className="grid grid-cols-2 gap-4 text-xs">
      <div className="space-y-1">
        <dt className="font-medium">exyyyl</dt>
        <dd className="text-muted-foreground">Разработка</dd>
      </div>
      <div className="space-y-1">
        <dt className="font-medium">peachysoul</dt>
        <dd className="text-muted-foreground">Креативная поддержка</dd>
      </div>
    </dl>
  )
}

function TelegramLink() {
  return (
    <a
      href="https://t.me/itsprojectCHAT"
      target="_blank"
      rel="noreferrer"
      aria-label="@itsprojectCHAT — новости и поддержка в Telegram"
      className="-my-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <TelegramIcon className="size-4" />
    </a>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M21.6 3.2a1.6 1.6 0 0 0-1.7-.23L3.25 9.5c-1.12.44-1.1 2.03.04 2.43l4.23 1.47 1.63 5.02c.34 1.05 1.68 1.34 2.42.53l2.32-2.55 4.13 3.03c.93.68 2.25.17 2.42-.97l2.08-13.27a1.6 1.6 0 0 0-.92-1.99ZM9.3 12.84l8.46-5.27-6.83 6.63-.53 2.82-1.1-4.18Z" />
    </svg>
  )
}
