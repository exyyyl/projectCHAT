import { useEffect, useState, type ReactNode } from "react"
import { Download, LoaderCircle, RefreshCw, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { FormSegmented } from "@/components/form-controls"
import { ErrorNotice } from "@/components/error-notice"

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
      .catch((error) => {
        if (active)
          toast({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "Не удалось загрузить версии",
          })
      })
    const unsubscribe = bridge.onVersionState((value) => {
      if (active) setState(value)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [bridge, toast])
  const busy =
    pending ||
    Boolean(
      state &&
      ["checking", "downloading", "unpacking", "restarting"].includes(
        state.phase
      )
    )
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
  const running = state?.currentChannel === branch
  const newer = slot?.updateAvailable
  const version =
    slot?.installedVersion ||
    (running ? state?.currentVersion : null) ||
    slot?.availableVersion
  const needsDownload = !slot?.installedVersion || newer
  const canRestart = Boolean(slot?.installedVersion && !slot.current)
  const subtitle = !state?.supported
    ? bridge
      ? "Режим разработки"
      : "Только в приложении"
    : downloading
      ? state.phase === "unpacking"
        ? "Подготавливаем файлы"
        : "Скачиваем обновление"
      : state.phase === "restarting"
        ? "Перезапускаем Cue…"
        : newer
          ? `Доступна ${slot?.availableVersion}`
          : slot?.current
            ? "Установлена"
            : canRestart
              ? "Готова к запуску"
              : "Не скачана"
  const failure =
    state?.errors[branch] ||
    (state?.phase === "error" && (!state.target || state.target === branch)
      ? state.message
      : "")
  return (
    <div className="space-y-4">
      <FormSegmented
        label="Версия приложения"
        hideLabel
        value={branch}
        options={[
          ["stable", "Стабильная"],
          ["beta", "Бета"],
        ]}
        disabled={busy}
        onChange={(value) => {
          if (value === "stable" || value === "beta") setBranch(value)
        }}
      />
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xl font-semibold tracking-tight tabular-nums">
            {version || "—"}
          </div>
          <p role="status" className="mt-1 text-xs text-muted-foreground">
            {subtitle}
          </p>
        </div>
        {state?.supported &&
          (downloading ? (
            <Button size="sm" variant="secondary" disabled>
              <LoaderCircle className="animate-spin" />
              {state.phase === "unpacking"
                ? "Подготовка"
                : `${state.progress}%`}
            </Button>
          ) : needsDownload ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void perform(() => bridge!.downloadVersion(branch))
              }
            >
              <Download />
              Скачать
            </Button>
          ) : canRestart ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void perform(() => bridge!.activateVersion(branch))
              }
            >
              <RotateCw />
              Перезапустить
            </Button>
          ) : null)}
      </div>
      {downloading && (
        <div
          className="h-1 overflow-hidden rounded-full bg-track"
          role="progressbar"
          aria-label="Загрузка версии"
          aria-valuenow={state.progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-brand transition-[width] motion-reduce:transition-none"
            style={{ width: `${state.progress}%` }}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="-ml-2 text-muted-foreground"
          disabled={!state?.supported || busy}
          onClick={() => void perform(() => bridge!.checkVersions())}
        >
          <RefreshCw
            className={state?.phase === "checking" ? "animate-spin" : undefined}
          />
          Проверить
        </Button>
        {canRestart && newer ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || !state?.supported}
            onClick={() => void perform(() => bridge!.activateVersion(branch))}
          >
            Запустить установленную
          </Button>
        ) : (
          children
        )}
      </div>
      {failure && !downloading && (
        <ErrorNotice error={failure} context="versions" />
      )}
    </div>
  )
}
