import { useState } from "react"
import { ExternalLink, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ErrorNotice } from "@/components/error-notice"
import type { TwitchState } from "@/domain/polls"

type TwitchSettingsProps = {
  state: TwitchState
  busy: boolean
  onCommand: (type: "connect" | "disconnect") => void
}

export function TwitchSettings({
  state,
  busy,
  onCommand,
}: TwitchSettingsProps) {
  const connected =
    state.phase === "connected" || state.phase === "reconnecting"
  const authorizing = ["connecting", "authorizing"].includes(state.phase)
  const loading = state.phase === "loading"

  if (loading) {
    return (
      <div className="flex h-11 animate-pulse items-center gap-3">
        <div className="size-9 rounded-lg bg-surface-raised" />
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-surface-raised" />
          <div className="h-2.5 w-20 rounded bg-surface-subtle" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-3">
        <TwitchAvatar state={state} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {connected
              ? state.displayName || state.login || "Twitch"
              : authorizing
                ? "Подключаем Twitch"
                : "Twitch не подключён"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {connected
              ? state.phase === "reconnecting"
                ? "Переподключение"
                : "Twitch"
              : authorizing
                ? "Ожидаем подтверждение"
                : "Нет доступа к чату"}
          </div>
        </div>
        <Button
          variant={connected || authorizing ? "outline" : "default"}
          className={
            connected || authorizing ? "text-muted-foreground" : undefined
          }
          disabled={busy}
          onClick={() =>
            onCommand(connected || authorizing ? "disconnect" : "connect")
          }
        >
          {connected ? "Отключить" : authorizing ? "Отменить" : "Подключить"}
        </Button>
      </div>
      {state.error && <ErrorNotice error={state.error} context="twitch" />}

      {state.device && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-twitch/20 bg-twitch/8 px-4 py-3">
          <span className="font-mono text-lg tracking-[.16em] text-twitch">
            {state.device.code}
          </span>
          <Button asChild>
            <a href={state.device.url} target="_blank" rel="noreferrer">
              Подтвердить <ExternalLink />
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}

function TwitchAvatar({ state }: { state: TwitchState }) {
  const [failedUrl, setFailedUrl] = useState("")
  const imageVisible =
    !!state.profileImageUrl && failedUrl !== state.profileImageUrl

  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-subtle text-muted-foreground">
      <UserRound className="size-5" />
      {imageVisible && (
        <img
          src={state.profileImageUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailedUrl(state.profileImageUrl || "")}
        />
      )}
    </span>
  )
}
