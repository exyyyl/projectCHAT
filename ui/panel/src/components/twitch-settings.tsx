import { ExternalLink, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
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
      <div className="flex h-18 animate-pulse items-center gap-3 rounded-xl bg-surface-subtle px-4">
        <div className="size-10 rounded-full bg-white/[0.07]" />
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-white/[0.07]" />
          <div className="h-2.5 w-20 rounded bg-white/[0.045]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex min-h-18 items-center gap-3 rounded-xl bg-surface-subtle px-4 py-3">
        <TwitchAvatar state={state} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {connected
              ? state.displayName || state.login || "Twitch"
              : authorizing
                ? "Подключаем Twitch"
                : "Twitch не подключён"}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`size-1.5 rounded-full ${
                connected
                  ? "bg-brand"
                  : authorizing
                    ? "bg-[#a970ff]"
                    : "bg-muted-foreground/35"
              }`}
            />
            {connected
              ? state.phase === "reconnecting"
                ? "Переподключение"
                : "Чат подключён"
              : authorizing
                ? "Ожидаем подтверждение"
                : "Нет доступа к чату"}
          </div>
        </div>
        <Button
          variant={connected || authorizing ? "outline" : "default"}
          disabled={busy}
          onClick={() =>
            onCommand(connected || authorizing ? "disconnect" : "connect")
          }
        >
          {connected ? "Отключить" : authorizing ? "Отменить" : "Подключить"}
        </Button>
      </div>

      {state.device && (
        <div className="flex items-center justify-between gap-4 rounded-xl bg-[#a970ff]/8 px-4 py-3">
          <span className="font-mono text-lg tracking-[.16em] text-[#c49cff]">
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
  if (state.profileImageUrl)
    return (
      <img
        src={state.profileImageUrl}
        alt=""
        className="size-10 shrink-0 rounded-full object-cover"
      />
    )

  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#a970ff]/16 text-[#bc91ff]">
      <UserRound className="size-5" />
    </span>
  )
}
