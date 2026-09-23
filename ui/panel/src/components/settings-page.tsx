import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Check, Download, FileUp } from "lucide-react"

import appIcon from "@/assets/app-icon.png"
import { type AppTheme, useTheme } from "@/components/theme-provider"
import { PageContainer, PageScroll } from "@/components/page-layout"
import { TwitchSettings } from "@/components/twitch-settings"
import { UpdateSettings } from "@/components/update-control"
import { FormSwitch } from "@/components/form-controls"
import { useToast } from "@/components/ui/toast"
import { useDemoMode } from "@/hooks/use-demo-mode"
import type { Draft, Preset, TwitchState, WidgetSettings } from "@/domain/polls"

type SettingsPageProps = {
  draft: Draft
  presets: Preset[]
  widget: WidgetSettings
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
    <PageScroll aria-label="Настройки">
      <PageContainer className="max-w-3xl">
        <TwitchSettings
          state={twitch}
          busy={busy}
          onCommand={onTwitchCommand}
        />

        <div className="mt-8 space-y-8">
          <SettingsGroup title="Оформление">
            <ThemeSettings />
          </SettingsGroup>

          <SettingsGroup title="Приложение">
            <SettingsList>
              <PreferenceTile
                label="Автозапуск"
                hint={
                  preferenceHint(
                    bridge,
                    preferences,
                    preferences?.openAtLoginSupported
                  ) ??
                  (preferences?.openAtLogin ? "Запускается в трее" : undefined)
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
              <PreferenceTile
                label="Демо-режим"
                checked={demoEnabled}
                disabled={false}
                onCheckedChange={setDemoEnabled}
              />
              <PreferenceTile
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
            </SettingsList>
          </SettingsGroup>

          <SettingsGroup title="Данные">
            <SettingsList>
              <DataAction
                title="Экспортировать"
                detail={formatPresetCount(presets.length)}
                icon={<Download />}
                onClick={exportSettings}
              />
              <DataAction
                title="Импортировать"
                detail={canImport ? "Из файла JSON" : "Завершите опрос"}
                icon={<FileUp />}
                disabled={!canImport || busy}
                onClick={() => inputRef.current?.click()}
              />
              <input
                ref={inputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void importSettings(event)}
              />
            </SettingsList>
          </SettingsGroup>

          <SettingsGroup title="Обновления">
            <SettingsList>
              <PreferenceTile
                label="Бета-обновления"
                hint={
                  bridge && preferences
                    ? "Предрелизные сборки"
                    : "Только в приложении"
                }
                checked={preferences?.updateChannel === "beta"}
                disabled={
                  !bridge || !preferences || preferenceBusy !== undefined
                }
                onCheckedChange={(checked) =>
                  void updatePreference(
                    "updateChannel",
                    checked ? "beta" : "stable"
                  )
                }
              />
              <UpdateSettings />
            </SettingsList>
          </SettingsGroup>

          <ProjectInfo />
        </div>
      </PageContainer>
    </PageScroll>
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
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-border-subtle bg-surface-subtle p-1 sm:grid-cols-4">
      {themes.map((option) => {
        const selected = theme === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            className={`flex h-11 items-center gap-2.5 rounded-lg px-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${selected ? "bg-surface-raised text-foreground" : "text-muted-foreground hover:bg-surface-raised/60 hover:text-foreground"}`}
            onClick={() => setTheme(option.id)}
          >
            <span
              className="relative size-5 shrink-0 rounded-full ring-1 ring-white/10 ring-inset"
              style={{ background: option.background }}
            >
              <span
                className="absolute inset-1 rounded-full"
                style={{ background: option.accent }}
              />
            </span>
            <span className="truncate text-sm font-medium">{option.label}</span>
            {selected && <Check className="ml-auto size-3.5 text-brand" />}
          </button>
        )
      })}
    </div>
  )
}

function SettingsGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-sm font-medium text-foreground/90">{title}</h2>
      {children}
    </section>
  )
}

function SettingsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-subtle p-1">
      <div className="grid gap-1">{children}</div>
    </div>
  )
}

function PreferenceTile({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="rounded-lg px-3 transition-colors hover:bg-surface-raised/55">
      <FormSwitch
        label={label}
        hint={hint}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}

function preferenceHint(
  bridge: typeof window.streamPollsDesktop,
  preferences: DesktopPreferences | undefined,
  supported: boolean | undefined
) {
  if (!bridge) return "Только в приложении"
  if (!preferences) return "Загрузка…"
  return supported ? undefined : "Недоступно на этом устройстве"
}

function DataAction({
  title,
  detail,
  icon,
  disabled,
  onClick,
}: {
  title: string
  detail: string
  icon: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex min-h-14 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-raised/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-muted-foreground transition-colors group-hover:text-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {detail}
        </div>
      </div>
    </button>
  )
}

function ProjectInfo() {
  return (
    <footer className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl bg-surface-subtle px-4 py-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <img src={appIcon} alt="" className="size-9 shrink-0 object-contain" />
        <span className="text-sm font-semibold">Cue</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span>
          <strong className="font-medium text-foreground">exyyyl</strong> ·
          разработка
        </span>
        <span>
          <strong className="font-medium text-foreground">peachysoul</strong> ·
          креативная поддержка
        </span>
      </div>
      <a
        href="https://t.me/itsprojectCHAT"
        target="_blank"
        rel="noreferrer"
        className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <TelegramIcon className="size-4 text-telegram" />
        <span>@itsprojectCHAT</span>
      </a>
    </footer>
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

function formatPresetCount(count: number) {
  const lastTwo = count % 100
  const last = count % 10
  const suffix =
    lastTwo >= 11 && lastTwo <= 14
      ? "шаблонов"
      : last === 1
        ? "шаблон"
        : last >= 2 && last <= 4
          ? "шаблона"
          : "шаблонов"
  return `${count} ${suffix}`
}
