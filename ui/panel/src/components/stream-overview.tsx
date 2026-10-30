import { useEffect, useId, useState } from "react"
import { Clock3, Eye, EyeOff, Radio, Users } from "lucide-react"
import "./stream-overview.css"

type StreamSnapshot = {
  channelId: string
  status: "live" | "offline" | "disconnected"
  viewerCount: number | null
  startedAt: number | null
  serverNow: number
}

const blurPreference = "cue-stream-hide-viewers"
const viewersFormat = new Intl.NumberFormat("ru")

function readBlurPreference() {
  try {
    return localStorage.getItem(blurPreference) === "true"
  } catch {
    return false
  }
}

function StreamDuration({
  startedAt,
  offset,
}: {
  startedAt: number | null
  offset: number
}) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (startedAt === null) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [startedAt])
  if (startedAt === null) return <>—</>
  const seconds = Math.max(0, Math.floor((now + offset - startedAt) / 1000))
  return (
    <>
      {[Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
        .map((value) => String(value).padStart(2, "0"))
        .join(":")}
    </>
  )
}

export function StreamOverview({ channelId }: { channelId?: string }) {
  const viewerCountId = useId()
  const [snapshot, setSnapshot] = useState<StreamSnapshot | null>(null)
  const [offset, setOffset] = useState(0)
  const [failed, setFailed] = useState(false)
  const [blurred, setBlurred] = useState(readBlurPreference)

  useEffect(() => {
    if (!channelId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    let loading = false
    const refresh = async () => {
      if (loading || controller.signal.aborted || document.hidden) return
      clearTimeout(timer)
      loading = true
      try {
        const response = await fetch("/api/twitch/stream", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(12000),
          ]),
        })
        if (!response.ok) throw new Error("Stream unavailable")
        const next = (await response.json()) as StreamSnapshot
        if (next.channelId !== channelId) throw new Error("Account changed")
        if (!controller.signal.aborted) {
          setSnapshot(next)
          setOffset(next.serverNow - Date.now())
          setFailed(false)
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true)
      } finally {
        loading = false
        if (!controller.signal.aborted && !document.hidden)
          timer = setTimeout(() => void refresh(), 30000)
      }
    }
    const onVisibility = () => {
      clearTimeout(timer)
      if (!document.hidden) void refresh()
    }
    void refresh()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [channelId])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === blurPreference) setBlurred(event.newValue === "true")
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const toggleBlur = () => {
    const next = !blurred
    setBlurred(next)
    try {
      localStorage.setItem(blurPreference, String(next))
    } catch {
      /* The control also works without persistent storage. */
    }
  }
  const live = snapshot?.status === "live"
  const status = !channelId
    ? "Нет подключения"
    : failed
      ? "Нет связи"
      : !snapshot
        ? "Проверяем…"
        : live
          ? "В эфире"
          : "Не в эфире"
  const VisibilityIcon = blurred ? EyeOff : Eye

  return (
    <section className="stream-overview" aria-label="Показатели стрима">
      <button
        className="stream-overview-item stream-overview-viewers"
        type="button"
        onClick={toggleBlur}
        aria-pressed={blurred}
        aria-label={blurred ? "Показать онлайн" : "Скрыть онлайн"}
        aria-describedby={blurred ? undefined : viewerCountId}
      >
        <span className="stream-overview-label">
          <Users aria-hidden="true" />
          Онлайн
          <VisibilityIcon
            className="stream-overview-visibility"
            aria-hidden="true"
          />
        </span>
        <strong
          id={viewerCountId}
          className={
            blurred
              ? "stream-overview-number is-blurred"
              : "stream-overview-number"
          }
          aria-hidden={blurred || undefined}
        >
          {snapshot?.viewerCount == null
            ? "—"
            : viewersFormat.format(snapshot.viewerCount)}
        </strong>
        {blurred && <span className="sr-only">Онлайн скрыт</span>}
      </button>
      <div className="stream-overview-item">
        <span className="stream-overview-label">
          <Clock3 aria-hidden="true" />
          Время стрима
        </span>
        <strong className="stream-overview-number">
          <StreamDuration
            startedAt={snapshot?.startedAt ?? null}
            offset={offset}
          />
        </strong>
      </div>
      <div
        className="stream-overview-item"
        data-live={(live && !failed) || undefined}
      >
        <span className="stream-overview-label">
          <Radio aria-hidden="true" />
          Статус
        </span>
        <strong className="stream-overview-status">{status}</strong>
        {failed && snapshot && (
          <span className="sr-only">Показаны последние полученные данные</span>
        )}
      </div>
    </section>
  )
}
