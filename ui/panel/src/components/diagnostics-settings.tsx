import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Download, FileCheck2, Trash2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { loadDiagnostics, type DiagnosticReport } from "@/domain/diagnostics"
import "./diagnostics-settings.css"

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
  const [query, setQuery] = useState("")
  const refresh = useCallback(async () => {
    try {
      setReport(await loadDiagnostics())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])
  useEffect(() => {
    let active = true
    const update = () => {
      void loadDiagnostics()
        .then((value) => {
          if (active) {
            setReport(value)
            setFailed(false)
          }
        })
        .catch(() => {
          if (active) setFailed(true)
        })
    }
    update()
    window.addEventListener("cue:diagnostic", update)
    window.addEventListener("focus", update)
    return () => {
      active = false
      window.removeEventListener("cue:diagnostic", update)
      window.removeEventListener("focus", update)
    }
  }, [])
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
  const search = query.trim().toLocaleLowerCase("ru")
  const entries = (report?.entries || []).filter(
    (entry) =>
      !search ||
      `${entry.title} ${entry.source} ${entry.details}`
        .toLocaleLowerCase("ru")
        .includes(search)
  )
  return (
    <section className="diagnostics-panel" aria-label="Записи журнала">
      <div className="diagnostics-toolbar">
        <div className="diagnostics-search">
          <Search aria-hidden="true" />
          <Input
            aria-label="Найти запись в журнале"
            placeholder="Найти запись…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="diagnostics-actions">
          <Button
            variant="ghost"
            className="diagnostics-clear"
            aria-label="Очистить журнал"
            disabled={busy || !count}
            onClick={() => void clear()}
          >
            <Trash2 />
            Очистить
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={copied ? "Отчёт скопирован" : "Копировать отчёт"}
            disabled={busy || !count}
            onClick={() => void exportReport(true)}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          <Button
            variant="outline"
            disabled={busy || !count}
            onClick={() => void exportReport(false)}
          >
            <Download />
            Скачать отчёт
          </Button>
        </div>
      </div>
      {copied && (
        <p className="sr-only" role="status">
          Отчёт скопирован
        </p>
      )}
      {failed && (
        <p role="status" className="diagnostics-notice">
          Не удалось прочитать журнал или сохранить отчёт.{" "}
          <button type="button" onClick={() => void refresh()}>
            Повторить
          </button>
        </p>
      )}
      {report && !report.storageAvailable && (
        <p role="status" className="diagnostics-notice">
          Записи не сохраняются на диск. Скачайте отчёт перед закрытием Cue.
        </p>
      )}
      <p className="diagnostics-count" role="status">
        {!report
          ? "Загрузка записей…"
          : search
            ? `Найдено: ${entries.length} из ${count}`
            : `Записей: ${count}`}
      </p>
      <div className="diagnostics-entries" aria-label="События журнала">
        {!report && !failed ? (
          <SkeletonGroup
            className="diagnostics-loading"
            label="Загрузка журнала"
          >
            {[0, 1, 2].map((item) => (
              <div key={item}>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-3 h-3 w-1/2" />
              </div>
            ))}
          </SkeletonGroup>
        ) : !report || !entries.length ? (
          <div className="diagnostics-empty">
            <FileCheck2 aria-hidden="true" />
            <p>
              {!report
                ? "Записи недоступны"
                : search
                  ? "Ничего не найдено"
                  : "Журнал пуст"}
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <article className="diagnostics-entry" key={entry.id}>
              <header>
                <h2>{entry.title}</h2>
                <div className="diagnostics-entry-meta">
                  <time dateTime={new Date(entry.lastAt).toISOString()}>
                    {date.format(entry.lastAt)}
                  </time>
                  <span>{entry.source}</span>
                  {entry.count > 1 && (
                    <span aria-label={`Повторений: ${entry.count}`}>
                      ×{entry.count}
                    </span>
                  )}
                </div>
              </header>
              <pre className="diagnostics-entry-text">{entry.details}</pre>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
