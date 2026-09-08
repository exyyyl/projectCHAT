import { useState } from "react"
import {
  ChevronDown,
  ExternalLink,
  LoaderCircle,
  LogOut,
  UserRound,
} from "lucide-react"

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
}: TwitchAccountProps) {
  const [open, setOpen] = useState(false)
  const loading = state.phase === "loading"
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

  if (loading) {
    return (
      <div
        className={
          sidebar
            ? "flex h-11 w-full items-center gap-2.5 px-2"
            : "flex h-9 items-center gap-2 rounded-full px-2.5"
        }
        role="status"
        aria-label="Загрузка профиля Twitch"
      >
        <span
          className={`${sidebar ? "size-8" : "size-5"} shrink-0 animate-pulse rounded-full bg-[#a970ff]/16`}
        />
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="block h-2.5 w-18 animate-pulse rounded-full bg-white/10" />
          {sidebar && (
            <span className="block h-2 w-12 animate-pulse rounded-full bg-white/6" />
          )}
        </span>
      </div>
    )
  }

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
                {connected
                  ? state.phase === "reconnecting"
                    ? "Подключаемся…"
                    : "Чат подключён"
                  : authorizing
                    ? "Вход в аккаунт…"
                    : "Не подключён"}
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
        className="w-80 overflow-hidden p-2"
      >
        <div className="rounded-xl bg-white/[0.035] p-3">
          <div className="flex items-center gap-3">
            <TwitchAvatar
              state={state}
              className="size-10"
              alt={state.login ? `Аватар ${state.login}` : ""}
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
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
        </div>

        {state.device && (
          <div className="p-3 pb-2">
            <div className="text-[11px] text-muted-foreground">Код входа</div>
            <div className="mt-2 flex h-12 items-center justify-center rounded-lg bg-black/20 font-mono text-xl tracking-[.22em] text-brand">
              {state.device.code}
            </div>
            <Button asChild className="mt-3 h-9 w-full">
              <a href={state.device.url} target="_blank" rel="noreferrer">
                Открыть Twitch <ExternalLink />
              </a>
            </Button>
          </div>
        )}

        {!connected && !state.device && !authorizing && (
          <div className="p-2 pb-1">
            <Button className="h-9 w-full" onClick={() => onCommand("connect")}>
              Подключить Twitch
            </Button>
          </div>
        )}

        {!state.device && authorizing && (
          <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            {connectionStatus}
          </div>
        )}

        {(connected || authorizing || state.device) && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start gap-2.5 px-3 text-muted-foreground hover:bg-destructive/8 hover:text-destructive"
            onClick={() => onCommand("disconnect")}
          >
            <LogOut />
            {connected ? "Отключить Twitch" : "Отменить вход"}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
