import { memo, useMemo, useRef, useState } from "react"
import { EmoteLoadingSkeleton } from "@/components/loading-skeletons"
import { Popover } from "radix-ui"
import { RefreshCw, Search, Smile, X } from "lucide-react"
import { messageParts } from "@/domain/chat-emotes"
import type {
  ChatEmote,
  ChatEmoteCatalog,
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

function EmoteImage({ text, url }: { text: string; url: string }) {
  const [failed, setFailed] = useState("")
  return failed === url ? (
    <>{text}</>
  ) : (
    <img
      className="chat-emote"
      src={url}
      alt={text}
      title={text}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(url)}
    />
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
        ) : (
          part.text
        )
      )}
    </>
  )
})

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
  const [visible, setVisible] = useState(80)
  const restoreComposer = useRef(false)
  const emotes = useMemo(() => {
    const search = query.trim().toLowerCase()
    return (catalog?.emotes || []).filter(
      (emote) =>
        (filter === "all" || emote.provider === filter) &&
        (!search || emote.code.toLowerCase().includes(search))
    )
  }, [catalog, filter, query])
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
          restoreComposer.current = false
          onOpen()
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          className="chat-emote-trigger"
          type="button"
          aria-label="Выбрать смайлик"
          title="Смайлики"
          disabled={disabled}
        >
          <Smile aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="chat-emote-picker"
          side="top"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          aria-label="Смайлики"
          onEscapeKeyDown={() => {
            restoreComposer.current = true
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (restoreComposer.current) onClose()
          }}
        >
          <div className="chat-emote-search">
            <Search aria-hidden="true" />
            <input
              aria-label="Найти смайлик"
              placeholder="Найти смайлик…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setVisible(80)
              }}
            />
            <Popover.Close asChild>
              <button
                type="button"
                aria-label="Закрыть смайлики"
                onClick={() => {
                  restoreComposer.current = true
                }}
              >
                <X aria-hidden="true" />
              </button>
            </Popover.Close>
          </div>
          <div className="chat-emote-filters" aria-label="Источник смайликов">
            {filters.map((provider) => (
              <button
                key={provider}
                type="button"
                aria-pressed={filter === provider}
                onClick={() => {
                  setFilter(provider)
                  setVisible(80)
                }}
              >
                {provider === "all" ? "Все" : providerNames[provider]}
              </button>
            ))}
          </div>
          <div className="chat-emote-results" key={`${filter}:${query}`}>
            {loading && !catalog ? (
              <EmoteLoadingSkeleton />
            ) : emotes.length ? (
              <>
                <div className="chat-emote-grid">
                  {emotes.slice(0, visible).map((emote) => (
                    <button
                      type="button"
                      key={`${emote.provider}:${emote.code}`}
                      title={`${emote.code} · ${providerNames[emote.provider]}`}
                      aria-label={`${emote.code} (${providerNames[emote.provider]})`}
                      onClick={(event) => {
                        restoreComposer.current = !event.shiftKey
                        onSelect(emote.code, event.shiftKey)
                        if (!event.shiftKey) setOpen(false)
                      }}
                    >
                      <EmoteImage text={emote.code} url={emote.url} />
                    </button>
                  ))}
                </div>
                {emotes.length > visible && (
                  <button
                    className="chat-emote-more"
                    type="button"
                    onClick={() => setVisible((count) => count + 80)}
                  >
                    Показать ещё
                  </button>
                )}
              </>
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
          <p className="chat-emote-hint">Shift + клик — добавить несколько</p>
          {(error || Boolean(catalog?.unavailable.length)) && (
            <div className="chat-emote-notice">
              <span>
                {error
                  ? "Нет связи с каталогом"
                  : `Недоступно: ${catalog!.unavailable.map((provider) => providerNames[provider]).join(", ")}`}
              </span>
              <button
                type="button"
                disabled={loading}
                onClick={onReload}
                aria-label="Обновить смайлики"
              >
                <RefreshCw aria-hidden="true" />
              </button>
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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
