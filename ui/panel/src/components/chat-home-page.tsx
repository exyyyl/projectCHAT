import {
  ModeratedMessage,
  ModerationSettings,
  type ModerationAction,
} from "./chat-moderation"
import {
  failedChatMessage,
  mergeChatFeed,
  outgoingChatMessage,
  type FeedMessage,
} from "@/domain/chat-delivery"
import { useToast } from "./ui/toast"
import {
  ArrowDown,
  ExternalLink,
  Gift,
  Megaphone,
  MessageCircle,
  Plus,
  Radio,
  Send,
  Sparkles,
  Trash2,
  WifiOff,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type {
  ChatBadge,
  ChatBadgeAsset,
  ChatMessage,
  ChatProfile,
  RecentChat,
} from "@/domain/chat"
import type { TwitchState, Poll } from "@/domain/polls"
import type { Contest } from "@/domain/contest"
import type { AppView } from "@/domain/app-navigation"
import { ChatEmotePicker, ChatMessageBody } from "@/components/chat-emotes"
import { emoteLookup, insertEmote } from "@/domain/chat-emotes"
import type { ChatEmoteCatalog, ChatEmoteProvider } from "@/domain/chat-emotes"
import { StreamerDashboard } from "@/components/streamer-dashboard"
import { StreamOverview } from "@/components/stream-overview"

const timeFormat = new Intl.DateTimeFormat("ru", {
  hour: "2-digit",
  minute: "2-digit",
})
const dateFormat = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  year: "numeric",
})
const dateTimeFormat = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  const data = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || "Не удалось загрузить чат.")
  return data
}

async function noteCommand(body: Record<string, unknown>) {
  const response = await fetch("/api/chat/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Poll-Client": "panel" },
    body: JSON.stringify(body),
  })
  const data = (await response.json()) as { error?: string }
  if (!response.ok)
    throw new Error(data.error || "Не удалось сохранить заметку.")
}

function ViewerAvatar({ name, url }: { name: string; url?: string }) {
  const [failedUrl, setFailedUrl] = useState("")
  return (
    <span className="chat-viewer-avatar" aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
      {url && failedUrl !== url && (
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
        />
      )}
    </span>
  )
}

function TwitchBadges({
  badges,
  assets,
}: {
  badges: ChatBadge[]
  assets: Record<string, ChatBadgeAsset>
}) {
  const visible = (badges || [])
    .map((badge) => ({
      key: `${badge.setId}/${badge.id}`,
      asset: assets[`${badge.setId}/${badge.id}`],
    }))
    .filter((badge) => badge.asset)
  if (!visible.length) return null
  return (
    <span className="chat-home-badges">
      {visible.map(({ key, asset }) => (
        <img
          key={key}
          src={asset.url}
          alt={asset.title}
          title={asset.title}
          referrerPolicy="no-referrer"
        />
      ))}
    </span>
  )
}

function ActivityIcon({ type }: { type: string }) {
  if (type === "raid") return <Radio aria-hidden="true" />
  if (type === "gift" || type === "subscription")
    return <Gift aria-hidden="true" />
  if (type === "announcement" || type === "shoutout")
    return <Megaphone aria-hidden="true" />
  return <Sparkles aria-hidden="true" />
}

