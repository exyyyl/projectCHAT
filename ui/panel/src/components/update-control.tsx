import { useEffect, useState } from "react"
import { CheckCircle2, Download, LoaderCircle, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const updateStatus = (update: DesktopUpdateState) => {
  switch (update.phase) {
    case "development":
      return "Режим разработки"
    case "unconfigured":
      return "Источник обновлений не настроен"
    case "checking":
      return "Проверяем новую версию…"
    case "available":
      return `Доступна версия ${update.availableVersion}`
    case "downloading":
      return `Загрузка · ${update.progress}%`
    case "ready":
      return `Версия ${update.availableVersion} готова`
    case "error":
      return "Не удалось проверить обновления"
    case "current":
      return "Установлена последняя версия"
    default:
      return "Можно проверить обновления"
  }
}

export function UpdateSettings() {
  const [info, setInfo] = useState<DesktopInfo | null>(null)
  const [update, setUpdate] = useState<DesktopUpdateState | null>(null)

  useEffect(() => {
    const bridge = window.streamPollsDesktop
    if (!bridge) return
    let active = true
    void bridge.getInfo().then((value) => {
      if (active) {
        setInfo(value)
        setUpdate(value.update)
      }
    })
    const unsubscribe = bridge.onUpdateState((value) => {
      if (active) setUpdate(value)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const bridge = window.streamPollsDesktop
  if (!info || !update || !bridge)
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-subtle px-4 py-3 text-sm text-muted-foreground">
        Обновления доступны в приложении projectCHAT.
      </div>
    )

  const working = update.phase === "checking" || update.phase === "downloading"

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium">{updateStatus(update)}</div>
          {update.message && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {update.message}
            </p>
          )}
        </div>
        <Badge
          variant="outline"
          className="font-mono text-[10px] text-muted-foreground uppercase"
        >
          {info.platform === "win32"
            ? "Windows"
            : info.platform === "darwin"
              ? "macOS"
              : info.platform}
        </Badge>
      </div>

      {update.phase === "downloading" && (
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-track">
          <div
            className="h-full rounded-full bg-brand transition-[width]"
            style={{ width: `${update.progress}%` }}
          />
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-border-subtle pt-4">
        <span className="text-xs text-muted-foreground">
          projectCHAT · {info.version}
        </span>
        {update.phase === "available" && (
          <Button onClick={() => void bridge.downloadUpdate()}>
            <Download />
            Скачать
          </Button>
        )}
        {update.phase === "ready" && (
          <Button onClick={() => void bridge.installUpdate()}>
            <RefreshCw />
            Установить
          </Button>
        )}
        {["idle", "current", "error"].includes(update.phase) && (
          <Button
            variant="outline"
            disabled={working}
            onClick={() => void bridge.checkForUpdates()}
          >
            <RefreshCw />
            Проверить
          </Button>
        )}
        {working && (
          <Button variant="outline" disabled>
            <LoaderCircle className="animate-spin" />
            {update.phase === "checking" ? "Проверка" : "Загрузка"}
          </Button>
        )}
        {update.phase === "development" && (
          <CheckCircle2 className="size-4 text-muted-foreground" />
        )}
      </div>
    </div>
  )
}
