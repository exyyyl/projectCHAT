import { useEffect, useState } from "react"
import { Download, LoaderCircle, RefreshCw } from "lucide-react"

import appIcon from "@/assets/app-icon.png"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
      <div className="rounded-lg px-3 py-4 text-sm text-muted-foreground">
        Доступно в установленном приложении.
      </div>
    )

  const working = update.phase === "checking" || update.phase === "downloading"
  const notesVersion = update.availableVersion || info.version

  return (
    <div>
      <div className="flex min-h-16 flex-wrap items-center gap-3 rounded-lg px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{updateStatus(update)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Версия {info.version}
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
        {update.releaseNotes.length > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" className="text-muted-foreground">
                Что нового
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
              <div className="flex items-center gap-4 px-6 pt-6 pb-5">
                <img
                  src={appIcon}
                  alt=""
                  className="size-11 shrink-0 rounded-xl"
                />
                <DialogHeader className="min-w-0 gap-1 text-left">
                  <DialogTitle className="text-lg">Что нового</DialogTitle>
                  <DialogDescription>Версия {notesVersion}</DialogDescription>
                </DialogHeader>
              </div>
              <ul className="min-h-0 space-y-2 overflow-y-auto overscroll-contain px-5 pb-5">
                {update.releaseNotes.slice(0, 3).map((note, index) => (
                  <li
                    key={note}
                    className="flex gap-3 rounded-xl bg-surface-subtle px-4 py-3.5 text-sm leading-relaxed"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-foreground/6 font-mono text-[10px] text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="pt-0.5 text-foreground/85">{note}</span>
                  </li>
                ))}
              </ul>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {update.phase === "downloading" && (
        <div className="mx-3 mb-3 h-1 overflow-hidden rounded-full bg-track">
          <div
            className="h-full rounded-full bg-brand transition-[width]"
            style={{ width: `${update.progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
