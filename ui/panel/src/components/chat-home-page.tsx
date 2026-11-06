import type { StudioActivityControls } from "./studio-activity"
import { useChatFeed } from "@/hooks/use-chat-feed"
import { ChatDeliveryError, ChatSendingIndicator } from "./chat-delivery-error"
import { ChatParticipants } from "./chat-participants"
import { DashboardBlocksMenu } from "./dashboard-blocks-menu"
import { useDashboardBlocks } from "@/hooks/use-dashboard-blocks"
import { ModeratedMessage } from "./chat-moderation"
import { Button } from "@/components/ui/button"
import { normalizeChatText } from "../../../../public/chat-text.js"
import { ViewerProfile } from "./viewer-profile"
import { ViewerAvatar } from "./viewer-avatar"
import {
  failedChatMessage,
  discardFailedChatMessage,
  mergeChatFeed,
  outgoingChatMessage,
  type FeedMessage,
} from "@/domain/chat-delivery"
import type { ModerationAction } from "@/domain/chat-moderation"
import { useToast } from "./ui/toast"
import { ChatLoadingSkeleton } from "@/components/loading-skeletons"
import {
  ArrowDown,
  Gift,
  Megaphone,
  MessageCircle,
  Radio,
  ArrowUp,
  Sparkles,
  WifiOff,
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
  ChatArchiveCleanup,
  ChatArchiveRetention,
  ChatBadge,
  ChatBadgeAsset,
  ChatMessage,
  ChatProfile,
  RecentChat,
} from "@/domain/chat"
import { retainChatMessages } from "@/domain/chat"
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
  activityControls,
}: {
  activityControls?: StudioActivityControls
  emoteProvider?: ChatEmoteProvider
  twitch: TwitchState
  poll: Poll | null
  contest: Contest | null
  onNavigate: (view: AppView) => void
}) {
  const [
    dashboardBlocks,
    setDashboardBlocks,
    showParticipants,
    setShowParticipants,
  ] = useDashboardBlocks()
  const showToast = useToast()
  const channelId = twitch.userId
  const [messages, setMessages, outboxStorageError] = useChatFeed(
    channelId || "offline"
  )
  useEffect(() => {
    if (outboxStorageError)
      showToast({
        message: "Не удалось сохранить неотправленные сообщения на диске",
        description:
          "Они останутся в текущем сеансе. Не закрывайте Cue до повторной отправки.",
        tone: "warning",
      })
  }, [outboxStorageError, showToast])
  const [summary, setSummary] = useState<RecentChat["archive"] | null>(null)
  const [archiveRevision, setArchiveRevision] = useState(0)
  const archiveEpoch = useRef(0)
  const retention = useRef<ChatArchiveRetention>({
    allThrough: 0,
    deletedThrough: 0,
  })
  const [selectedViewer, setSelectedViewer] = useState<string | null>(null)
  const [profile, setProfile] = useState<ChatProfile | null>(null)
  const [loading, setLoading] = useState(Boolean(channelId))
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
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
  const composerRef = useRef<HTMLTextAreaElement>(null)
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
  const [profileReturnFocus, setProfileReturnFocus] =
    useState<HTMLElement | null>(null)
  const selectedViewerRef = useRef<string | null>(null)
  const nearBottom = useRef(true)
  const scrollRestore = useRef<number | null>(null)

  const applyArchiveCleanup = useCallback(
    (change: ChatArchiveCleanup) => {
      if (change.channelId !== channelId) return
      archiveEpoch.current++
      const key = change.scope === "all" ? "allThrough" : "deletedThrough"
      retention.current[key] = Math.max(
        retention.current[key],
        change.throughId
      )
      setMessages((current) => retainChatMessages(current, retention.current))
      setProfile((current) =>
        current
          ? {
              ...current,
              messages: retainChatMessages(current.messages, retention.current),
            }
          : current
      )
      setSummary(change.archive)
      setUnseen(0)
      if (selectedViewerRef.current) setLoadingProfile(true)
      setArchiveRevision((revision) => revision + 1)
    },
    [channelId, setMessages]
  )

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
    const epoch = archiveEpoch.current
    try {
      const data = await getJson<RecentChat>("/api/chat/recent")
      if (data.channelId !== channelId || archiveEpoch.current !== epoch) return
      setSummary(data.archive)
      setMessages((current) =>
        mergeChatFeed(
          current.filter(
            (item) =>
              item.id <= 0 ||
              data.messages.some((message) => message.id === item.id)
          ),
          data.messages
        )
      )
      setArchiveRevision((revision) => revision + 1)
      setError("")
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось загрузить чат."
      )
    } finally {
      setLoading(false)
    }
  }, [channelId, setMessages])

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
    events.addEventListener("cleanup", (event) => {
      applyArchiveCleanup(
        JSON.parse((event as MessageEvent).data) as ChatArchiveCleanup
      )
    })
    events.onopen = () => void loadRecent()
    return () => events.close()
  }, [channelId, loadRecent, applyArchiveCleanup, setMessages])

  const selectViewer = (viewerId: string) => {
    if (selectedViewerRef.current === viewerId) return
    selectedViewerRef.current = viewerId
    setSelectedViewer(viewerId)
    setProfile(null)
    setLoadingProfile(true)
    setProfileReturnFocus(
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    )
  }

  const closeProfile = () => {
    selectedViewerRef.current = null
    setSelectedViewer(null)
  }

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
    const epoch = archiveEpoch.current
    try {
      const data = await getJson<RecentChat>(
        `/api/chat/recent?before=${first.id}`
      )
      if (archiveEpoch.current !== epoch || data.channelId !== channelId) return
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
  }, [channelId, selectedViewer, archiveRevision])

  const loadOlderProfile = async () => {
    if (!profile?.messages.length || !selectedViewer) return
    const epoch = archiveEpoch.current
    const data = await getJson<ChatProfile>(
      `/api/chat/profile?viewerId=${encodeURIComponent(selectedViewer)}&before=${profile.messages.at(-1)!.id}`
    )
    if (archiveEpoch.current !== epoch) return
    setProfile((current) =>
      current?.viewerId === selectedViewer
        ? { ...current, messages: [...current.messages, ...data.messages] }
        : current
    )
  }

  const moderate = async (
    action: ModerationAction,
    message: ChatMessage,
    duration?: number
  ) => {
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
          duration,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok)
        throw new Error(data.error || "Не удалось выполнить действие.")
      showToast({
        message:
          action === "delete"
            ? "Сообщение удалено"
            : action === "ban"
              ? `${message.viewerName}: бан навсегда`
              : `${message.viewerName}: мут на ${duration! < 3600 ? `${duration! / 60} мин` : duration! < 86400 ? `${duration! / 3600} ч` : `${duration! / 86400} дн`}`,
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
          retainChatMessages(
            mergeChatFeed(current, [data.message!], { confirmedKey: key }),
            retention.current
          )
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
    const text = normalizeChatText(composer)
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
        blocksAction={(arrange) => (
          <DashboardBlocksMenu
            order={dashboardBlocks}
            onChange={setDashboardBlocks}
            participants={showParticipants}
            onParticipantsChange={setShowParticipants}
            onArrange={arrange}
          />
        )}
        activityControls={activityControls}
        order={dashboardBlocks}
        onOrderChange={setDashboardBlocks}
        poll={poll}
        contest={contest}
        summary={summary}
        channelId={channelId || ""}
        onArchiveCleanup={applyArchiveCleanup}
        onNavigate={onNavigate}
      />
      <div className="chat-home-main">
        <StreamOverview key={channelId || "offline"} channelId={channelId} />
        {showParticipants && channelId && (
          <ChatParticipants
            key={channelId}
            channelId={channelId}
            avatars={avatars}
            onSelectViewer={selectViewer}
          />
        )}
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
              {loading && messages.length === 0 ? (
                <ChatLoadingSkeleton />
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
                      canDelete={twitch.phase === "connected" && message.id > 0}
                      canTimeout={
                        twitch.phase === "connected" &&
                        message.id > 0 &&
                        Boolean(twitch.canTimeout)
                      }
                      isSelf={message.viewerId === `twitch:${channelId}`}
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
                          <ChatSendingIndicator />
                        )}
                        {message.delivery === "failed" && (
                          <ChatDeliveryError
                            error={message.deliveryError}
                            disabled={twitch.phase !== "connected"}
                            onRetry={() => retryMessage(message)}
                            onDiscard={() => {
                              if (!message.localKey) return
                              setMessages((current) =>
                                discardFailedChatMessage(
                                  current,
                                  message.localKey!
                                )
                              )
                              composerRef.current?.focus({
                                preventScroll: true,
                              })
                            }}
                          />
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
            <textarea
              ref={composerRef}
              rows={1}
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
              onKeyDown={(event) => {
                if (
                  event.key !== "Enter" ||
                  event.shiftKey ||
                  event.nativeEvent.isComposing ||
                  event.keyCode === 229
                )
                  return
                event.preventDefault()
                if (!event.repeat) event.currentTarget.form?.requestSubmit()
              }}
            />
            {composer.length >= 400 && (
              <span
                className="chat-home-counter"
                data-limit={composer.length >= 500 || undefined}
                aria-live="polite"
              >
                {500 - composer.length}
              </span>
            )}
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
            <Button
              size="icon"
              type="submit"
              className="chat-home-send"
              aria-label="Отправить сообщение"
              disabled={!composer.trim() || twitch.phase !== "connected"}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
          </form>
        )}
      </div>

      {selectedViewer && (
        <ViewerProfile
          key={selectedViewer}
          profile={profile}
          loading={loadingProfile}
          channelId={channelId || ""}
          avatarUrl={
            selectedViewer === `twitch:${channelId}`
              ? twitch.profileImageUrl || avatars[selectedViewer]
              : avatars[selectedViewer]
          }
          lookup={lookup}
          returnFocus={profileReturnFocus}
          onClose={closeProfile}
          onReload={() => {
            setLoadingProfile(true)
            setArchiveRevision((revision) => revision + 1)
          }}
          onLoadOlder={loadOlderProfile}
          onNoteSaved={(note) =>
            setProfile((current) =>
              current?.viewerId === selectedViewer
                ? { ...current, notes: note ? [note] : [] }
                : current
            )
          }
        />
      )}
    </section>
  )
}
