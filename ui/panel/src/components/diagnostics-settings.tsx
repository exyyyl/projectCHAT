import { useCallback, useEffect, useState } from "react"
import { Copy, Download, ChevronRight, FileCheck2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loadDiagnostics, type DiagnosticReport } from "@/domain/diagnostics"

const date = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})
export function DiagnosticsSettings() {
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
  return (
    <div data-error-journal className="scroll-mt-6 space-y-4">
      {failed ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>Журнал недоступен. Попробуйте ещё раз.</span>
          <Button variant="outline" size="sm" onClick={refresh}>
            Повторить
          </Button>
        </div>
      ) : !report ? (
        <p className="text-sm text-muted-foreground">Загружаем журнал…</p>
      ) : count === 0 ? (
        <div className="flex items-center gap-2.5 py-1 text-sm text-muted-foreground">
          <FileCheck2 className="size-4" />
          Ошибок пока нет
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void exportReport(false)}
            >
              <Download />
              Скачать логи
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void exportReport(true)}
            >
              <Copy />
              {copied ? "Скопировано" : "Скопировать"}
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {count} / 100
            </span>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto overscroll-contain">
            {report.entries.map((entry) => (
              <details
                key={entry.id}
                className="group rounded-lg bg-background/50 px-3 py-2.5 open:bg-background"
              >
                <summary className="flex cursor-pointer list-none items-start gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  <span className="min-w-0 flex-1 text-sm leading-snug [overflow-wrap:anywhere]">
                    {entry.title}
                    {entry.count > 1 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ×{entry.count}
                      </span>
                    )}
                  </span>
                  <time className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
                    {date.format(entry.lastAt)}
                  </time>
                </summary>
                <div className="mt-3 text-[11px] text-muted-foreground">
                  {entry.source} · {entry.version}
                </div>
                <pre className="mt-2 text-[11px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap text-muted-foreground">
                  {entry.details}
                </pre>
              </details>
            ))}
          </div>
          <button
            className="rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            disabled={busy}
            onClick={() => void clear()}
          >
            Очистить журнал
          </button>
        </>
      )}
      {report && !report.storageAvailable && (
        <p className="text-xs text-destructive">
          Не удалось сохранить журнал на диск. Скачайте логи перед закрытием
          Cue.
        </p>
      )}
    </div>
  )
}
