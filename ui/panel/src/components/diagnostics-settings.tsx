import { useCallback, useEffect, useRef, useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileCheck2,
  FileWarning,
  Trash2,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  loadDiagnostics,
  loadDiagnosticsSummary,
  summarizeDiagnostics,
  type DiagnosticReport,
  type DiagnosticSummary,
} from "@/domain/diagnostics"
import { presentError } from "../../../../public/error-messages.js"
import "./utility-windows.css"
import "./diagnostics-settings.css"

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
  const isOpen = useRef(false)
  const [open, setOpen] = useState(false)
  const [report, setReport] = useState<DiagnosticReport | null>(null)
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    try {
      if (isOpen.current) {
        const value = await loadDiagnostics()
        if (isOpen.current) setReport(value)
        setSummary(summarizeDiagnostics(value))
      } else setSummary(await loadDiagnosticsSummary())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])
  const changeOpen = useCallback(
    (value: boolean) => {
      isOpen.current = value
      setOpen(value)
      if (value) void refresh()
      else setReport(null)
    },
    [refresh]
  )
  useEffect(() => {
    const element = root.current
    const show = () => changeOpen(true)
    element?.addEventListener("cue:open-diagnostics", show)
    return () => element?.removeEventListener("cue:open-diagnostics", show)
  }, [changeOpen])
  useEffect(() => {
    let active = true
    void loadDiagnosticsSummary()
      .then((value) => {
        if (active) {
          setSummary(value)
          setFailed(false)
        }
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    const update = () => {
      void refresh()
    }
    window.addEventListener("cue:diagnostic", update)
    window.addEventListener("focus", update)
    return () => {
      active = false
      window.removeEventListener("cue:diagnostic", update)
      window.removeEventListener("focus", update)
    }
  }, [refresh])
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  const acceptReport = (value: DiagnosticReport) => {
    if (isOpen.current) setReport(value)
    setSummary(summarizeDiagnostics(value))
  }
  const exportReport = async (copy: boolean) => {
    setBusy(true)
    try {
      const latest = await loadDiagnostics()
      acceptReport(latest)
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
      acceptReport((await response.json()) as DiagnosticReport)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  const count = summary?.count ?? 0
  return (
    <div ref={root} data-error-journal>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="utility-launcher diagnostics-launcher"
          >
            <span className="utility-launcher-symbol">
              <FileWarning aria-hidden="true" />
            </span>
            <span className="utility-launcher-name">
              <span>Журнал ошибок</span>
              <small>
                {failed
                  ? "Не удалось загрузить записи"
                  : !summary
                    ? "Загрузка…"
                    : count
                      ? `Записей: ${count} · повторы объединены`
                      : "Ошибок пока нет"}
              </small>
            </span>
            <ChevronRight
              className="utility-launcher-arrow"
              aria-hidden="true"
            />
          </button>
        </DialogTrigger>
        <DialogContent
          className="utility-window diagnostics-window"
          showCloseButton={false}
        >
          <header className="utility-window-header">
            <FileWarning
              className="utility-heading-symbol"
              aria-hidden="true"
            />
            <div className="utility-heading">
              <DialogTitle>Журнал ошибок</DialogTitle>
              <DialogDescription>
                Повторы объединяются в одну запись
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="utility-tool utility-close diagnostics-close"
                aria-label="Закрыть журнал"
              >
                <X />
              </button>
            </DialogClose>
          </header>
          <div className="diagnostics-limits">
            <span>До 100 записей</span>
            <span>30 дней</span>
            <span>До 512 КБ</span>
          </div>
          {failed && (
            <p role="status" className="diagnostics-notice">
              Не удалось прочитать журнал или сохранить отчёт.{" "}
              <button type="button" onClick={() => void refresh()}>
                Повторить
              </button>
            </p>
          )}
          {summary && !summary.storageAvailable && (
            <p role="status" className="diagnostics-notice">
              Записи не сохраняются на диск. Скачайте отчёт перед закрытием Cue.
            </p>
          )}
          <div className="diagnostics-entries" aria-label="События журнала">
            {!report && !failed ? (
              <div
                className="diagnostics-loading"
                role="status"
                aria-label="Загрузка журнала"
              >
                <span />
                <span />
                <span />
              </div>
            ) : !report || !report.entries.length ? (
              <div className="diagnostics-empty">
                <FileCheck2 aria-hidden="true" />
                <p>{!report ? "Записи недоступны" : "Ошибок пока нет"}</p>
              </div>
            ) : (
              report.entries.map((entry) => {
                const notice = presentError(
                  entry.details.split("\n")[0],
                  entry.source
                )
                return (
                  <details className="diagnostics-entry" key={entry.id}>
                    <summary>
                      <span className="diagnostics-source">
                        {sourceLabel(entry.source)}
                      </span>
                      <span className="diagnostics-entry-name">
                        {entry.title}
                        <time dateTime={new Date(entry.lastAt).toISOString()}>
                          {date.format(entry.lastAt)}
                        </time>
                      </span>
                      {entry.count > 1 && (
                        <span
                          className="diagnostics-repeat"
                          aria-label={`Повторений: ${entry.count}`}
                        >
                          ×{entry.count}
                        </span>
                      )}
                      <ChevronDown aria-hidden="true" />
                    </summary>
                    <div className="diagnostics-detail">
                      {notice.description && <p>{notice.description}</p>}
                      <dl>
                        <div>
                          <dt>Источник</dt>
                          <dd>{entry.source}</dd>
                        </div>
                        <div>
                          <dt>Версия</dt>
                          <dd>{entry.version || report.version}</dd>
                        </div>
                        <div>
                          <dt>Впервые</dt>
                          <dd>{date.format(entry.firstAt)}</dd>
                        </div>
                        <div>
                          <dt>Повторений</dt>
                          <dd>{entry.count}</dd>
                        </div>
                      </dl>
                      <details className="diagnostics-stack">
                        <summary>Технические подробности</summary>
                        <pre>{entry.details}</pre>
                      </details>
                    </div>
                  </details>
                )
              })
            )}
          </div>
          <footer className="diagnostics-footer">
            <button
              type="button"
              className="diagnostics-clear"
              disabled={busy || !count}
              onClick={() => void clear()}
            >
              <Trash2 />
              Очистить
            </button>
            <button
              type="button"
              disabled={busy || !count}
              onClick={() => void exportReport(true)}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Скопировано" : "Копировать"}
            </button>
            <button
              type="button"
              className="diagnostics-download"
              disabled={busy || !count}
              onClick={() => void exportReport(false)}
            >
              <Download />
              Скачать отчёт
            </button>
          </footer>
        </DialogContent>
      </Dialog>
    </div>
  )
}
