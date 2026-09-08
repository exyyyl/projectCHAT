import { Check, ExternalLink, MessageCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { TwitchState } from "@/domain/polls"

type TwitchSettingsProps = {
  state: TwitchState
  clientId: string
  busy: boolean
  onClientIdChange: (value: string) => void
  onCommand: (type: "connect" | "disconnect") => void
}

export function TwitchSettings({
  state,
  clientId,
  busy,
  onClientIdChange,
  onCommand,
}: TwitchSettingsProps) {
  const connected =
    state.phase === "connected" || state.phase === "reconnecting"
  const authorizing = ["connecting", "authorizing"].includes(state.phase)

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <label
            className="text-xs text-muted-foreground"
            htmlFor="twitch-client-id"
          >
            Client ID
          </label>
          <Input
            id="twitch-client-id"
            value={clientId}
            disabled={connected || authorizing}
            onChange={(event) => onClientIdChange(event.target.value)}
            placeholder="Вставьте Client ID"
          />
        </div>
        {!connected && !authorizing ? (
          <Button
            className="h-8 sm:min-w-30"
            disabled={busy || !clientId.trim()}
            onClick={() => onCommand("connect")}
          >
            Войти
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-8 sm:min-w-30"
            disabled={busy}
            onClick={() => onCommand("disconnect")}
          >
            {connected ? "Отключить" : "Отменить"}
          </Button>
        )}
      </div>

      {state.device && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2.5">
          <span className="font-mono text-lg tracking-[.16em] text-brand">
            {state.device.code}
          </span>
          <Button asChild size="sm">
            <a href={state.device.url} target="_blank" rel="noreferrer">
              Подтвердить <ExternalLink />
            </a>
          </Button>
        </div>
      )}

      {connected && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="size-3.5 text-brand" />
          Чат подключён
          {state.login ? ` как ${state.displayName || state.login}` : ""}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-border-subtle pt-4">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <MessageCircle className="size-3.5 text-[#a970ff]" />
          Только чтение чата
        </span>
        <a
          className="flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          href="https://dev.twitch.tv/console/apps"
          target="_blank"
          rel="noreferrer"
        >
          Получить Client ID <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  )
}
