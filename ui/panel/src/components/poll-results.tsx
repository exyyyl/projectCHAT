import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import {
  type Draft,
  formatTime,
  percentages,
  type Poll,
  type WidgetSettings,
} from "@/domain/polls"

export function Keyword({
  children,
  custom = false,
}: {
  children: string
  custom?: boolean
}) {
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[11px] font-medium ${
        custom ? "widget-keyword" : "border-brand/15 bg-brand/5 text-brand/70"
      }`}
    >
      {children}
    </Badge>
  )
}

export function PollTimer({
  poll,
  custom = false,
}: {
  poll: Draft | Poll
  custom?: boolean
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  const seconds =
    "status" in poll
      ? poll.status === "ended"
        ? 0
        : Math.max(0, Math.ceil((poll.deadline - now) / 1000))
      : poll.duration
  return (
    <span
      className={`font-mono text-sm tabular-nums ${custom ? "widget-accent" : "text-brand"}`}
    >
      {formatTime(seconds)}
    </span>
  )
}

export function PollResults({
  poll,
  compact = false,
  widget,
}: {
  poll: Draft | Poll
  compact?: boolean
  widget?: WidgetSettings
}) {
  const options = poll.options.map((option) => ({
    ...option,
    votes: option.votes || 0,
  }))
  const share = percentages(options)
  const maximum = Math.max(...options.map((option) => option.votes), 0)
  const secret = poll.secret && "status" in poll && poll.status !== "ended"
  const customized = compact && !!widget

  return (
    <div
      className={
        compact
          ? `widget-poll rounded-xl shadow-xl shadow-black/20 ${
              widget?.surface === "glass"
                ? "border border-white/10 bg-[#0d1115]/75 backdrop-blur-md"
                : "bg-preview"
            } ${widget?.density === "compact" ? "p-4" : "p-6"}`
          : "space-y-7"
      }
      style={
        widget
          ? ({ "--widget-accent": widget.accent } as React.CSSProperties)
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-4">
        <h3
          className={
            compact
              ? "max-w-[80%] text-2xl leading-tight font-medium tracking-tight"
              : "text-3xl font-medium tracking-tight"
          }
        >
          {poll.question}
        </h3>
        {compact && widget?.showTimer !== false && (
          <PollTimer poll={poll} custom={customized} />
        )}
      </div>
      <div
        className={
          compact
            ? widget?.density === "compact"
              ? "mt-5 space-y-4"
              : "mt-7 space-y-5"
            : "space-y-6"
        }
      >
        {options.map((option, index) => {
          const leading = !secret && maximum > 0 && option.votes === maximum
          return (
            <div key={option.id} className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={
                      compact ? "truncate text-sm" : "truncate text-[15px]"
                    }
                  >
                    {option.name}
                  </span>
                  {widget?.showKeywords !== false && (
                    <Keyword custom={customized}>{option.word}</Keyword>
                  )}
                </div>
                <span
                  className={`shrink-0 font-mono text-sm tabular-nums ${leading ? (customized ? "widget-accent" : "text-brand") : "text-muted-foreground"}`}
                >
                  {secret
                    ? "—"
                    : compact
                      ? `${share[index]}%`
                      : `${option.votes} · ${share[index]}%`}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-track">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${leading ? (customized ? "widget-fill" : "bg-brand") : "bg-track-active"}`}
                  style={{ width: `${secret ? 0 : share[index]}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
