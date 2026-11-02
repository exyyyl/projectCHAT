export type DiagnosticEntry = {
  id: string
  title: string
  details: string
  source: string
  version: string
  firstAt: number
  lastAt: number
  count: number
}
export type DiagnosticReport = {
  schema: number
  version: string
  platform: string
  storageAvailable: boolean
  entries: DiagnosticEntry[]
}

export function revealErrorJournal() {
  const element = Array.from(
    document.querySelectorAll<HTMLElement>("[data-error-journal]")
  ).find((item) => item.getClientRects().length > 0)
  element?.dispatchEvent(new Event("cue:open-diagnostics"))
}

let changeTimer: ReturnType<typeof setTimeout> | undefined
let pendingReport: Promise<DiagnosticReport> | undefined

function notifyJournalChanged() {
  if (changeTimer !== undefined) return
  changeTimer = window.setTimeout(() => {
    changeTimer = undefined
    window.dispatchEvent(new Event("cue:diagnostic"))
  }, 250)
}

export function recordClientError(value: unknown) {
  const message =
    value instanceof Error
      ? value.stack || value.message
      : String(value || "Неизвестная ошибка")
  const done = notifyJournalChanged
  const nativeRecord = window.streamPollsDesktop?.recordError
  // Native IPC errors have already been saved with their original stack in the main process.
  if (nativeRecord && message.includes("Error invoking remote method")) {
    done()
    return
  }
  const save = nativeRecord
    ? nativeRecord(message.slice(0, 12000))
    : fetch("/api/diagnostics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Poll-Client": "panel",
        },
        body: JSON.stringify({
          type: "record",
          message: message.slice(0, 12000),
        }),
      })
  void save.catch(() => {}).finally(done)
}

export function loadDiagnostics(): Promise<DiagnosticReport> {
  if (!pendingReport) {
    pendingReport = fetch("/api/diagnostics")
      .then((response) => {
        if (!response.ok) throw new Error("Не удалось прочитать журнал")
        return response.json() as Promise<DiagnosticReport>
      })
      .finally(() => {
        pendingReport = undefined
      })
  }
  return pendingReport
}

export type DiagnosticSummary = Omit<DiagnosticReport, "entries"> & {
  count: number
  totalOccurrences: number
  lastAt: number | null
}

export function summarizeDiagnostics(
  report: DiagnosticReport
): DiagnosticSummary {
  const { entries, ...metadata } = report
  return {
    ...metadata,
    count: entries.length,
    totalOccurrences: entries.reduce((sum, entry) => sum + entry.count, 0),
    lastAt: entries[0]?.lastAt ?? null,
  }
}

let pendingSummary: Promise<DiagnosticSummary> | undefined
export function loadDiagnosticsSummary(): Promise<DiagnosticSummary> {
  if (!pendingSummary) {
    pendingSummary = fetch("/api/diagnostics?summary=1")
      .then((response) => {
        if (!response.ok) throw new Error("Не удалось прочитать журнал")
        return response.json() as Promise<DiagnosticSummary>
      })
      .finally(() => {
        pendingSummary = undefined
      })
  }
  return pendingSummary
}
