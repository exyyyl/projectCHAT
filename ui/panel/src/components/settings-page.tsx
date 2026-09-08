import { useRef, useState, type ChangeEvent } from "react"
import { Download, FileUp } from "lucide-react"

import { UpdateSettings } from "@/components/update-control"
import { TwitchSettings } from "@/components/twitch-settings"
import { Button } from "@/components/ui/button"
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
  const [notice, setNotice] = useState("")

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
    setNotice("Файл настроек экспортирован")
  }

  const importSettings = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      if (file.size > 60_000) throw new Error("Файл слишком большой")
      const settings = JSON.parse(await file.text()) as unknown
      if (await onImport(settings)) setNotice("Настройки импортированы")
    } catch (failure) {
      setNotice(
        failure instanceof Error ? failure.message : "Не удалось прочитать файл"
      )
    }
  }

  return (
    <section className="mx-auto max-w-3xl p-6 lg:p-8" aria-label="Настройки">
      <div className="space-y-4">
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
            {notice && (
              <span className="self-center text-xs text-muted-foreground">
                {notice}
              </span>
            )}
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
