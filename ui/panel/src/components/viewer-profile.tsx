import { useId, useRef, useState } from "react"
import { Dialog, Tabs } from "radix-ui"
import { ExternalLink, X } from "lucide-react"
import type { ChatNote, ChatProfile } from "@/domain/chat"
import type { emoteLookup } from "@/domain/chat-emotes"
import { profileMessageDays, viewerRoleLabels } from "@/domain/chat-profile"
import { ChatMessageBody } from "./chat-emotes"
import { ProfileLoadingSkeleton } from "./loading-skeletons"
import { ViewerAvatar } from "./viewer-avatar"
import { ViewerNoteEditor } from "./viewer-note-editor"
import { Button } from "./ui/button"
import "./viewer-profile.css"

const dateFormat = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  year: "numeric",
})
const timeFormat = new Intl.DateTimeFormat("ru", {
  hour: "2-digit",
  minute: "2-digit",
})

export function ViewerProfile({
  profile,
  loading,
  channelId,
  avatarUrl,
  lookup,
  onClose,
  onReload,
  onLoadOlder,
  onNoteSaved,
  returnFocus,
}: {
  profile: ChatProfile | null
  loading: boolean
  channelId: string
  avatarUrl?: string
  lookup: ReturnType<typeof emoteLookup>
  onClose: () => void
  onReload: () => void
  onLoadOlder: () => Promise<void>
  onNoteSaved: (note: ChatNote | null) => void
  returnFocus: HTMLElement | null
}) {
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [error, setError] = useState("")
  const closeButton = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const more = async () => {
    if (loadingOlder) return
    setLoadingOlder(true)
    setError("")
    try {
      await onLoadOlder()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось загрузить сообщения."
      )
    } finally {
      setLoadingOlder(false)
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="viewer-profile-backdrop">
          <Dialog.Content
            className="viewer-profile"
            aria-labelledby={titleId}
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              closeButton.current?.focus({ preventScroll: true })
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              if (returnFocus?.isConnected)
                returnFocus.focus({ preventScroll: true })
            }}
          >
            <div className="viewer-profile-top">
              <div className="viewer-profile-identity">
                {profile && !loading && (
                  <ViewerAvatar name={profile.viewerName} url={avatarUrl} />
                )}
                <div>
                  <Dialog.Title
                    id={titleId}
                    className={
                      profile && !loading ? "viewer-profile-name" : "sr-only"
                    }
                  >
                    {profile && !loading
                      ? profile.viewerName
                      : "Профиль зрителя"}
                  </Dialog.Title>
                  {profile && !loading && (
                    <>
                      <span className="viewer-profile-login">
                        @{profile.viewerLogin}
                      </span>
                      <div className="viewer-profile-roles">
                        {viewerRoleLabels(profile.roles).map((role) => (
                          <span key={role}>{role}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="viewer-profile-actions">
                {profile &&
                  !loading &&
                  /^[A-Za-z0-9_]{1,50}$/.test(profile.viewerLogin) && (
                    <Button asChild variant="ghost" size="icon-sm">
                      <a
                        href={`https://www.twitch.tv/${profile.viewerLogin}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Открыть профиль на Twitch"
                      >
                        <ExternalLink />
                      </a>
                    </Button>
                  )}
                <Dialog.Close asChild>
                  <Button
                    ref={closeButton}
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Закрыть профиль"
                  >
                    <X />
                  </Button>
                </Dialog.Close>
              </div>
            </div>
            {loading ? (
              <div className="viewer-profile-state">
                <ProfileLoadingSkeleton />
              </div>
            ) : !profile ? (
              <div className="viewer-profile-state" role="status">
                <p>Не удалось загрузить профиль</p>
                <Button variant="secondary" onClick={onReload}>
                  Повторить
                </Button>
              </div>
            ) : (
              <>
                <dl className="viewer-profile-facts">
                  <div>
                    <dt>Сообщения</dt>
                    <dd>{profile.messageCount.toLocaleString("ru")}</dd>
                  </div>
                  {profile.firstSeen && (
                    <div>
                      <dt>В архиве с</dt>
                      <dd>{dateFormat.format(profile.firstSeen)}</dd>
                    </div>
                  )}
                </dl>
                <Tabs.Root
                  defaultValue="messages"
                  className="viewer-profile-tabs"
                >
                  <Tabs.List
                    className="viewer-profile-tablist"
                    aria-label="Профиль зрителя"
                  >
                    <Tabs.Trigger value="messages">Сообщения</Tabs.Trigger>
                    <Tabs.Trigger value="notes">Заметка</Tabs.Trigger>
                  </Tabs.List>
                  <Tabs.Content
                    value="messages"
                    className="viewer-profile-content"
                  >
                    {!profile.messages.length ? (
                      <p className="viewer-profile-empty">Сообщений пока нет</p>
                    ) : (
                      <div className="viewer-profile-history">
                        {profileMessageDays(profile.messages).map((group) => (
                          <section
                            key={group.day}
                            className="viewer-profile-day"
                          >
                            <h3>{dateFormat.format(group.day)}</h3>
                            {group.messages.map((message) => (
                              <article key={message.id}>
                                <time
                                  dateTime={new Date(
                                    message.sentAt
                                  ).toISOString()}
                                >
                                  {timeFormat.format(message.sentAt)}
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
                          </section>
                        ))}
                      </div>
                    )}
                    {error && (
                      <p className="viewer-profile-error" role="alert">
                        {error}
                      </p>
                    )}
                    {profile.messageCount > profile.messages.length && (
                      <Button
                        className="viewer-profile-more"
                        variant="ghost"
                        size="sm"
                        disabled={loadingOlder}
                        onClick={() => void more()}
                      >
                        {loadingOlder ? "Загрузка…" : "Показать ещё"}
                      </Button>
                    )}
                  </Tabs.Content>
                  <Tabs.Content
                    value="notes"
                    className="viewer-profile-content"
                  >
                    <ViewerNoteEditor
                      key={`${channelId}:${profile.viewerId}`}
                      channelId={channelId}
                      viewerId={profile.viewerId}
                      note={profile.notes[0]}
                      onSaved={onNoteSaved}
                    />
                  </Tabs.Content>
                </Tabs.Root>
              </>
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
