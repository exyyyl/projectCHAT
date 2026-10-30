import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import {
  type Draft,
  formatTime,
  type Poll,
  type WidgetSettings,
} from "@/domain/polls"

export function Keyword({
  children,
  custom = false,
  appearance = "outline",
  placeholder = false,
}: {
  children: string
  custom?: boolean
  appearance?: WidgetSettings["keywordStyle"]
  placeholder?: boolean
}) {
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[11px] font-medium ${placeholder ? "border-dashed opacity-45" : ""} ${
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