export function ChatHomePage({
  twitch,
  poll,
  contest,
  onNavigate,
  emoteProvider = "ffz",
}: {
  emoteProvider?: ChatEmoteProvider
  twitch: TwitchState
  poll: Poll | null
  contest: Contest | null
  onNavigate: (view: AppView) => void
}) {
  const showToast = useToast()
  const [moderation, setModeration] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("cue-chat-moderation") || "{}"
      )
      return {
        gestures: saved?.gestures !== false,
        duration: [60, 300, 600].includes(saved?.duration)
          ? Number(saved.duration)
          : 600,
      }
    } catch {
      return { gestures: true, duration: 600 }
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem("cue-chat-moderation", JSON.stringify(moderation))
    } catch {
      /* optional local preference */
    }
  }, [moderation])
  const channelId = twitch.userId
  const [messages, setMessages] = useState<FeedMessage[]>([])
  const [summary, setSummary] = useState<RecentChat["archive"] | null>(null)
  const [selectedViewer, setSelectedViewer] = useState<string | null>(null)
  const [profileTab, setProfileTab] = useState<"messages" | "notes">("messages")
  const [profile, setProfile] = useState<ChatProfile | null>(null)
  const [loading, setLoading] = useState(Boolean(channelId))
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [error, setError] = useState("")
  const [unseen, setUnseen] = useState(0)
  const [composer, setComposer] = useState("")
  const deliveryQueue = useRef<Promise<void>>(Promise.resolve())
  const [avatars, setAvatars] = useState<Record<string, string>>({})
  const [badgeAssets, setBadgeAssets] = useState<
    Record<string, ChatBadgeAsset>
  >({})
  const [emoteState, setEmoteState] = useState<{
    channelId: string
    requestKey: string
    catalog: ChatEmoteCatalog | null
    error: boolean
    loadedAt: number
  }>({
    channelId: "",
    requestKey: "",
    catalog: null,
    error: false,
    loadedAt: 0,
  })
  const [emoteRevision, setEmoteRevision] = useState(0)
  const emoteKey = `${channelId}:${Boolean(twitch.canReadEmotes)}:${emoteRevision}`
  const emoteLoading = Boolean(channelId) && emoteState.requestKey !== emoteKey
  const composerRef = useRef<HTMLInputElement>(null)
  const catalog = emoteState.channelId === channelId ? emoteState.catalog : null
  const lookup = useMemo(
    () => emoteLookup(catalog?.emotes || [], emoteProvider),
    [catalog, emoteProvider]
  )
  const reloadEmotes = () => setEmoteRevision((revision) => revision + 1)
  useEffect(() => {
    if (!channelId) return
    const controller = new AbortController()
    void fetch("/api/chat/emotes", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("emotes")
        return response.json() as Promise<ChatEmoteCatalog>
      })
      .then((data) => {
        if (data.channelId !== channelId) throw new Error("account changed")
        if (!controller.signal.aborted)
          setEmoteState({
            channelId,
            requestKey: emoteKey,
            catalog: data,
            error: false,
            loadedAt: Date.now(),
          })
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setEmoteState((current) => ({
            channelId,
            requestKey: emoteKey,
            catalog: current.channelId === channelId ? current.catalog : null,
            error: true,
            loadedAt: Date.now(),
          }))
      })
    return () => controller.abort()
  }, [channelId, emoteKey])

  useEffect(() => {
    if (!channelId) return
    const timer = setInterval(
      () => setEmoteRevision((revision) => revision + 1),
      300_000
    )
    return () => clearInterval(timer)
  }, [channelId])

  const addEmote = (code: string, keepOpen: boolean) => {
    const input = composerRef.current
    if (!input) return
    const result = insertEmote(
      composer,
      code,
      input.selectionStart ?? composer.length,
      input.selectionEnd ?? composer.length
    )
    if (!result) {
      setError("В сообщении может быть не более 500 символов.")
      return
    }
    setComposer(result.text)
    requestAnimationFrame(() => {
      if (!keepOpen) input.focus({ preventScroll: true })
      input.setSelectionRange(result.caret, result.caret)
    })
  }
  const requestedAvatars = useRef(new Set<string>())
  const pendingAvatars = useRef(new Set<string>())
  const avatarTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const profileCloseRef = useRef<HTMLButtonElement>(null)
  const selectedViewerRef = useRef<string | null>(null)
  const nearBottom = useRef(true)
  const scrollRestore = useRef<number | null>(null)

  useEffect(() => {
    if (!channelId) return
    const ids = [
      ...new Set([
        ...messages.slice(-70).map((message) => message.viewerId),
        ...(selectedViewer ? [selectedViewer] : []),
      ]),
    ].filter((id) => !requestedAvatars.current.has(id))
    for (const id of ids) pendingAvatars.current.add(id)
    if (!pendingAvatars.current.size) return
    if (avatarTimer.current) return
    avatarTimer.current = setTimeout(() => {
      avatarTimer.current = null
      const batch = [...pendingAvatars.current].slice(0, 100)
      for (const id of batch) {
        requestedAvatars.current.add(id)
        pendingAvatars.current.delete(id)
      }
      const query = new URLSearchParams(batch.map((id) => ["id", id]))
      void getJson<{ avatars: Record<string, string> }>(
        `/api/chat/avatars?${query}`
      )
        .then((data) => {
          setAvatars((current) => ({ ...current, ...data.avatars }))
        })
        .catch(() => {})
    }, 150)
  }, [channelId, messages, selectedViewer])

  useEffect(
    () => () => {
      if (avatarTimer.current) clearTimeout(avatarTimer.current)
    },
    []
  )

  useEffect(() => {
    if (!channelId) return
    let cancelled = false
    void getJson<{ badges: Record<string, ChatBadgeAsset> }>("/api/chat/badges")
      .then((data) => {
        if (!cancelled) setBadgeAssets(data.badges)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [channelId])

  const loadRecent = useCallback(async () => {
    if (!channelId) return
    try {
      const data = await getJson<RecentChat>("/api/chat/recent")
      if (data.channelId !== channelId) return
      setSummary(data.archive)
      setMessages((current) => mergeChatFeed(current, data.messages))
      setError("")
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось загрузить чат."
      )
    } finally {
      setLoading(false)
    }
  }, [channelId])

  useEffect(() => {
    if (!channelId) return
    const events = new EventSource("/api/chat/events")
    events.addEventListener("message", (event) => {
      const message = JSON.parse((event as MessageEvent).data) as ChatMessage
      setMessages((current) =>
        mergeChatFeed(current, [message], { echo: true })
      )
      setSummary((current) =>
        current
          ? {
              ...current,
              count: current.count + (message.kind === "activity" ? 0 : 1),
              feedCount: current.feedCount + 1,
              firstSeen: current.firstSeen || message.sentAt,
            }
          : current
      )
      if (!nearBottom.current) setUnseen((count) => count + 1)
    })
    events.addEventListener("update", (event) => {
      const message = JSON.parse((event as MessageEvent).data) as ChatMessage
      setMessages((current) =>
        current.some((item) => item.id === message.id)
          ? mergeChatFeed(current, [message])
          : current
      )
      setProfile((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((item) =>
                item.id === message.id ? message : item
              ),
            }
          : current
      )
    })
    events.onopen = () => void loadRecent()
    return () => events.close()
  }, [channelId, loadRecent])

  const selectViewer = (viewerId: string) => {
    if (selectedViewerRef.current === viewerId) return
    selectedViewerRef.current = viewerId
    setSelectedViewer(viewerId)
    setProfile(null)
    setLoadingProfile(true)
    setProfileTab("messages")
  }

  const closeProfile = () => {
    selectedViewerRef.current = null
    setSelectedViewer(null)
    setNoteText("")
  }

  useEffect(() => {
    if (!selectedViewer) return
    profileCloseRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeProfile()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedViewer])

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    if (scrollRestore.current !== null) {
      list.scrollTop = list.scrollHeight - scrollRestore.current
      scrollRestore.current = null
    } else if (nearBottom.current) {
      list.scrollTop = list.scrollHeight
    }
  }, [messages])

  const loadOlder = async () => {
    const first = messages[0]
    if (!first || loadingOlder) return
    setLoadingOlder(true)
    try {
      const data = await getJson<RecentChat>(
        `/api/chat/recent?before=${first.id}`
      )
      const list = listRef.current
      scrollRestore.current = list ? list.scrollHeight - list.scrollTop : null
      setMessages((current) => mergeChatFeed(data.messages, current))
      setSummary(data.archive)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось загрузить историю."
      )
    } finally {
      setLoadingOlder(false)
    }
  }

  useEffect(() => {
    if (!selectedViewer || !channelId) return
    let cancelled = false
    void getJson<ChatProfile>(
      `/api/chat/profile?viewerId=${encodeURIComponent(selectedViewer)}`
    )
      .then((data) => {
        if (!cancelled) setProfile(data)
      })
      .catch((cause) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Не удалось открыть профиль."
          )
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false)
      })
    return () => {
      cancelled = true
    }
  }, [channelId, selectedViewer])

  const loadOlderProfile = async () => {
    if (!profile?.messages.length || !selectedViewer) return
    try {
      const data = await getJson<ChatProfile>(
        `/api/chat/profile?viewerId=${encodeURIComponent(selectedViewer)}&before=${profile.messages.at(-1)!.id}`
      )
      setProfile((current) =>
        current?.viewerId === selectedViewer
          ? { ...current, messages: [...current.messages, ...data.messages] }
          : current
      )
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось загрузить историю."
      )
    }
  }

  const saveNote = async () => {
    if (!selectedViewer || !noteText.trim() || savingNote) return
    setSavingNote(true)
    try {
      await noteCommand({
        type: "add",
        viewerId: selectedViewer,
        text: noteText.trim(),
      })
      setNoteText("")
      const data = await getJson<ChatProfile>(
        `/api/chat/profile?viewerId=${encodeURIComponent(selectedViewer)}`
      )
      setProfile((current) =>
        current?.viewerId === selectedViewer
          ? { ...current, notes: data.notes }
          : current
      )
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось сохранить заметку."
      )
    } finally {
      setSavingNote(false)
    }
  }

  const deleteNote = async (noteId: string) => {
    if (!selectedViewer) return
    try {
      await noteCommand({ type: "delete", viewerId: selectedViewer, noteId })
      setProfile((current) =>
        current?.viewerId === selectedViewer
          ? {
              ...current,
              notes: current.notes.filter((note) => note.id !== noteId),
            }
          : current
      )
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось удалить заметку."
      )
    }
  }

  const moderate = async (action: ModerationAction, message: ChatMessage) => {
    try {
      const response = await fetch("/api/chat/moderate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Poll-Client": "panel",
        },
        body: JSON.stringify({
          channelId,
          messageId: message.id,
          action,
          duration: moderation.duration,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok)
        throw new Error(data.error || "Не удалось выполнить действие.")
      showToast({
        message:
          action === "delete"
            ? "Сообщение удалено"
            : `${message.viewerName}: тайм-аут ${moderation.duration / 60} мин`,
        tone: "success",
      })
    } catch (cause) {
      showToast({
        message: cause instanceof Error ? cause.message : "Ошибка модерации",
        tone: "error",
      })
    }
  }

  const enqueueMessage = (message: FeedMessage) => {
    const key = message.localKey!
    deliveryQueue.current = deliveryQueue.current.then(async () => {
      try {
        const response = await fetch("/api/chat/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Poll-Client": "panel",
          },
          body: JSON.stringify({ text: message.text, channelId }),
        })
        const data = (await response.json()) as {
          error?: string
          message?: ChatMessage
        }
        if (!response.ok || !data.message)
          throw new Error(data.error || "Не удалось подтвердить отправку.")
        setMessages((current) =>
          mergeChatFeed(current, [data.message!], { confirmedKey: key })
        )
      } catch (cause) {
        const error =
          cause instanceof Error
            ? cause.message
            : "Не удалось отправить сообщение."
        setMessages((current) => failedChatMessage(current, key, error))
      }
    })
  }
  const retryMessage = (message: FeedMessage) => {
    if (message.delivery !== "failed" || twitch.phase !== "connected") return
    setMessages((current) =>
      current.map((item) =>
        item.localKey === message.localKey
          ? { ...item, delivery: "sending", deliveryError: undefined }
          : item
      )
    )
    enqueueMessage(message)
  }
  const sendChat = () => {
    const text = composer.trim()
    if (!text || !channelId || twitch.phase !== "connected" || !twitch.canSend)
      return
    if (messages.filter((item) => item.delivery === "sending").length >= 10) {
      showToast({
        message: "В очереди уже 10 сообщений. Дождитесь отправки.",
        tone: "warning",
      })
      return
    }
    const message = outgoingChatMessage(
      messages,
      {
        userId: channelId,
        displayName: twitch.displayName || twitch.login,
        login: twitch.login,
      },
      text,
      crypto.randomUUID(),
      Date.now()
    )
    setComposer("")
    setError("")
    setMessages((current) => [...current, message].slice(-1000))
    enqueueMessage(message)
  }

  return (
    <section
      className="chat-home"
      data-profile-open={Boolean(selectedViewer) || undefined}
    >
      <StreamerDashboard
        poll={poll}
        contest={contest}
        summary={summary}
        onNavigate={onNavigate}
      />
      <div className="chat-home-main">
        <header className="chat-home-header">
          <h1>Чат</h1>
          <ModerationSettings
            twitch={twitch}
            gestures={moderation.gestures}
            duration={moderation.duration}
            onGestures={(gestures) =>
              setModeration((current) => ({ ...current, gestures }))
            }
            onDuration={(duration) =>
              setModeration((current) => ({ ...current, duration }))
            }
            onReconnect={() => onNavigate("settings")}
          />
        </header>
        <StreamOverview key={channelId || "offline"} channelId={channelId} />
        {error && (
          <p className="chat-home-error" role="alert">
            {error}
          </p>
        )}
        {!channelId ? (
          <div className="chat-home-empty">
            <WifiOff aria-hidden="true" />
            <strong>Подключите Twitch</strong>
            <span>Сообщения появятся здесь после подключения.</span>
          </div>
        ) : (
          <div className="chat-home-feed-wrap">
            <div
              className="chat-home-feed"
              ref={listRef}
              onScroll={(event) => {
                const element = event.currentTarget
                nearBottom.current =
                  element.scrollHeight -
                    element.scrollTop -
                    element.clientHeight <
                  72
                if (nearBottom.current) setUnseen(0)
              }}
            >
              {summary &&
                messages.length > 0 &&
                summary.feedCount > messages.length &&
                messages.length < 1000 && (
                  <button
                    className="chat-home-older"
                    type="button"
                    onClick={() => void loadOlder()}
                    disabled={loadingOlder}
                  >
                    Ранние сообщения
                  </button>
                )}
              {loading ? (
                <div className="chat-home-empty">
                  <span>Загрузка чата…</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="chat-home-empty">
                  <MessageCircle aria-hidden="true" />
                  <strong>Чат пока пуст</strong>
                  <span>Первое сообщение появится здесь.</span>
                </div>
              ) : (
                messages.map((message) =>
                  message.kind === "activity" ? (
                    <article
                      className="chat-home-activity"
                      data-type={message.activityType}
                      key={message.id}
                    >
                      <time
                        title={dateTimeFormat.format(message.sentAt)}
                        dateTime={new Date(message.sentAt).toISOString()}
                      >
                        {timeFormat.format(message.sentAt)}
                      </time>
                      <span className="chat-home-activity-icon">
                        <ActivityIcon type={message.activityType} />
                      </span>
                      <div>
                        {message.viewerId !== "system" ? (
                          <button
                            type="button"
                            className="chat-home-author"
                            style={
                              message.nameColor
                                ? { color: message.nameColor }
                                : undefined
                            }
                            onClick={() => selectViewer(message.viewerId)}
                          >
                            {message.viewerName}
                          </button>
                        ) : (
                          <strong>{message.viewerName}</strong>
                        )}{" "}
                        <span>
                          <ChatMessageBody
                            text={message.text}
                            emotes={message.emotes}
                            lookup={lookup}
                          />
                        </span>
                      </div>
                    </article>
                  ) : (
                    <ModeratedMessage
                      key={message.localKey || message.id}
                      message={message}
                      gestures={moderation.gestures}
                      duration={moderation.duration}
                      canDelete={twitch.phase === "connected" && message.id > 0}
                      canTimeout={
                        twitch.phase === "connected" &&
                        message.id > 0 &&
                        message.viewerId !== `twitch:${channelId}`
                      }
                      onModerate={moderate}
                      delivery={message.delivery}
                    >
                      <time
                        title={dateTimeFormat.format(message.sentAt)}
                        dateTime={new Date(message.sentAt).toISOString()}
                      >
                        {timeFormat.format(message.sentAt)}
                      </time>
                      <ViewerAvatar
                        name={message.viewerName}
                        url={
                          message.viewerId === `twitch:${channelId}`
                            ? twitch.profileImageUrl ||
                              avatars[message.viewerId]
                            : avatars[message.viewerId]
                        }
                      />
                      <div>
                        <TwitchBadges
                          badges={message.badges}
                          assets={badgeAssets}
                        />
                        <button
                          type="button"
                          className="chat-home-author"
                          style={
                            message.nameColor
                              ? { color: message.nameColor }
                              : undefined
                          }
                          onClick={() => selectViewer(message.viewerId)}
                        >
                          {message.viewerName}
                        </button>
                        {message.cheerBits > 0 && (
                          <span className="chat-home-bits">
                            {message.cheerBits.toLocaleString("ru")} Bits
                          </span>
                        )}
                        <span className="chat-home-text">
                          <ChatMessageBody
                            text={message.text}
                            emotes={message.emotes}
                            lookup={lookup}
                          />
                        </span>
                        {message.deleted && (
                          <span className="chat-home-deleted-label">
                            Удалено
                          </span>
                        )}
                        {message.delivery === "sending" && (
                          <span
                            className="chat-home-delivery-state"
                            role="status"
                          >
                            Отправка…
                          </span>
                        )}
                        {message.delivery === "failed" && (
                          <span
                            className="chat-home-delivery-error"
                            role="alert"
                          >
                            <span>{message.deliveryError}</span>
                            <button
                              type="button"
                              onClick={() => retryMessage(message)}
                            >
                              Повторить
                            </button>
                          </span>
                        )}
                      </div>
                    </ModeratedMessage>
                  )
                )
              )}
            </div>
            {unseen > 0 && (
              <button
                className="chat-home-unseen"
                type="button"
                onClick={() => {
                  const list = listRef.current
                  if (list) list.scrollTop = list.scrollHeight
                  nearBottom.current = true
                  setUnseen(0)
                }}
              >
                <ArrowDown aria-hidden="true" /> {unseen} новых
              </button>
            )}
          </div>
        )}
        {twitch.phase === "connected" && !twitch.canSend ? (
          <div className="chat-home-compose-permission">
            <span>Чтобы писать в чат, разрешите отправку в Twitch.</span>
            <button type="button" onClick={() => onNavigate("settings")}>
              Переподключить
            </button>
          </div>
        ) : (
          <form
            className="chat-home-composer"
            onSubmit={(event) => {
              event.preventDefault()
              composerRef.current?.focus({ preventScroll: true })
              void sendChat()
            }}
          >
            <input
              ref={composerRef}
              aria-label="Сообщение в чат Twitch"
              maxLength={500}
              placeholder={
                twitch.phase === "connected"
                  ? "Сообщение в чат…"
                  : "Чат недоступен"
              }
              value={composer}
              disabled={twitch.phase !== "connected"}
              onChange={(event) => setComposer(event.target.value)}
            />
            <ChatEmotePicker
              catalog={catalog}
              loading={emoteLoading}
              error={emoteState.error}
              disabled={twitch.phase !== "connected"}
              onSelect={addEmote}
              onClose={() =>
                composerRef.current?.focus({ preventScroll: true })
              }
              onReload={reloadEmotes}
              onOpen={() => {
                if (!emoteLoading && Date.now() - emoteState.loadedAt > 300_000)
                  reloadEmotes()
              }}
              onReconnect={() => onNavigate("settings")}
            />
            <button
              type="submit"
              aria-label="Отправить сообщение"
              disabled={!composer.trim() || twitch.phase !== "connected"}
            >
              <Send aria-hidden="true" />
            </button>
          </form>
        )}
      </div>

      {selectedViewer && (
        <div
          className="chat-profile-layer"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeProfile()
          }}
        >
          <aside
            className="chat-profile"
            role="dialog"
            aria-modal="true"
            aria-label="Профиль зрителя"
          >
            <header className="chat-profile-header">
              <span>Профиль</span>
              <button
                ref={profileCloseRef}
                type="button"
                className="chat-profile-back"
                aria-label="Закрыть профиль"
                onClick={closeProfile}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            {loadingProfile || !profile ? (
              <div className="chat-profile-loading">Загрузка…</div>
            ) : (
              <div className="chat-profile-scroll">
                <div className="chat-profile-identity">
                  <ViewerAvatar
                    name={profile.viewerName}
                    url={avatars[profile.viewerId]}
                  />
                  <div>
                    <h2
                      style={
                        profile.nameColor
                          ? { color: profile.nameColor }
                          : undefined
                      }
                    >
                      {profile.viewerName}
                    </h2>
                    <span>@{profile.viewerLogin}</span>
                  </div>
                </div>
                <div className="chat-profile-facts">
                  <span>
                    {profile.messageCount.toLocaleString("ru")} сообщений
                  </span>
                  {profile.firstSeen && (
                    <span>С {dateFormat.format(profile.firstSeen)}</span>
                  )}
                </div>
                {profile.roles.length > 0 && profile.roles[0] !== "viewer" && (
                  <div className="chat-profile-roles">
                    {profile.roles.map((role) => (
                      <span key={role}>{role}</span>
                    ))}
                  </div>
                )}
                {/^[A-Za-z0-9_]{1,50}$/.test(profile.viewerLogin) && (
                  <a
                    className="chat-profile-link"
                    href={`https://www.twitch.tv/${profile.viewerLogin}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть Twitch <ExternalLink aria-hidden="true" />
                  </a>
                )}
                <div
                  className="chat-profile-tabs"
                  role="tablist"
                  aria-label="Профиль зрителя"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={profileTab === "messages"}
                    data-active={profileTab === "messages" || undefined}
                    onClick={() => setProfileTab("messages")}
                  >
                    Сообщения
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={profileTab === "notes"}
                    data-active={profileTab === "notes" || undefined}
                    onClick={() => setProfileTab("notes")}
                  >
                    Заметки
                    {profile.notes.length ? ` ${profile.notes.length}` : ""}
                  </button>
                </div>
                {profileTab === "notes" && (
                  <section className="chat-profile-section">
                    <div className="chat-profile-note-form">
                      <textarea
                        value={noteText}
                        maxLength={2000}
                        placeholder="Что стоит запомнить о зрителе?"
                        aria-label="Новая заметка"
                        onChange={(event) => setNoteText(event.target.value)}
                      />
                      <button
                        type="button"
                        disabled={!noteText.trim() || savingNote}
                        onClick={() => void saveNote()}
                      >
                        <Plus aria-hidden="true" /> Добавить
                      </button>
                    </div>
                    {profile.notes.length > 0 && (
                      <div className="chat-profile-notes">
                        {profile.notes.map((note) => (
                          <article key={note.id}>
                            <p>{note.text}</p>
                            <span>{dateTimeFormat.format(note.createdAt)}</span>
                            <button
                              type="button"
                              aria-label="Удалить заметку"
                              onClick={() => void deleteNote(note.id)}
                            >
                              <Trash2 aria-hidden="true" />
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                )}
                {profileTab === "messages" && (
                  <section className="chat-profile-section">
                    {profile.messages.length === 0 ? (
                      <p className="chat-profile-muted">Сообщений пока нет.</p>
                    ) : (
                      <div className="chat-profile-history">
                        {profile.messages.map((message) => (
                          <article key={message.id}>
                            <time
                              dateTime={new Date(message.sentAt).toISOString()}
                            >
                              {dateTimeFormat.format(message.sentAt)}
                            </time>
                            <p>
                              <span
                                className={
                                  message.deleted
                                    ? "chat-profile-deleted-text"
                                    : undefined
                                }
                              >
                                <ChatMessageBody
                                  text={message.text}
                                  emotes={message.emotes}
                                  lookup={lookup}
                                />
                              </span>
                              {message.deleted && (
                                <span className="chat-home-deleted-label">
                                  Удалено
                                </span>
                              )}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                    {profile.messageCount > profile.messages.length && (
                      <button
                        className="chat-profile-more"
                        type="button"
                        onClick={() => void loadOlderProfile()}
                      >
                        Показать ещё
                      </button>
                    )}
                  </section>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  )
}
