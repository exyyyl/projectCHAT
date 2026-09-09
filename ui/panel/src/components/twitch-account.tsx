import { useState } from "react"
import { UserRound } from "lucide-react"

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
    <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#a970ff]/14 text-[#c9a9ff]">
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
      : "Twitch"
  const status = connected
    ? state.phase === "reconnecting"
      ? "Подключаемся…"
      : "Чат подключён"
    : authorizing
      ? "Ожидаем подтверждение"
      : "Не подключён"

  return (
    <Button
      variant="ghost"
      className={`h-11 w-full min-w-0 justify-start gap-2.5 rounded-lg px-2 ${
        active
          ? "bg-surface-raised text-foreground hover:bg-surface-raised"
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
          <span className="size-8 shrink-0 animate-pulse rounded-full bg-[#a970ff]/16" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-2.5 w-18 animate-pulse rounded-full bg-white/10" />
            <span className="block h-2 w-12 animate-pulse rounded-full bg-white/6" />
          </span>
        </>
      ) : (
        <>
          <span className="relative">
            <TwitchAvatar state={state} />
            {connected && (
              <span
                className={`absolute right-0 bottom-0 size-1.5 rounded-full ring-2 ring-[#111419] ${state.phase === "connected" ? "bg-brand" : "bg-amber-300"}`}
              />
            )}
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-sm text-foreground">
              {accountLabel}
            </span>
            <span className="block truncate text-[10px] font-normal text-muted-foreground">
              {status}
            </span>
          </span>
        </>
      )}
    </Button>
  )
}
