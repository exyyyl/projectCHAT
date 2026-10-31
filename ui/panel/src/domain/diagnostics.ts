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
  element?.scrollIntoView({
    block: "nearest",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  })
}

export function recordClientError(value: unknown) {
  const message =
    value instanceof Error
      ? value.stack || value.message
      : String(value || "Неизвестная ошибка")
  const done = () => window.dispatchEvent(new Event("cue:diagnostic"))
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

export async function loadDiagnostics(): Promise<DiagnosticReport> {
  const response = await fetch("/api/diagnostics")
  if (!response.ok) throw new Error("Не удалось прочитать журнал")
  return response.json() as Promise<DiagnosticReport>
}
