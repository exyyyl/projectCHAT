import { useEffect, useRef, useState } from "react"
import { MessageSquare, UsersRound, RefreshCw } from "lucide-react"
import { Skeleton, SkeletonGroup } from "./ui/skeleton"
import type { ChatParticipantsSnapshot } from "@/domain/chat"
import "./chat-participants.css"

export function ChatParticipants({
  channelId,
  avatars,
  onSelectViewer,
}: {
  channelId: string
  avatars: Record<string, string>
  onSelectViewer: (id: string) => void
}) {
  const root = useRef<HTMLElement>(null)
  const [data, setData] = useState<ChatParticipantsSnapshot | null>(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let inView = false,
      stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let request: AbortController | null = null
    const active = () => !stopped && inView && !document.hidden
    const load = async () => {
      if (!active() || request) return
      const controller = new AbortController()
      request = controller
      let delay = 5000
      try {
        const response = await fetch("/api/chat/participants", {
          signal: controller.signal,
        })
        if (response.status === 404)
          throw new Error("Перезапустите Cue, чтобы загрузить участников.")
        if (!response.ok) throw new Error("Не удалось обновить участников")
        const snapshot: ChatParticipantsSnapshot = await response.json()
        if (!controller.signal.aborted && snapshot.channelId === channelId) {
          setData(snapshot)
          setError("")
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Не удалось обновить участников"
          )
          delay = 30000
        }
      } finally {
        if (request === controller) request = null
        if (!controller.signal.aborted && active())
          timer = setTimeout(() => void load(), delay)
      }
    }
    const sync = () => {
      clearTimeout(timer)
      if (active()) void load()
      else {
        request?.abort()
        request = null
      }
    }
    const observer = new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting)
      sync()
    })
    if (root.current) observer.observe(root.current)
    document.addEventListener("visibilitychange", sync)
    return () => {
      stopped = true
      clearTimeout(timer)
      request?.abort()
      observer.disconnect()
      document.removeEventListener("visibilitychange", sync)
    }
  }, [channelId, retry])
  return (
    <section
      className="chat-participants"
      ref={root}
      aria-label="Участники чата"
    >
      <header>
        <h2>
          <UsersRound aria-hidden="true" />
          Участники{data && <span>{data.total.toLocaleString("ru")}</span>}
        </h2>
        {data && data.total > 50 && <span>Топ 50</span>}
      </header>
      {!data && !error ? (
        <SkeletonGroup
          label="Загружаем участников"
          className="chat-participants-loading"
        >
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </SkeletonGroup>
      ) : data?.participants.length ? (
        <ul
          className="chat-participants-list"
          aria-label="По активности в чате"
        >
          {data.participants.map((person) => (
            <li key={person.viewerId}>
              <button
                type="button"
                onClick={() => onSelectViewer(person.viewerId)}
                aria-label={`Открыть профиль ${person.viewerName || person.viewerLogin}, сообщений: ${person.messageCount}`}
              >
                <span className="chat-participant-avatar" aria-hidden="true">
                  {(person.viewerName || person.viewerLogin)
                    .slice(0, 1)
                    .toUpperCase()}
                  {avatars[person.viewerId] && (
                    <img
                      src={avatars[person.viewerId]}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.hidden = true
                      }}
                    />
                  )}
                </span>
                <span className="chat-participant-name">
                  {person.viewerName || person.viewerLogin}
                </span>
                <span className="chat-participant-count">
                  <MessageSquare aria-hidden="true" />
                  {person.messageCount.toLocaleString("ru")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !error && (
          <p className="chat-participants-empty">
            Пока нет активных участников
          </p>
        )
      )}
      {error && (
        <div className="chat-participants-error" role="status">
          <span>{error}</span>
          <button
            type="button"
            aria-label="Повторить загрузку участников"
            onClick={() => setRetry((n) => n + 1)}
          >
            <RefreshCw aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  )
}
