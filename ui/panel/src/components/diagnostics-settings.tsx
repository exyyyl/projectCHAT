import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  FileCheck2,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { JournalLoadingSkeleton } from "@/components/loading-skeletons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { loadDiagnostics, type DiagnosticReport } from "@/domain/diagnostics"
import { presentError } from "../../../../public/error-messages.js"

const date = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

function sourceLabel(source: string) {
  if (source.startsWith("twitch")) return "Twitch"
  if (source.includes("versions") || source.includes("updat"))
    return "Обновления"
  if (source.startsWith("poll")) return "Опросы"
  if (source.startsWith("contest")) return "Конкурсы"
  return "Приложение"
}

export function DiagnosticsSettings() {
  const root = useRef<HTMLDivElement>(null)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const selectedRow = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [report, setReport] = useState<DiagnosticReport | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(() => {
    void loadDiagnostics()
      .then((value) => {
        setReport(value)
        setFailed(false)
      })
      .catch(() => setFailed(true))
  }, [])
  useEffect(() => {
    const element = root.current
    const show = () => {
      setSelectedId(null)
      setOpen(true)
      refresh()
    }
    element?.addEventListener("cue:open-diagnostics", show)
    return () => element?.removeEventListener("cue:open-diagnostics", show)
  }, [refresh])
  useEffect(() => {
    let active = true
    void loadDiagnostics()
      .then((value) => {
        if (active) setReport(value)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    window.addEventListener("cue:diagnostic", refresh)
    window.addEventListener("focus", refresh)
    return () => {
      active = false
      window.removeEventListener("cue:diagnostic", refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [refresh])
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  const exportReport = async (copy: boolean) => {
    setBusy(true)
    try {
      const latest = await loadDiagnostics()
      setReport(latest)
      const text = JSON.stringify(
        { app: "Cue", exportedAt: new Date().toISOString(), ...latest },
        null,
        2
      )
      if (copy) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
      } else {
        const href = URL.createObjectURL(
          new Blob([text], { type: "application/json;charset=utf-8" })
        )
        const anchor = document.createElement("a")
        anchor.href = href
        anchor.download = `Cue-errors-${new Date().toISOString().slice(0, 10)}.json`
        anchor.click()
        setTimeout(() => URL.revokeObjectURL(href), 1000)
      }
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  const clear = async () => {
    setBusy(true)
    try {
      const response = await fetch("/api/diagnostics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Poll-Client": "panel",
        },
        body: JSON.stringify({ type: "clear" }),
      })
      if (!response.ok) throw new Error()
      setReport((await response.json()) as DiagnosticReport)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  const count = report?.entries.length ?? 0
  const selected =
    report?.entries.find((entry) => entry.id === selectedId) ??
    report?.entries[0]
  const notice = selected
    ? presentError(selected.details.split("\n")[0], selected.source)
    : null
  return (
    <div ref={root} data-error-journal>
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!report && !failed ? (
            <SkeletonGroup
              label="Загрузка журнала"
              className="flex min-h-8 items-center"
            >
              <Skeleton className="h-3 w-44" />
            </SkeletonGroup>
          ) : (
            <p className="min-w-0 text-sm text-muted-foreground">
              {failed
                ? "Не удалось загрузить записи"
                : count === 0
                  ? "Ошибок пока нет"
                  : `Последняя запись — ${date.format(report!.entries[0].lastAt)}`}
            </p>
          )}
          <DialogTrigger asChild>
            <Button variant="secondary" className="px-3" onClick={refresh}>
              Открыть журнал
              <ArrowUpRight />
            </Button>
          </DialogTrigger>
        </div>
        <DialogContent className="flex h-[min(580px,calc(100dvh-2rem))] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <header className="shrink-0 px-5 pt-5 pr-12 pb-4">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Журнал ошибок
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-xs">
              Скачайте отчёт, чтобы передать его разработчику.
            </DialogDescription>
            {selectedId && count > 0 && (
              <Button
                variant="ghost"
                size="default"
                className="mt-3 -ml-2 sm:hidden"
                onClick={() => {
                  setSelectedId(null)
                  requestAnimationFrame(() => selectedRow.current?.focus())
                }}
              >
                <ArrowLeft />
                Все записи
              </Button>
            )}
          </header>
          {failed && (
            <div
              role="status"
              className="mx-5 mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-destructive"
            >
              Не удалось прочитать журнал или сохранить отчёт.
              <Button variant="ghost" size="sm" onClick={refresh}>
                Повторить
              </Button>
            </div>
          )}
          {report && !report.storageAvailable && (
            <p role="status" className="mx-5 mb-3 text-xs text-destructive">
              Записи не сохраняются на диск. Скачайте отчёт перед закрытием Cue.
            </p>
          )}
          {!report && !failed ? (
            <JournalLoadingSkeleton />
          ) : !report || count === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 text-muted-foreground">
              <FileCheck2 className="size-7" strokeWidth={1.5} />
              <p className="text-sm">
                {!report ? "Записи недоступны" : "Ошибок пока нет"}
              </p>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-rows-1 sm:grid-cols-[240px_minmax(0,1fr)]">
              <nav
                aria-label="События журнала"
                className={`min-h-0 overflow-y-auto overscroll-contain px-3 pb-3 ${selectedId ? "hidden sm:block" : ""}`}
              >
                {report.entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    aria-current={
                      entry.id === selected?.id ? "true" : undefined
                    }
                    onClick={(event) => {
                      selectedRow.current = event.currentTarget
                      setSelectedId(entry.id)
                      if (window.matchMedia("(max-width: 639px)").matches) {
                        requestAnimationFrame(() =>
                          detailHeading.current?.focus()
                        )
                      }
                    }}
                    className="mb-1 w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-ring aria-current:bg-surface-raised"
                  >
                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <time
                        dateTime={new Date(entry.lastAt).toISOString()}
                        className="min-w-0 flex-1"
                      >
                        {date.format(entry.lastAt)}
                      </time>
                      {entry.count > 1 && (
                        <span className="tabular-nums">×{entry.count}</span>
                      )}
                    </span>
                    <span className="mt-1.5 block text-sm leading-snug font-medium [overflow-wrap:anywhere]">
                      {entry.title}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {sourceLabel(entry.source)}
                    </span>
                  </button>
                ))}
              </nav>
              {selected && notice && (
                <section
                  aria-label="Подробности ошибки"
                  className={`mx-3 mb-3 min-h-0 min-w-0 overflow-y-auto overscroll-contain rounded-xl bg-background p-4 sm:ml-0 sm:p-5 ${selectedId ? "" : "hidden sm:block"}`}
                >
                  <h2
                    ref={detailHeading}
                    tabIndex={-1}
                    className="text-base leading-snug font-semibold [overflow-wrap:anywhere] outline-none"
                  >
                    {selected.title}
                  </h2>
                  {notice.description && (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {notice.description}
                    </p>
                  )}
                  <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Источник</dt>
                      <dd className="mt-1 [overflow-wrap:anywhere]">
                        {selected.source}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Версия</dt>
                      <dd className="mt-1 [overflow-wrap:anywhere]">
                        {selected.version || report.version}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Последний раз</dt>
                      <dd className="mt-1">{date.format(selected.lastAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Повторений</dt>
                      <dd className="mt-1 tabular-nums">{selected.count}</dd>
                    </div>
                  </dl>
                  <h3 className="mt-6 text-xs font-medium">
                    Технические подробности
                  </h3>
                  <pre className="mt-2 text-xs leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap text-muted-foreground">
                    {selected.details}
                  </pre>
                </section>
              )}
            </div>
          )}
          <footer className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-5 pt-2 pb-5 sm:flex">
            <Button
              variant="ghost"
              size="lg"
              className="justify-self-start px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              disabled={busy || !count}
              onClick={() => void clear()}
            >
              <Trash2 />
              Очистить
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="justify-self-end px-3 sm:min-w-36"
              disabled={busy || !count}
              onClick={() => void exportReport(true)}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Скопировано" : "Копировать"}
            </Button>
            <Button
              size="lg"
              className="col-span-2 px-4"
              disabled={busy || !count}
              onClick={() => void exportReport(false)}
            >
              <Download />
              Скачать отчёт
            </Button>
          </footer>
        </DialogContent>
      </Dialog>
    </div>
  )
}
