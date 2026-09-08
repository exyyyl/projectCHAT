import { useState } from "react"
import { ChevronDown, ExternalLink, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { TwitchState } from "@/domain/polls"

type TwitchAccountProps = {
  state: TwitchState
  placement?: "header" | "sidebar"
  onCommand: (type: "connect" | "disconnect") => void
  onOpenSettings?: () => void
}

function TwitchAvatar({
  state,
  className,
  alt = "",
}: {
  state: TwitchState
  className: string
  alt?: string
}) {
  const [failedUrl, setFailedUrl] = useState("")
  const imageVisible =
    !!state.profileImageUrl && failedUrl !== state.profileImageUrl

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#a970ff]/14 text-[#c9a9ff] ${className}`}
    >
      <UserRound className="size-1/2" />
      {imageVisible && (
        <img
          src={state.profileImageUrl}
          alt={alt}
          className="absolute inset-0 size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(state.profileImageUrl || "")}
        />
      )}
    </span>
  )
}

export function TwitchAccount({
  state,
  placement = "header",
  onCommand,
  onOpenSettings,
}: TwitchAccountProps) {
  const [open, setOpen] = useState(false)
  const connected =
    state.phase === "connected" || state.phase === "reconnecting"
  const authorizing = ["connecting", "authorizing"].includes(state.phase)
  const accountLabel = connected
    ? state.displayName || state.login || "Twitch"
    : state.phase === "authorizing"
      ? "Ожидаем вход…"
      : "Twitch"
  const connectionStatus =
    state.phase === "connected"
      ? "Чат подключён"
      : state.phase === "reconnecting"
        ? "Восстанавливаем соединение…"
        : state.phase === "connecting"
          ? "Подключаемся к чату…"
          : state.phase === "authorizing"
            ? "Ожидаем подтверждение"
            : state.error || "Аккаунт не подключён"
  const sidebar = placement === "sidebar"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={sidebar ? "ghost" : "outline"}
          className={
            sidebar
              ? "h-11 w-full min-w-0 justify-start gap-2.5 rounded-xl px-2"
              : "rounded-full border-border-strong bg-surface-subtle px-2.5"
          }
        >
          <span className="relative">
            <TwitchAvatar
              state={state}
              className={sidebar ? "size-8" : "size-5"}
            />
            {connected && (
              <span
                className={`absolute right-0 bottom-0 size-1.5 rounded-full ring-2 ring-popover ${state.phase === "connected" ? "bg-brand" : "bg-amber-300"}`}
              />
            )}
          </span>
          {sidebar ? (
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm">{accountLabel}</span>
              <span className="block truncate text-[10px] font-normal text-muted-foreground">
                {connected ? "Twitch" : "Подключить"}
              </span>
            </span>
          ) : (
            <>
              <span className="max-w-36 truncate">{accountLabel}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side={sidebar ? "right" : "bottom"}
        align="end"
        sideOffset={sidebar ? 10 : 4}
        className="w-84 overflow-hidden p-0"
      >
        <div className="p-5">
          <div className="flex items-center gap-3">
            <TwitchAvatar
              state={state}
              className="size-11"
              alt={state.login ? `Аватар ${state.login}` : ""}
            />
            <div className="min-w-0">
              <div className="truncate font-medium">
                {connected
                  ? state.displayName || state.login
                  : "Twitch-аккаунт"}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={`size-1.5 rounded-full ${state.phase === "connected" ? "bg-brand" : state.phase === "reconnecting" ? "bg-amber-300" : "bg-muted-foreground/35"}`}
                />
                {connectionStatus}
              </div>
            </div>
          </div>

          {state.device && (
            <div className="mt-5 space-y-3">
              <div className="flex h-16 items-center justify-center rounded-xl border border-border-subtle bg-surface-subtle font-mono text-2xl tracking-[.2em] text-brand">
                {state.device.code}
              </div>
              <Button asChild className="h-10 w-full">
                <a href={state.device.url} target="_blank" rel="noreferrer">
                  Подтвердить в Twitch <ExternalLink />
                </a>
              </Button>
            </div>
          )}

          {!connected && !state.device && !authorizing && (
            <Button
              className="mt-5 h-9 w-full"
              onClick={() => {
                setOpen(false)
                onOpenSettings?.()
              }}
            >
              Настроить подключение
            </Button>
          )}

          {!state.device && authorizing && (
            <div className="mt-5 rounded-lg border border-border-subtle bg-surface-subtle px-3 py-2.5 text-xs text-muted-foreground">
              {connectionStatus}
            </div>
          )}

          {(connected || authorizing || state.device) && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onCommand("disconnect")}
            >
              {connected ? "Отключить аккаунт" : "Отменить вход"}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
