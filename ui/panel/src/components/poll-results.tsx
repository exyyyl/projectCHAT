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
  appearance = "outline",
}: {
  children: string
  custom?: boolean
  appearance?: WidgetSettings["keywordStyle"]
}) {
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[11px] font-medium ${
        custom
          ? `widget-keyword ${appearance === "filled" ? "widget-keyword-filled" : appearance === "text" ? "widget-keyword-text" : ""}`
          : "border-brand/15 bg-brand/5 text-brand/70"
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
  const radius = {
    small: "rounded-lg",
    medium: "rounded-xl",
    large: "rounded-3xl",
  }[widget?.radius || "medium"]
  const titleSize = {
    small: "text-xl",
    medium: "text-2xl",
    large: "text-3xl",
  }[widget?.titleSize || "medium"]
  const barSize = {
    thin: "h-0.5",
    medium: "h-1",
    thick: "h-1.5",
  }[widget?.barSize || "medium"]
  const showValues =
    widget?.showVotes !== false || widget?.showPercentages !== false
  const optionSize = {
    small: "text-xs",
    medium: "text-sm",
    large: "text-base",
  }[widget?.optionSize || "medium"]
  const fontFamily = {
    geist: '"Geist Variable", Geist, sans-serif',
    system: '"Segoe UI Variable", "Segoe UI", sans-serif',
    mono: "ui-monospace, SFMono-Regular, Consolas, monospace",
  }[widget?.font || "geist"]

  return (
    <div
      className={
        compact
          ? `widget-poll ${radius} ${
              widget?.surface === "glass"
                ? "border border-white/10 backdrop-blur-md"
                : widget?.surface === "minimal"
                  ? "bg-transparent drop-shadow-[0_2px_12px_rgb(0_0_0/0.55)]"
                  : ""
            } ${widget?.surface === "minimal" ? "shadow-none" : "shadow-xl shadow-black/20"} ${widget?.density === "compact" ? "p-4" : "p-6"}`
          : "space-y-7"
      }
      style={
        widget
          ? ({
              "--widget-accent": widget.accent,
              fontFamily,
              backgroundColor:
                widget.surface === "minimal"
                  ? undefined
                  : `rgb(13 17 21 / ${widget.opacity / 100})`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-4">
        <h3
          className={
            compact
              ? `max-w-[80%] ${titleSize} leading-tight font-medium tracking-tight`
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
            <div
              key={option.id}
              className={`space-y-2.5 ${
                widget?.optionStyle === "cards"
                  ? "rounded-xl bg-white/[0.045] p-3"
                  : widget?.optionStyle === "outline"
                    ? "rounded-xl border border-white/10 p-3"
                    : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={
                      compact
                        ? `truncate ${optionSize}`
                        : "truncate text-[15px]"
                    }
                  >
                    {option.name}
                  </span>
                  {widget?.showKeywords !== false && (
                    <Keyword
                      custom={customized}
                      appearance={widget?.keywordStyle}
                    >
                      {option.word}
                    </Keyword>
                  )}
                </div>
                {showValues && (
                  <span
                    className={`shrink-0 font-mono text-sm tabular-nums ${leading ? (customized ? "widget-accent" : "text-brand") : "text-muted-foreground"}`}
                  >
                    {secret
                      ? "—"
                      : [
                          widget?.showVotes !== false
                            ? String(option.votes)
                            : null,
                          widget?.showPercentages !== false
                            ? `${share[index]}%`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </span>
                )}
              </div>
              {widget?.showBars !== false && (
                <div
                  className={`${barSize} overflow-hidden rounded-full bg-track`}
                >
                  <div
                    className={`h-full origin-left rounded-full transition-transform duration-500 ${leading ? (customized ? "widget-fill" : "bg-brand") : "bg-track-active"}`}
                    style={{
                      transform: `scaleX(${(secret ? 0 : share[index]) / 100})`,
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
