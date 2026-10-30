import { useEffect, useState } from "react"
import { VersionSwitcher } from "./version-switcher"

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
  if (!info || !update || !bridge) return <VersionSwitcher />

  const notesVersion = update.availableVersion || info.version

  return (
    <VersionSwitcher>
      {update.releaseNotes.length > 0 && (
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-muted-foreground">
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
    </VersionSwitcher>
  )
}
