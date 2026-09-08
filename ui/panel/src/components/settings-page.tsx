import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Download, FileUp } from "lucide-react"

import { UpdateSettings } from "@/components/update-control"
import { TwitchSettings } from "@/components/twitch-settings"
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
  twitchClient: string
  onImport: (settings: unknown) => Promise<boolean>
  onTwitchClientChange: (value: string) => void
  onTwitchCommand: (type: "connect" | "disconnect") => void
}

export function SettingsPage({
  draft,
  presets,
  widget,
  canImport,
  busy,
  twitch,
  twitchClient,
  onImport,
  onTwitchClientChange,
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
              ? "Приложение продолжит работу в трее"
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
    <section className="mx-auto max-w-3xl p-6 lg:p-8" aria-label="Настройки">
      <div className="space-y-4">
        <div className="rounded-xl border border-border-subtle bg-surface-subtle p-5">
          <div className="mb-5">
            <h2 className="font-medium">Запуск и фон</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Поведение установленного приложения
            </p>
          </div>

          <div className="space-y-2">
            <PreferenceRow
              label="Запускать вместе с системой"
              description={
                preferences && !preferences.openAtLoginSupported
                  ? "Доступно после установки приложения"
                  : "Открывать projectCHAT после входа в систему"
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
              label="Продолжать работу в трее"
              description="При закрытии окна опросы и виджет останутся активны"
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
              Системные настройки доступны в приложении projectCHAT.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-subtle p-5">
          <div className="mb-5">
            <h2 className="font-medium">Twitch</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Подключение к чату канала
            </p>
          </div>
          <TwitchSettings
            state={twitch}
            clientId={twitchClient}
            busy={busy}
            onClientIdChange={onTwitchClientChange}
            onCommand={onTwitchCommand}
          />
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-subtle p-5">
          <div>
            <h2 className="font-medium">Данные</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Черновик и шаблоны можно перенести на другой компьютер.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border-subtle pt-4">
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
            <p className="mt-3 text-xs text-muted-foreground">
              Закройте текущий опрос перед импортом.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-subtle p-5">
          <div className="mb-5">
            <h2 className="font-medium">Обновления</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Установка запускается только вручную.
            </p>
          </div>
          <UpdateSettings />
        </div>
      </div>
    </section>
  )
}

function PreferenceRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-5 rounded-xl bg-white/[0.025] px-4 py-3.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
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
