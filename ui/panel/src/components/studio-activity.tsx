import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { ArrowUpRight, Gift, ListChecks, type LucideIcon } from "lucide-react"
import type { Poll } from "@/domain/polls"
import type { Contest } from "@/domain/contest"
import type { AppView } from "@/domain/app-navigation"
import { Button } from "./ui/button"

export type StudioActivityControls = {
  pollDisabled: boolean
  contestDisabled: boolean
  finishPoll: () => void
  closeContest: () => void
  drawContest: () => void
}

// Animate changes in content height, never the one-second clock updates.
function useActivityHeight() {
  const shell = useRef<HTMLDivElement>(null),
    content = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  useLayoutEffect(() => {
    const outer = shell.current,
      inner = content.current
    if (!outer || !inner) return
    gsap.set(outer, { height: "auto", overflow: "visible" })
    let previous = inner.getBoundingClientRect().height
    let tween: gsap.core.Tween | null = null
    const observer = new ResizeObserver(() => {
      const next = inner.getBoundingClientRect().height
      if (Math.abs(next - previous) < 0.5) return
      const from = tween?.isActive()
        ? outer.getBoundingClientRect().height
        : previous
      previous = next
      tween?.kill()
      if (reduced) {
        gsap.set(outer, { height: "auto", overflow: "visible" })
        return
      }
      gsap.set(outer, { height: from, overflow: "hidden" })
      tween = gsap.to(outer, {
        height: next,
        duration: 0.3,
        ease: "power3.out",
        onComplete: () => {
          gsap.set(outer, { height: "auto", overflow: "visible" })
        },
      })
    })
    observer.observe(inner)
    return () => {
      observer.disconnect()
      tween?.kill()
    }
  }, [reduced])
  return { shell, content }
}

function timeLeft(deadline: number, now: number) {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

export function StudioActivity({
  poll,
  contest,
  controls,
  onNavigate,
}: {
  poll: Poll | null
  contest: Contest | null
  controls?: StudioActivityControls
  onNavigate: (view: AppView) => void
}) {
  const [now, setNow] = useState(Date.now)
  const { shell, content } = useActivityHeight()
  const running = poll?.status === "running" || contest?.status === "collecting"
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running])
  const votes =
    poll?.options.reduce((sum, option) => sum + option.votes, 0) || 0
  const eligible =
    contest?.participants.filter((participant) => participant.eligible)
      .length || 0
  return (
    <div className="studio-activity-shell" ref={shell}>
      <div className="studio-activity" ref={content}>
        {poll?.status !== "running" && (
          <EmptyActivity
            title="Опрос"
            icon={ListChecks}
            onOpen={() => onNavigate("polls")}
          />
        )}
        {poll?.status === "running" && (
          <section className="studio-activity-item" aria-label="Текущий опрос">
            <header>
              <h3>
                <ListChecks aria-hidden="true" />
                Опрос
              </h3>
              <span aria-label="Осталось времени">
                {timeLeft(poll.deadline, now)}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Открыть текущий опрос"
                onClick={() => onNavigate("polls")}
              >
                <ArrowUpRight />
              </Button>
            </header>
            <p className="studio-activity-question">{poll.question}</p>
            {poll.secret ? (
              <p className="studio-activity-meta">
                Результаты скрыты до завершения
              </p>
            ) : (
              <ul className="studio-activity-results">
                {poll.options.map((option) => (
                  <li key={option.id}>
                    <div>
                      <span>{option.name}</span>
                      <span>{option.votes}</span>
                    </div>
                    <div className="studio-activity-track" aria-hidden="true">
                      <span
                        style={{
                          width: `${votes ? (option.votes / votes) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <footer>
              <span>Голоса: {votes.toLocaleString("ru")}</span>
              {controls && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={controls.pollDisabled}
                  onClick={controls.finishPoll}
                >
                  Завершить
                </Button>
              )}
            </footer>
          </section>
        )}
        {(!contest || contest.status === "finished") && (
          <EmptyActivity
            title="Конкурс"
            icon={Gift}
            onOpen={() => onNavigate("contests")}
          />
        )}
        {contest && contest.status !== "finished" && (
          <section
            className="studio-activity-item"
            aria-label="Текущий конкурс"
          >
            <header>
              <h3>
                <Gift aria-hidden="true" />
                Конкурс
              </h3>
              <span>
                {contest.status === "collecting"
                  ? timeLeft(contest.deadline, now)
                  : contest.status === "ready"
                    ? "Приём завершён"
                    : "Победитель"}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Открыть текущий конкурс"
                onClick={() => onNavigate("contests")}
              >
                <ArrowUpRight />
              </Button>
            </header>
            {contest.winner ? (
              <p className="studio-activity-question">{contest.winner.name}</p>
            ) : (
              <p className="studio-activity-meta">
                {contest.mode === "keyword"
                  ? `Слово: ${contest.keyword}`
                  : contest.mode === "number"
                    ? `Число от ${contest.numberMin} до ${contest.numberMax}`
                    : "Участие по активности в чате"}
              </p>
            )}
            <footer>
              <span>Участники: {eligible.toLocaleString("ru")}</span>
              {controls && contest.status !== "winner" && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={
                    controls.contestDisabled ||
                    (contest.status === "ready" && !eligible)
                  }
                  onClick={
                    contest.status === "collecting"
                      ? controls.closeContest
                      : controls.drawContest
                  }
                >
                  {contest.status === "collecting"
                    ? "Завершить приём"
                    : "Выбрать победителя"}
                </Button>
              )}
            </footer>
          </section>
        )}
      </div>
    </div>
  )
}

function EmptyActivity({
  title,
  icon: Icon,
  onOpen,
}: {
  title: string
  icon: LucideIcon
  onOpen: () => void
}) {
  return (
    <section
      className="studio-activity-item studio-activity-empty"
      aria-label={`${title}: не запущен`}
    >
      <button
        type="button"
        className="studio-activity-empty-action"
        onClick={onOpen}
        aria-label={`Открыть раздел ${title === "Опрос" ? "Опросы" : "Конкурсы"}`}
      >
        <Icon aria-hidden="true" />
        <span>
          <strong>{title}</strong>
          <small>Не запущен</small>
        </span>
        <ArrowUpRight aria-hidden="true" />
      </button>
    </section>
  )
}
