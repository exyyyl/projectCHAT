import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { type Draft, formatTime, percentages, type Poll } from "@/domain/polls"

export function Keyword({ children }: { children: string }) {
  return (
    <Badge
      variant="outline"
      className="border-brand/15 bg-brand/5 font-mono text-[11px] font-medium text-brand/70"
    >
      {children}
    </Badge>
  )
}

export function PollTimer({ poll }: { poll: Draft | Poll }) {
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
    <span className="font-mono text-sm text-brand tabular-nums">
      {formatTime(seconds)}
    </span>
  )
}

export function PollResults({
  poll,
  compact = false,
}: {
  poll: Draft | Poll
  compact?: boolean
}) {
  const options = poll.options.map((option) => ({
    ...option,
    votes: option.votes || 0,
  }))
  const share = percentages(options)
  const maximum = Math.max(...options.map((option) => option.votes), 0)
  const secret = poll.secret && "status" in poll && poll.status !== "ended"

  return (
    <div
      className={
        compact
          ? "rounded-xl bg-preview p-6 shadow-xl shadow-black/20"
          : "space-y-7"
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
        {compact && <PollTimer poll={poll} />}
      </div>
      <div className={compact ? "mt-7 space-y-5" : "space-y-6"}>
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
                  <Keyword>{option.word}</Keyword>
                </div>
                <span
                  className={`shrink-0 font-mono text-sm tabular-nums ${leading ? "text-brand" : "text-muted-foreground"}`}
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
                  className={`h-full rounded-full transition-[width] duration-500 ${leading ? "bg-brand" : "bg-track-active"}`}
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
