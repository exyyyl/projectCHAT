import { useEffect, useState } from "react"
import { Download, LoaderCircle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"

const updateStatus = (update: DesktopUpdateState) => {
  switch (update.phase) {
    case "development":
      return "Режим разработки"
    case "unconfigured":
      return "Обновления не настроены"
    case "checking":
      return "Ищем обновление…"
    case "available":
      return `Доступна ${update.availableVersion}`
    case "downloading":
      return `Загрузка · ${update.progress}%`
    case "ready":
      return `${update.availableVersion} готова`
    case "error":
      return "Ошибка проверки"
    case "current":
      return "Последняя версия"
    default:
      return "Проверка обновлений"
  }
}

export function UpdateSettings() {
  const showToast = useToast()
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

  useEffect(() => {
    if (update?.phase === "error")
      showToast({
        message: update.message || "Не удалось проверить обновления",
        tone: "error",
      })
  }, [showToast, update?.message, update?.phase])

  const bridge = window.streamPollsDesktop
  if (!info || !update || !bridge)
    return (
      <div className="rounded-xl bg-surface-subtle px-4 py-3 text-sm text-muted-foreground">
        Доступно в установленном приложении.
      </div>
    )

  const working = update.phase === "checking" || update.phase === "downloading"

  return (
    <div className="rounded-xl bg-surface-subtle p-1">
      <div className="flex min-h-16 items-center gap-4 rounded-lg px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{updateStatus(update)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            projectCHAT {info.version}
          </div>
        </div>

        {update.phase === "available" && (
          <Button onClick={() => void bridge.downloadUpdate()}>
            <Download /> Скачать
          </Button>
        )}
        {update.phase === "ready" && (
          <Button onClick={() => void bridge.installUpdate()}>
            Установить
          </Button>
        )}
        {["idle", "current", "error"].includes(update.phase) && (
          <Button
            variant="outline"
            disabled={working}
            onClick={() => void bridge.checkForUpdates()}
          >
            <RefreshCw /> Проверить
          </Button>
        )}
        {working && (
          <Button variant="outline" disabled>
            <LoaderCircle className="animate-spin" />
            {update.phase === "checking" ? "Проверяем" : `${update.progress}%`}
          </Button>
        )}
      </div>

      {update.phase === "downloading" && (
        <div className="mx-3.5 mb-3 h-1 overflow-hidden rounded-full bg-track">
          <div
            className="h-full rounded-full bg-brand transition-[width]"
            style={{ width: `${update.progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
