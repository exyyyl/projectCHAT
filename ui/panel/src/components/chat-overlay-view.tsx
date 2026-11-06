import {
  useLayoutEffect,
  useEffectEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import type { CSSProperties } from "react"
import { gsap } from "gsap"
import {
  chatOverlayStyle,
  chatOverlayMotion,
  visibleChatMessages,
} from "../../../../public/chat-overlay-model.js"
import type { ChatOverlaySettings } from "../../../../public/chat-overlay-model.js"
import { emoteLookup } from "@/domain/chat-emotes"
import type { ChatEmote } from "@/domain/chat-emotes"
import type { ChatBadgeAsset, ChatMessage } from "@/domain/chat"
import { ChatMessageBody } from "@/components/chat-emotes"
import "./chat-overlay.css"

type Entry = { message: ChatMessage; leaving: boolean }
const clockFormat = new Intl.DateTimeFormat("ru", {
  hour: "2-digit",
  minute: "2-digit",
})
const subscribeMotion = (notify: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", notify)
  return () => query.removeEventListener("change", notify)
}
const motionSnapshot = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

function ChatOverlayRow({
  entry,
  settings,
  badges,
  lookup,
  reduced,
  onExited,
}: {
  entry: Entry
  settings: ChatOverlaySettings
  badges: Record<string, ChatBadgeAsset>
  lookup: Map<string, ChatEmote>
  reduced: boolean
  onExited: (id: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { message, leaving } = entry
  const animate = useEffectEvent((node: HTMLDivElement) => {
    const motion = chatOverlayMotion(settings, reduced)
    return gsap.context(() => {
      if (leaving)
        gsap.to(node, {
          autoAlpha: 0,
          ...motion.exit,
          transformOrigin: motion.origin,
          duration: motion.duration * 0.7,
          ease: "power2.in",
          onComplete: () => onExited(message.id),
        })
      else
        gsap.fromTo(
          node,
          { autoAlpha: 0, ...motion.enter, transformOrigin: motion.origin },
          {
            autoAlpha: 1,
            ...motion.settled,
            duration: motion.duration,
            ease: motion.ease,
          }
        )
    }, node)
  })
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const context = animate(node)
    return () => context.revert()
  }, [leaving, message.id, reduced])

  return (
    <div className="cue-chat-message" ref={ref}>
      <div
        className="cue-chat-author"
        style={{
          color:
            settings.useTwitchColors && message.nameColor
              ? message.nameColor
              : settings.nameColor,
        }}
      >
        {settings.showBadges &&
          (message.badges || []).map((badge) => {
            const asset = badges[`${badge.setId}/${badge.id}`]
            return asset ? (
              <img
                key={`${badge.setId}/${badge.id}`}
                className="cue-chat-badge"
                src={asset.url}
                alt={asset.title}
                referrerPolicy="no-referrer"
              />
            ) : null
          })}
        <strong>{message.viewerName}</strong>
        {settings.showTime && (
          <time dateTime={new Date(message.sentAt).toISOString()}>
            {clockFormat.format(message.sentAt)}
          </time>
        )}
      </div>
      <div className="cue-chat-body">
        <ChatMessageBody
          text={message.text}
          emotes={message.emotes}
          lookup={lookup}
        />
      </div>
    </div>
  )
}

export function ChatOverlayView({
  messages,
  settings,
  emotes = EMPTY_EMOTES,
  badges = EMPTY_BADGES,
  offset = 0,
  preview = false,
}: {
  messages: ChatMessage[]
  settings: ChatOverlaySettings
  emotes?: ChatEmote[]
  badges?: Record<string, ChatBadgeAsset>
  offset?: number
  preview?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const positions = useRef(new Map<number, number>())
  const reduced = useSyncExternalStore(
    subscribeMotion,
    motionSnapshot,
    () => true
  )
  const [clock, setClock] = useState(() => Date.now())
  const [presence, setPresence] = useState<{
    messages: ChatMessage[] | null
    settings: ChatOverlaySettings | null
    clock: number
    entries: Entry[]
  }>({ messages: null, settings: null, clock: 0, entries: [] })
  const lookup = useMemo(
    () => emoteLookup(emotes, settings.emoteProvider),
    [emotes, settings.emoteProvider]
  )
  if (
    presence.messages !== messages ||
    presence.settings !== settings ||
    presence.clock !== clock
  ) {
    const current =
      settings.enabled || preview
        ? visibleChatMessages(messages, settings, clock + offset)
        : []
    const ids = new Set(current.map((message) => message.id))
    const exiting = presence.entries
      .filter((entry) => !ids.has(entry.message.id))
      .map((entry) => ({ ...entry, leaving: true }))
    setPresence({
      messages,
      settings,
      clock,
      entries: [
        ...exiting,
        ...current.map((message) => ({ message, leaving: false })),
      ].slice(-60),
    })
  }
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])
  // The wrapper handles list movement; the inner message owns its entrance/exit.
  useLayoutEffect(() => {
    const nodes = [
      ...(root.current?.querySelectorAll<HTMLElement>("[data-chat-id]") || []),
    ]
    const next = new Map<number, number>()
    for (const node of nodes) {
      const id = Number(node.dataset.chatId),
        top = node.offsetTop
      const previous = positions.current.get(id)
      next.set(id, top)
      if (previous !== undefined && previous !== top) {
        const y = Number(gsap.getProperty(node, "y")) || 0
        gsap.killTweensOf(node)
        const delta = previous - top + y
        if (delta)
          gsap.fromTo(
            node,
            { y: delta },
            {
              y: 0,
              duration: reduced ? 0 : settings.animationDuration / 1000,
              ease: "power3.out",
            }
          )
      }
    }
    positions.current = next
  }, [
    presence.entries,
    reduced,
    settings.animation,
    settings.animationDuration,
  ])
  useLayoutEffect(() => {
    const node = root.current
    return () => {
      if (node) gsap.killTweensOf([...node.querySelectorAll("[data-chat-id]")])
    }
  }, [])
  const exited = useMemo(
    () => (id: number) =>
      setPresence((current) => ({
        ...current,
        entries: current.entries.filter((entry) => entry.message.id !== id),
      })),
    []
  )
  const style = chatOverlayStyle(settings) as CSSProperties

  return (
    <div
      className="cue-chat-overlay"
      data-style={settings.style}
      data-align={settings.alignment}
      style={style}
      ref={root}
      aria-label="Чат стрима"
    >
      {presence.entries.map((entry) => (
        <div
          className="cue-chat-slot"
          data-chat-id={entry.message.id}
          key={entry.message.id}
        >
          <ChatOverlayRow
            entry={entry}
            settings={settings}
            badges={badges}
            lookup={lookup}
            reduced={reduced}
            onExited={exited}
          />
        </div>
      ))}
    </div>
  )
}
const EMPTY_EMOTES: ChatEmote[] = []
const EMPTY_BADGES: Record<string, ChatBadgeAsset> = {}
