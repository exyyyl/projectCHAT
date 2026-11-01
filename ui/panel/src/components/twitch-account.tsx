import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Settings2, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { TwitchState } from "@/domain/polls"

type TwitchAccountProps = {
  state: TwitchState
  active: boolean
  onClick: () => void
}

function TwitchAvatar({ state }: { state: TwitchState }) {
  const [failedUrl, setFailedUrl] = useState("")
  const imageVisible =
    !!state.profileImageUrl && failedUrl !== state.profileImageUrl

  return (
    <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-raised text-muted-foreground">
      <UserRound className="size-4" />
      {imageVisible && (
        <img
          src={state.profileImageUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(state.profileImageUrl || "")}
        />
      )}
    </span>
  )
}

export function TwitchAccount({ state, active, onClick }: TwitchAccountProps) {
  const loading = state.phase === "loading"
  const connected =
    state.phase === "connected" || state.phase === "reconnecting"
  const authorizing = ["connecting", "authorizing"].includes(state.phase)
  const accountLabel = connected
    ? state.displayName || state.login || "Twitch"
    : authorizing
      ? "Вход в Twitch…"
      : "Подключить Twitch"
  const status = connected
    ? state.phase === "reconnecting"
      ? "Подключаемся…"
      : "Чат подключён"
    : authorizing
      ? "Ожидаем подтверждение"
      : "Не подключён"

  const reconnecting = state.phase === "reconnecting"
  return (
    <Button
      variant="ghost"
      className={`group h-11 w-full min-w-0 justify-start gap-2.5 rounded-md px-2.5 ${
        active
          ? "bg-surface-subtle text-foreground hover:bg-surface-raised"
          : "text-muted-foreground"
      }`}
      aria-current={active ? "page" : undefined}
      aria-label={
        loading
          ? "Настройки, профиль загружается"
          : `Настройки, ${accountLabel}, ${status}`
      }
      onClick={onClick}
    >
      {loading ? (
        <>
          <Skeleton className="size-7 shrink-0 rounded-lg" />
          <span className="min-w-0 flex-1">
            <Skeleton className="h-2.5 w-18" />
          </span>
        </>
      ) : (
        <>
          <TwitchAvatar state={state} />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium text-foreground">
              {accountLabel}
            </span>
            {reconnecting && (
              <span className="block truncate text-xs font-normal text-muted-foreground">
                Переподключение…
              </span>
            )}
          </span>
          <Settings2
            aria-hidden="true"
            className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground"
          />
        </>
      )}
    </Button>
  )
}
