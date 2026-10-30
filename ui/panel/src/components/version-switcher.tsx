import { useEffect, useState, type ReactNode } from "react"
import { Download, LoaderCircle, RefreshCw, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function VersionSwitcher({ children }: { children?: ReactNode }) {
  const [state, setState] = useState<DesktopVersionState | null>(null)
  const [pending, setPending] = useState(false)
  const [branch, setBranch] = useState<"stable" | "beta">("stable")
  const toast = useToast()
  const bridge = window.streamPollsDesktop
  useEffect(() => {
    if (!bridge?.getVersions) return
    let active = true
    void bridge
      .getVersions()
      .then((value) => {
        if (active) {
          setState(value)
          setBranch(value.currentChannel)
        }
      })
      .catch(() => {})
    const unsubscribe = bridge.onVersionState((value) => {
      if (active) setState(value)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [bridge])
  const busy =
    pending ||
    (!!state &&
      ["checking", "downloading", "unpacking", "restarting"].includes(
        state.phase
      ))
  const perform = async (action: () => Promise<unknown>) => {
    setPending(true)
    try {
      await action()
    } catch (error) {
      toast({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось подготовить версию",
      })
    } finally {
      setPending(false)
    }
  }
  const slot = state?.slots[branch]
  const downloading =
    state?.target === branch &&
    ["downloading", "unpacking"].includes(state.phase)
  const newer = slot?.updateAvailable
  const running = state?.currentChannel === branch
  const version =
    slot?.installedVersion || (running ? state?.currentVersion : null)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={branch}
          onValueChange={(value) => {
            if (value === "stable" || value === "beta") setBranch(value)
          }}
          aria-label="Версия приложения"
          className="gap-1 rounded-lg bg-background/50 p-1"
        >
          <ToggleGroupItem value="stable" className="h-8 px-3">
            Стабильная
          </ToggleGroupItem>
          <ToggleGroupItem value="beta" className="h-8 px-3">
            Бета
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            disabled={!state?.supported || busy}
            onClick={() => void perform(() => bridge!.checkVersions())}
          >
            <RefreshCw
              className={
                state?.phase === "checking" ? "animate-spin" : undefined
              }
            />
            Проверить
          </Button>
          {children}
        </div>
      </div>
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <div className="flex items-center gap-2">
            <span
              className={
                version
                  ? "text-sm font-medium tabular-nums"
                  : "text-sm font-medium"
              }
            >
              {version ||
                (state
                  ? "Не скачана"
                  : bridge
                    ? "Загрузка…"
                    : "Не установлена")}
            </span>
          </div>
          {(running || newer || version) && (
            <p className="text-xs text-muted-foreground">
              {newer
                ? `Доступна ${slot.availableVersion}`
                : running
                  ? slot?.current || !state?.supported
                    ? "Текущая версия"
                    : `Сейчас ${state.currentVersion}`
                  : "Готова к запуску"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {downloading ? (
            <Button size="sm" variant="outline" disabled>
              <LoaderCircle className="animate-spin" />
              {state.phase === "unpacking"
                ? "Подготовка"
                : `${state.progress}%`}
            </Button>
          ) : (
            <>
              {(!slot?.installedVersion || newer) &&
                (state?.supported || !running) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!state?.supported || busy}
                    onClick={() =>
                      void perform(() => bridge!.downloadVersion(branch))
                    }
                  >
                    <Download />
                    {newer ? "Скачать новую" : "Скачать"}
                  </Button>
                )}
              {slot?.installedVersion && !slot.current && (
                <Button
                  size="sm"
                  disabled={busy || !state?.supported}
                  onClick={() =>
                    void perform(() => bridge!.activateVersion(branch))
                  }
                >
                  <RotateCw />
                  Перезапустить
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {state?.errors[branch] && !downloading && (
        <p
          role="status"
          className="pb-3 text-xs leading-relaxed break-words text-destructive"
        >
          {state.errors[branch]}
        </p>
      )}
      {state?.phase === "downloading" && (
        <div className="my-2 h-1 overflow-hidden rounded-full bg-track">
          <div
            className="h-full bg-brand transition-[width]"
            style={{ width: `${state.progress}%` }}
          />
        </div>
      )}
      {(!state?.supported || state.phase === "restarting") && (
        <div className="flex flex-wrap items-center justify-between gap-2 py-1">
          {!state?.supported && (
            <span className="text-xs text-muted-foreground">
              {state?.phase === "development"
                ? "Режим разработки"
                : "Только в приложении"}
            </span>
          )}
          {state?.phase === "restarting" && (
            <span role="status" className="text-xs text-muted-foreground">
              Перезапускаем…
            </span>
          )}
        </div>
      )}
      {branch === "beta" && (
        <p className="pt-1 text-xs text-muted-foreground">
          Данные беты хранятся отдельно.
        </p>
      )}
      {state?.message && state.phase !== "error" && (
        <p role="status" className="pb-2 text-xs text-muted-foreground">
          {state.message}
        </p>
      )}
    </div>
  )
}
