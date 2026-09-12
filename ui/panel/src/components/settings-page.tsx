import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Check, Download, FileUp } from "lucide-react"

import { type AppTheme, useTheme } from "@/components/theme-provider"
import { TwitchSettings } from "@/components/twitch-settings"
import { UpdateSettings } from "@/components/update-control"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/toast"
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
  const [preferences, setPreferences] = useState<DesktopPreferences>()
  const [preferenceBusy, setPreferenceBusy] = useState<
    "openAtLogin" | "runInBackground"
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
    key: "openAtLogin" | "runInBackground",
    value: boolean
  ) => {
    if (!bridge) return
    setPreferenceBusy(key)
    try {
      const next = await bridge.setPreferences({ [key]: value })
      setPreferences(next)
      showToast({
        message:
          key === "openAtLogin"
            ? value
              ? "Автозапуск включён"
              : "Автозапуск выключен"
            : value
              ? "Работа в трее включена"
              : "Работа в трее выключена",
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
      app: "projectCHAT",
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
    link.download = `projectCHAT-${new Date().toISOString().slice(0, 10)}.json`
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
      className="h-full min-h-0 overflow-y-auto p-6 lg:p-8"
      aria-label="Настройки"
    >
      <div className="mx-auto max-w-2xl space-y-9 pb-8">
        <SettingsPanel title="Twitch">
          <TwitchSettings
            state={twitch}
            busy={busy}
            onCommand={onTwitchCommand}
          />
        </SettingsPanel>

        <SettingsPanel title="Тема">
          <ThemeSettings />
        </SettingsPanel>

        <SettingsPanel title="Приложение">
          <div className="space-y-1 rounded-xl bg-surface-subtle p-1">
            <PreferenceRow
              label="Запускать с системой"
              unavailable={preferences && !preferences.openAtLoginSupported}
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
              label="Продолжать работу в трее"
              unavailable={preferences && !preferences.runInBackgroundSupported}
              checked={preferences?.runInBackground ?? false}
              disabled={
                !preferences?.runInBackgroundSupported ||
                preferenceBusy !== undefined
              }
              onCheckedChange={(checked) =>
                void updatePreference("runInBackground", checked)
              }
            />
          </div>
          {!bridge && (
            <p className="mt-3 text-xs text-muted-foreground">
              Доступно в установленном приложении.
            </p>
          )}
        </SettingsPanel>

        <SettingsPanel title="Данные">
          <div className="grid gap-2 sm:grid-cols-2">
            <DataAction
              title="Экспорт"
              detail={`${presets.length} шаблонов`}
              action={
                <Button variant="outline" onClick={exportSettings}>
                  <Download /> Скачать
                </Button>
              }
            />
            <DataAction
              title="Импорт"
              detail={canImport ? "Файл JSON" : "Завершите опрос"}
              action={
                <Button
                  variant="outline"
                  disabled={!canImport || busy}
                  onClick={() => inputRef.current?.click()}
                >
                  <FileUp /> Выбрать
                </Button>
              }
            />
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void importSettings(event)}
            />
          </div>
        </SettingsPanel>

        <SettingsPanel title="Обновления">
          <UpdateSettings />
        </SettingsPanel>
      </div>
    </section>
  )
}

const themes: Array<{
  id: AppTheme
  label: string
  background: string
  surface: string
  accent: string
}> = [
  {
    id: "lime",
    label: "Лайм",
    background: "#0d1014",
    surface: "#1a1e24",
    accent: "#d3fb75",
  },
  {
    id: "violet",
    label: "Пичи",
    background: "#0f0d14",
    surface: "#201b28",
    accent: "#b89aff",
  },
  {
    id: "ice",
    label: "Лёд",
    background: "#0a1116",
    surface: "#17242b",
    accent: "#7ddcff",
  },
]

function ThemeSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="grid grid-cols-3 gap-2">
      {themes.map((option) => {
        const selected = theme === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            className={`rounded-xl p-2 text-left ring-1 transition-colors ring-inset focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${selected ? "bg-surface-raised ring-brand/35" : "bg-surface-subtle ring-border-subtle hover:bg-surface-raised"}`}
            onClick={() => setTheme(option.id)}
          >
            <span
              className="flex h-12 items-end rounded-lg p-2"
              style={{ background: option.background }}
            >
              <span
                className="h-3 flex-1 rounded-full"
                style={{ background: option.surface }}
              />
              <span
                className="ml-1.5 size-3 rounded-full"
                style={{ background: option.accent }}
              />
            </span>
            <span className="mt-2 flex items-center justify-between gap-2 px-1 pb-0.5 text-sm font-medium">
              {option.label}
              {selected && <Check className="size-3.5 text-brand" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function SettingsPanel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold tracking-[-0.025em]">
        {title}
      </h2>
      {children}
    </div>
  )
}

function PreferenceRow({
  label,
  unavailable,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  unavailable?: boolean
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-13 items-center justify-between gap-5 rounded-lg px-3.5 py-2.5 hover:bg-surface-raised">
      <span className="min-w-0 text-sm font-medium">
        {label}
        {unavailable && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Недоступно
          </span>
        )}
      </span>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onCheckedChange}
      />
    </label>
  )
}

function DataAction({
  title,
  detail,
  action,
}: {
  title: string
  detail: string
  action: React.ReactNode
}) {
  return (
    <div className="flex min-h-17 items-center gap-5 rounded-xl bg-surface-subtle px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {detail}
        </div>
      </div>
      {action}
    </div>
  )
}
