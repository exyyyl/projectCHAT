import { memo, useEffect, useId, useMemo, useRef, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { EmoteLoadingSkeleton } from "@/components/loading-skeletons"
import { Popover } from "radix-ui"
import { PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  ChevronDown,
  Globe2,
  RefreshCw,
  Search,
  Smile,
  UserRound,
  X,
} from "lucide-react"
import { groupChatEmotes, messageParts } from "@/domain/chat-emotes"
import type {
  ChatEmote,
  ChatEmoteCatalog,
  ChatEmoteGroup,
  ChatEmoteProvider,
  ChatEmoteSpan,
} from "@/domain/chat-emotes"
import "@/components/chat-emotes.css"

const providerNames = {
  twitch: "Twitch",
  "7tv": "7TV",
  bttv: "BTTV",
  ffz: "FFZ",
}
const filters = ["all", "twitch", "7tv", "bttv", "ffz"] as const
const emoteBatchSize = 80

function EmoteImage({
  text,
  url,
  placeholder = false,
}: {
  text: string
  url: string
  placeholder?: boolean
}) {
  const [failed, setFailed] = useState("")
  const [loaded, setLoaded] = useState("")
  if (failed === url) return <>{text}</>
  const image = (
    <img
      className="chat-emote"
      src={url}
      alt={text}
      title={text}
      loading={placeholder ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={placeholder ? () => setLoaded(url) : undefined}
      onError={() => setFailed(url)}
      ref={(node) => {
        if (placeholder && node?.complete && node.naturalWidth > 0)
          setLoaded((current) => (current === url ? current : url))
      }}
      style={placeholder && loaded !== url ? { opacity: 0 } : undefined}
    />
  )
  return placeholder ? (
    <span className="chat-emote-asset" aria-busy={loaded !== url}>
      {loaded !== url && <Skeleton className="chat-emote-loading" />}
      {image}
    </span>
  ) : (
    image
  )
}

export const ChatMessageBody = memo(function ChatMessageBody({
  text,
  emotes,
  lookup,
}: {
  text: string
  emotes?: ChatEmoteSpan[]
  lookup: Map<string, ChatEmote>
}) {
  return (
    <>
      {messageParts(text, emotes, lookup).map((part, index) =>
        part.url ? (
          <EmoteImage
            key={`${index}:${part.url}`}
            text={part.text}
            url={part.url}
          />
        ) : part.href ? (
          <a
            key={`${index}:${part.href}`}
            className="chat-message-link"
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {part.text}
          </a>
        ) : (
          part.text
        )
      )}
    </>
  )
})

function EmoteCategory({
  group,
  root,
  requested,
  collapsed,
  onToggle,
  register,
  onSelect,
}: {
  group: ChatEmoteGroup
  root: HTMLDivElement | null
  requested: boolean
  collapsed: boolean
  onToggle: () => void
  register: (id: string, node: HTMLElement | null) => void
  onSelect: (code: string, keepOpen: boolean) => void
}) {
  const [visible, setVisible] = useState(emoteBatchSize)
  const [rendered, setRendered] = useState(false)
  const section = useRef<HTMLElement>(null)
  const more = useRef<HTMLDivElement>(null)
  const bodyId = useId()
  useEffect(() => {
    if (!root || !section.current || collapsed || rendered) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRendered(true)
          observer.disconnect()
        }
      },
      { root, rootMargin: "100px 0px" }
    )
    observer.observe(section.current)
    return () => observer.disconnect()
  }, [root, collapsed, rendered])
  useEffect(() => {
    if (
      !root ||
      !more.current ||
      collapsed ||
      !(rendered || requested) ||
      visible >= group.emotes.length
    )
      return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          setVisible((count) =>
            Math.min(count + emoteBatchSize, group.emotes.length)
          )
      },
      { root, rootMargin: "100px 0px" }
    )
    observer.observe(more.current)
    return () => observer.disconnect()
  }, [root, collapsed, rendered, requested, visible, group.emotes.length])
  const shouldRender = rendered || requested
  const count = Math.min(emoteBatchSize, group.emotes.length)
  return (
    <section
      className="chat-emote-section"
      aria-label={group.label}
      ref={(node) => {
        section.current = node
        register(group.id, node)
      }}
    >
      <h3>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span>{group.label}</span>
          <small>{group.emotes.length}</small>
          <ChevronDown aria-hidden="true" />
        </button>
      </h3>
      <div id={bodyId} hidden={collapsed}>
        {shouldRender ? (
          <>
            <div className="chat-emote-grid">
              {group.emotes.slice(0, visible).map((emote) => (
                <button
                  type="button"
                  key={`${emote.provider}:${emote.code}`}
                  title={`${emote.code} · ${providerNames[emote.provider]}`}
                  aria-label={`${emote.code} (${providerNames[emote.provider]})`}
                  onClick={(event) => onSelect(emote.code, event.shiftKey)}
                >
                  <EmoteImage text={emote.code} url={emote.url} placeholder />
                </button>
              ))}
            </div>
            {visible < group.emotes.length && (
              <div
                ref={more}
                className="chat-emote-sentinel"
                aria-hidden="true"
              />
            )}
          </>
        ) : (
          <div
            className="chat-emote-grid chat-emote-placeholder"
            aria-hidden="true"
          >
            {Array.from({ length: count }, (_, index) => (
              <span className="chat-emote-placeholder-cell" key={index}>
                <Skeleton className="chat-emote-loading" />
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function EmoteChannelIcon({ group }: { group: ChatEmoteGroup }) {
  const [failed, setFailed] = useState("")
  if (group.id.startsWith("global:")) return <Globe2 aria-hidden="true" />
  return group.avatarUrl && failed !== group.avatarUrl ? (
    <img
      src={group.avatarUrl}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(group.avatarUrl!)}
    />
  ) : (
    <UserRound aria-hidden="true" />
  )
}

export function ChatEmotePicker({
  catalog,
  loading,
  error,
  disabled,
  onSelect,
  onReload,
  onOpen,
  onReconnect,
  onClose,
}: {
  catalog: ChatEmoteCatalog | null
  loading: boolean
  error: boolean
  disabled: boolean
  onSelect: (code: string, keepOpen: boolean) => void
  onClose: () => void
  onReload: () => void
  onOpen: () => void
  onReconnect: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | ChatEmoteProvider>("all")
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [activeGroup, setActiveGroup] = useState("")
  const [requestedGroups, setRequestedGroups] = useState<Set<string>>(
    () => new Set()
  )
  const sections = useRef(new Map<string, HTMLElement>())
  const restoreComposer = useRef(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const emotes = useMemo(() => {
    const search = query.trim().toLowerCase()
    return (catalog?.emotes || []).filter(
      (emote) =>
        (filter === "all" || emote.provider === filter) &&
        (!search || emote.code.toLowerCase().includes(search))
    )
  }, [catalog, filter, query])
  const groups = useMemo(
    () => groupChatEmotes(emotes, catalog?.channelId),
    [emotes, catalog?.channelId]
  )
  const firstGlobal = groups.find((group) => group.id.startsWith("global:"))?.id
  const navGroups = groups.filter(
    (group) => !group.id.startsWith("global:") || group.id === firstGlobal
  )
  const register = (id: string, node: HTMLElement | null) => {
    if (node) sections.current.set(id, node)
    else sections.current.delete(id)
  }
  const selectEmote = (code: string, keepOpen: boolean) => {
    restoreComposer.current = !keepOpen
    onSelect(code, keepOpen)
    if (!keepOpen) setOpen(false)
  }
  const jumpTo = (id: string) => {
    setRequestedGroups((current) => new Set(current).add(id))
    setCollapsed((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
    setActiveGroup(id)
    requestAnimationFrame(() =>
      sections.current.get(id)?.scrollIntoView({ block: "start" })
    )
  }
  const reconnect = () => {
    setOpen(false)
    onReconnect()
  }

  return (
    <Popover.Root
      open={open && !disabled}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) {
          setActiveGroup("")
          restoreComposer.current = false
          onOpen()
        }
      }}
    >
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="chat-emote-trigger"
          type="button"
          aria-label="Выбрать смайлик"
          disabled={disabled}
        >
          <Smile aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <PopoverContent
        className="chat-emote-picker"
        side="top"
        align="end"
        sideOffset={10}
        collisionPadding={12}
        aria-label="Смайлики"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchInput.current?.focus()
        }}
        onEscapeKeyDown={() => {
          restoreComposer.current = true
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (restoreComposer.current) onClose()
        }}
      >
        <header className="chat-emote-heading">
          <span>
            <Smile aria-hidden="true" />
            Смайлики
          </span>
          <Popover.Close asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label="Закрыть смайлики"
              onClick={() => {
                restoreComposer.current = true
              }}
            >
              <X aria-hidden="true" />
            </Button>
          </Popover.Close>
        </header>
        <div className="chat-emote-search">
          <Search aria-hidden="true" />
          <Input
            ref={searchInput}
            aria-label="Найти смайлик"
            placeholder="Найти смайлик…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveGroup("")
              setCollapsed(new Set())
            }}
          />
        </div>
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(next) => {
            const provider = filters.find((item) => item === next)
            if (provider) {
              setFilter(provider)
              setActiveGroup("")
              setCollapsed(new Set())
            }
          }}
          className="chat-emote-filters"
          aria-label="Источник смайликов"
          spacing={1}
        >
          {filters.map((provider) => (
            <ToggleGroupItem key={provider} value={provider} size="sm">
              {provider === "all" ? "Все" : providerNames[provider]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="chat-emote-browser">
          <div
            className="chat-emote-results"
            ref={setScrollRoot}
            key={`${catalog?.channelId}:${filter}:${query}`}
            onScroll={(event) => {
              const top = event.currentTarget.getBoundingClientRect().top
              let current = groups[0]?.id || ""
              for (const group of groups) {
                if (
                  (sections.current.get(group.id)?.getBoundingClientRect()
                    .top ?? Infinity) >
                  top + 8
                )
                  break
                current = group.id
              }
              setActiveGroup(current)
            }}
          >
            {loading && !catalog ? (
              <EmoteLoadingSkeleton />
            ) : groups.length ? (
              groups.map((group) => (
                <EmoteCategory
                  key={group.id}
                  group={group}
                  root={scrollRoot}
                  requested={requestedGroups.has(group.id)}
                  collapsed={collapsed.has(group.id)}
                  register={register}
                  onToggle={() =>
                    setCollapsed((current) => {
                      const next = new Set(current)
                      if (next.has(group.id)) next.delete(group.id)
                      else next.add(group.id)
                      return next
                    })
                  }
                  onSelect={selectEmote}
                />
              ))
            ) : (
              <p className="chat-emote-empty">
                {query
                  ? "Ничего не найдено"
                  : error
                    ? "Не удалось загрузить смайлики"
                    : "Нет доступных смайликов"}
              </p>
            )}
          </div>
          {navGroups.length > 1 && (
            <nav
              className="chat-emote-channels"
              aria-label="Категории смайликов"
            >
              {navGroups.map((group) => (
                <button
                  type="button"
                  key={group.id}
                  aria-label={`Перейти к ${group.id === firstGlobal ? "глобальным смайликам" : group.label}`}
                  title={
                    group.id === firstGlobal
                      ? "Глобальные смайлики"
                      : group.label
                  }
                  aria-current={
                    (activeGroup || groups[0]?.id) === group.id ||
                    (group.id === firstGlobal &&
                      activeGroup.startsWith("global:"))
                      ? "true"
                      : undefined
                  }
                  onClick={() => jumpTo(group.id)}
                >
                  <EmoteChannelIcon group={group} />
                </button>
              ))}
            </nav>
          )}
        </div>
        {(error || Boolean(catalog?.unavailable.length)) && (
          <div className="chat-emote-notice">
            <span>
              {error
                ? "Нет связи с каталогом"
                : `Недоступно: ${catalog!.unavailable.map((provider) => providerNames[provider]).join(", ")}`}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              disabled={loading}
              onClick={onReload}
              aria-label="Обновить смайлики"
            >
              <RefreshCw aria-hidden="true" />
            </Button>
          </div>
        )}
        {catalog?.requiresReconnect &&
          (filter === "all" || filter === "twitch") && (
            <button
              className="chat-emote-reconnect"
              type="button"
              onClick={reconnect}
            >
              Подключить личные смайлики Twitch{" "}
              <span>Переподключить аккаунт</span>
            </button>
          )}
      </PopoverContent>
    </Popover.Root>
  )
}
