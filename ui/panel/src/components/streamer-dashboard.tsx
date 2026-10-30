import "@/components/streamer-dashboard.css"
import {
  ArrowUpRight,
  CircleDashed,
  LayoutTemplate,
  PanelsTopLeft,
  ChevronDown,
  ChevronUp,
  Gift,
  HardDrive,
  ListChecks,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  StickyNote,
  Timer,
  X,
} from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Popover } from "radix-ui"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FormField, FormSwitch } from "@/components/form-controls"
import type { AppView } from "@/domain/app-navigation"
import type { ChatArchiveSummary } from "@/domain/chat"
import type { Contest } from "@/domain/contest"
import type { Poll } from "@/domain/polls"
import {
  activityIds,
  normalizeActivities,
  normalizeCounter,
  defaultCounter,
  counterValue,
  extendTimer,
  defaultTimer,
  normalizeTimer,
  normalizeWidgetOrder,
  pauseTimer,
  resetTimer,
  startTimer,
  timerRemaining,
  type TimerState,
  type WidgetId,
  widgetIds,
} from "@/domain/streamer-widgets"

const titles: Record<WidgetId, string> = {
  activity: "Активность",
  timer: "Таймер",
  counter: "Счётчик",
  notes: "Заметки",
  archive: "Архив чата",
}

function stored<T>(
  key: string,
  fallback: T,
  normalize: (value: unknown) => T
): T {
  try {
    return normalize(JSON.parse(localStorage.getItem(key) || "null"))
  } catch {
    return fallback
  }
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* local data may be unavailable */
  }
}

function clock(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
}

async function saveMemo(text: string) {
  const response = await fetch("/api/chat/memo", {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json", "X-Poll-Client": "panel" },
    body: JSON.stringify({ text }),
  })
  if (!response.ok) throw new Error("Не удалось сохранить заметки.")
}

function RailIconButton({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="chat-rail-icon-button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </button>
  )
}

export function StreamerDashboard({
  poll,
  contest,
  summary,
  onNavigate,
}: {
  poll: Poll | null
  contest: Contest | null
  summary: ChatArchiveSummary | null
  onNavigate: (view: AppView) => void
}) {
  const [order, setOrder] = useState<WidgetId[]>(() =>
    stored("cue-home-widgets", [...widgetIds], normalizeWidgetOrder)
  )
  const [customizing, setCustomizing] = useState(false)
  const [timer, setTimer] = useState<TimerState>(() =>
    stored("cue-home-timer", defaultTimer, (value) =>
      normalizeTimer(value, Date.now())
    )
  )
  const [now, setNow] = useState(() => Date.now())
  const [counter, setCounter] = useState(() =>
    stored("cue-home-counter", defaultCounter, normalizeCounter)
  )
  const [activities, setActivities] = useState(() =>
    stored(
      "cue-home-activities",
      normalizeActivities(null),
      normalizeActivities
    )
  )
  const [timerOptions, setTimerOptions] = useState(() =>
    stored(
      "cue-home-timer-options",
      { label: "Таймер", progress: true },
      (value) => {
        const saved = value as { label?: unknown; progress?: unknown } | null
        return {
          label:
            typeof saved?.label === "string"
              ? saved.label.slice(0, 32)
              : "Таймер",
          progress: saved?.progress !== false,
        }
      }
    )
  )
  const [memo, setMemo] = useState("")
  const [memoLoaded, setMemoLoaded] = useState(false)
  const memoRef = useRef("")
  const memoDirty = useRef(false)

  useEffect(() => {
    persist("cue-home-widgets", order)
  }, [order])
  useEffect(() => {
    persist("cue-home-timer", timer)
  }, [timer])
  useEffect(() => {
    persist("cue-home-counter", counter)
  }, [counter])
  useEffect(() => {
    persist("cue-home-activities", activities)
  }, [activities])
  useEffect(() => {
    persist("cue-home-timer-options", timerOptions)
  }, [timerOptions])
  useEffect(() => {
    if (timer.deadline === null) return
    const interval = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      setTimer((value) =>
        value.deadline !== null && value.deadline <= current
          ? { ...value, remaining: 0, deadline: null }
          : value
      )
    }, 250)
    return () => window.clearInterval(interval)
  }, [timer.deadline])
  useEffect(() => {
    void fetch("/api/chat/memo")
      .then((response) => response.json())
      .then((data: { text?: string }) => {
        if (!memoDirty.current) {
          setMemo(data.text || "")
          memoRef.current = data.text || ""
        }
        setMemoLoaded(true)
      })
      .catch(() => setMemoLoaded(true))
    return () => {
      if (memoDirty.current) void saveMemo(memoRef.current).catch(() => {})
    }
  }, [])
  useEffect(() => {
    if (!memoLoaded || !memoDirty.current) return
    const timeout = window.setTimeout(() => {
      void saveMemo(memo)
        .then(() => {
          if (memoRef.current === memo) memoDirty.current = false
        })
        .catch(() => {})
    }, 600)
    return () => window.clearTimeout(timeout)
  }, [memo, memoLoaded])

  const move = (id: WidgetId, offset: number) =>
    setOrder((current) => {
      const index = current.indexOf(id)
      const nextIndex = index + offset
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length)
        return current
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  const setDuration = (seconds: number) => {
    setTimer({ duration: seconds, remaining: seconds, deadline: null })
    setNow(Date.now())
  }
  const toggleTimer = () => {
    const current = Date.now()
    setNow(current)
    setTimer((value) =>
      value.deadline === null
        ? startTimer(value, current)
        : pauseTimer(value, current)
    )
  }
  const clearTimer = () => {
    setTimer((value) => resetTimer(value))
    setNow(Date.now())
  }
  const remaining = timerRemaining(timer, now)

  const widgets: Record<WidgetId, ReactNode> = {
    activity: (
      <div className="chat-rail-activities">
        {activities.map((id) => {
          const live =
            (id === "polls" && poll?.status === "running") ||
            (id === "contests" &&
              Boolean(contest && contest.status !== "finished"))
          const item = activityLinks[id]
          const Icon = item.icon
          const detail =
            id === "polls" && poll?.status === "running"
              ? poll.question
              : id === "contests" && live
                ? contest?.status === "collecting"
                  ? "Приём участников"
                  : "Выбор победителя"
                : item.detail
          return (
            <button
              key={id}
              type="button"
              className="chat-rail-action"
              data-live={live || undefined}
              onClick={() => onNavigate(id)}
            >
              <Icon aria-hidden="true" />
              <span>
                <strong>{item.label}</strong>
                <small>{detail}</small>
              </span>
              <ArrowUpRight
                className="chat-rail-action-arrow"
                aria-hidden="true"
              />
            </button>
          )
        })}
        {!activities.length && (
          <span className="chat-rail-empty">
            Выберите разделы в настройках блока.
          </span>
        )}
      </div>
    ),
    timer: (
      <>
        <div className="chat-rail-time-row">
          <output
            className="chat-rail-timer"
            aria-label="Осталось времени"
            data-finished={remaining === 0 || undefined}
          >
            {clock(remaining)}
          </output>
          <span className="chat-rail-timer-state" role="status">
            {remaining === 0
              ? "Готово"
              : timer.deadline !== null
                ? "Идёт"
                : remaining !== timer.duration
                  ? "Пауза"
                  : ""}
          </span>
        </div>
        {timerOptions.progress && (
          <div className="chat-rail-progress" aria-hidden="true">
            <span
              style={{
                width: `${Math.min(100, (remaining / timer.duration) * 100)}%`,
              }}
            />
          </div>
        )}
        <div className="chat-rail-timer-controls">
          <button
            className="chat-rail-start"
            type="button"
            aria-label={timer.deadline === null ? "Запустить таймер" : "Пауза"}
            onClick={toggleTimer}
          >
            {timer.deadline === null ? (
              <Play aria-hidden="true" />
            ) : (
              <Pause aria-hidden="true" />
            )}
            {timer.deadline === null ? "Старт" : "Пауза"}
          </button>
          <button
            className="chat-rail-add-time"
            type="button"
            onClick={() => {
              const current = Date.now()
              setNow(current)
              setTimer((value) => extendTimer(value, 30, current))
            }}
          >
            +30 с
          </button>
          <RailIconButton
            label="Сбросить таймер"
            icon={<RotateCcw />}
            onClick={clearTimer}
          />
        </div>
      </>
    ),
    counter: (
      <>
        <CounterValue
          key={counter.value}
          value={counter.value}
          onChange={(value) => setCounter((current) => ({ ...current, value }))}
        />
        <div className="chat-rail-counter-controls">
          <button
            type="button"
            aria-label="Уменьшить счётчик"
            onClick={() =>
              setCounter((current) => ({
                ...current,
                value: counterValue(current.value - current.step),
              }))
            }
          >
            <Minus aria-hidden="true" />
            {counter.step}
          </button>
          <button
            type="button"
            aria-label="Увеличить счётчик"
            onClick={() =>
              setCounter((current) => ({
                ...current,
                value: counterValue(current.value + current.step),
              }))
            }
          >
            <Plus aria-hidden="true" />
            {counter.step}
          </button>
          <RailIconButton
            label="Сбросить счётчик"
            icon={<RotateCcw />}
            onClick={() =>
              setCounter((current) => ({ ...current, value: current.reset }))
            }
          />
        </div>
      </>
    ),
    notes: (
      <textarea
        className="chat-rail-note-input"
        aria-label="Заметки для стрима"
        placeholder="Что держать под рукой во время эфира…"
        maxLength={5000}
        value={memo}
        onChange={(event) => {
          setMemo(event.target.value)
          memoRef.current = event.target.value
          memoDirty.current = true
        }}
      />
    ),
    archive: (
      <>
        <strong className="chat-rail-archive-count">
          {summary ? summary.count.toLocaleString("ru") : "—"}
        </strong>
        <span className="chat-rail-archive-size">
          сообщений ·{" "}
          {summary
            ? `${(summary.storageBytes / 1024 / 1024).toFixed(1)} МБ`
            : "0 МБ"}
        </span>
        <small className="chat-rail-archive-limit">
          Лимит: 100 000 записей или 128 МБ
        </small>
      </>
    ),
  }

  const settings: Partial<Record<WidgetId, ReactNode>> = {
    timer: (
      <>
        <FormField label="Название">
          <Input
            aria-label="Название таймера"
            maxLength={32}
            value={timerOptions.label}
            onChange={(event) =>
              setTimerOptions((current) => ({
                ...current,
                label: event.target.value,
              }))
            }
          />
        </FormField>
        <TimerDuration
          key={timer.duration}
          value={timer.duration}
          onChange={setDuration}
        />
        <FormSwitch
          label="Полоса времени"
          checked={timerOptions.progress}
          onCheckedChange={(progress) =>
            setTimerOptions((current) => ({ ...current, progress }))
          }
        />
      </>
    ),
    counter: (
      <>
        <FormField label="Название">
          <Input
            aria-label="Название счётчика"
            maxLength={32}
            value={counter.label}
            onChange={(event) =>
              setCounter((current) => ({
                ...current,
                label: event.target.value,
              }))
            }
          />
        </FormField>
        <NumberSetting
          label="Шаг счётчика"
          value={counter.step}
          min={1}
          max={100000}
          onChange={(step) => setCounter((current) => ({ ...current, step }))}
        />
        <NumberSetting
          label="Значение при сбросе"
          value={counter.reset}
          min={-1000000}
          max={1000000}
          onChange={(reset) => setCounter((current) => ({ ...current, reset }))}
        />
      </>
    ),
    activity: (
      <div>
        {activityIds.map((id) => (
          <FormSwitch
            key={id}
            label={activityLinks[id].label}
            checked={activities.includes(id)}
            onCheckedChange={(checked) =>
              setActivities((current) =>
                checked
                  ? [...current, id]
                  : current.filter((item) => item !== id)
              )
            }
          />
        ))}
      </div>
    ),
  }
  return (
    <aside className="chat-home-rail" aria-label="Инструменты стримера">
      <div className="chat-rail-top">
        <button
          type="button"
          aria-label={
            customizing ? "Завершить настройку блоков" : "Настроить блоки"
          }
          aria-pressed={customizing}
          onClick={() => setCustomizing((value) => !value)}
        >
          {customizing ? (
            <X aria-hidden="true" />
          ) : (
            <Settings2 aria-hidden="true" />
          )}
        </button>
      </div>
      {order.map((id, index) => (
        <section key={id} className="chat-rail-block">
          <div className="chat-rail-heading">
            <h2>
              {id === "timer" ? (
                <Timer />
              ) : id === "notes" ? (
                <StickyNote />
              ) : id === "archive" ? (
                <HardDrive />
              ) : null}
              {id === "timer"
                ? timerOptions.label || "Таймер"
                : id === "counter"
                  ? counter.label || "Счётчик"
                  : titles[id]}
            </h2>
            {customizing ? (
              <div className="chat-rail-edit">
                <RailIconButton
                  label={`Поднять ${titles[id]}`}
                  icon={<ChevronUp />}
                  onClick={() => move(id, -1)}
                  disabled={index === 0}
                />
                <RailIconButton
                  label={`Опустить ${titles[id]}`}
                  icon={<ChevronDown />}
                  onClick={() => move(id, 1)}
                  disabled={index === order.length - 1}
                />
                <RailIconButton
                  label={`Скрыть ${titles[id]}`}
                  icon={<X />}
                  onClick={() =>
                    setOrder((current) => current.filter((item) => item !== id))
                  }
                />
              </div>
            ) : (
              settings[id] && (
                <Popover.Root>
                  <Popover.Trigger asChild>
                    <button
                      className="chat-rail-settings-trigger"
                      type="button"
                      aria-label={`Настроить: ${titles[id]}`}
                    >
                      <Settings2 aria-hidden="true" />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="chat-rail-settings"
                      side="right"
                      align="start"
                      sideOffset={12}
                      collisionPadding={12}
                    >
                      <div className="chat-rail-settings-heading">
                        <strong>{titles[id]}</strong>
                        <Popover.Close asChild>
                          <button
                            type="button"
                            aria-label="Закрыть настройки блока"
                          >
                            <X aria-hidden="true" />
                          </button>
                        </Popover.Close>
                      </div>
                      {settings[id]}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              )
            )}
          </div>
          {widgets[id]}
        </section>
      ))}
      {customizing &&
        widgetIds.filter((id) => !order.includes(id)).length > 0 && (
          <div className="chat-rail-hidden">
            <span>Добавить блок</span>
            {widgetIds
              .filter((id) => !order.includes(id))
              .map((id) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setOrder((current) => [...current, id])}
                >
                  <Plus aria-hidden="true" />
                  {titles[id]}
                </button>
              ))}
          </div>
        )}
    </aside>
  )
}

const activityLinks = {
  polls: { label: "Опрос", icon: ListChecks, detail: "Создать опрос" },
  contests: { label: "Конкурс", icon: Gift, detail: "Открыть розыгрыш" },
  "decision-wheel": {
    label: "Рулетка",
    icon: CircleDashed,
    detail: "Выбрать случайно",
  },
  presets: {
    label: "Шаблоны",
    icon: LayoutTemplate,
    detail: "Заготовки опросов",
  },
  widget: {
    label: "Виджеты",
    icon: PanelsTopLeft,
    detail: "Оформление для OBS",
  },
}

function CounterValue({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  const commit = (input: string) => {
    const number = Number(input)
    if (input.trim() && Number.isSafeInteger(number)) {
      const next = counterValue(number)
      onChange(next)
      setText(String(next))
    } else setText(String(value))
  }
  return (
    <input
      className="chat-rail-counter-value"
      aria-label="Значение счётчика"
      inputMode="numeric"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") {
          event.currentTarget.value = String(value)
          setText(String(value))
          event.currentTarget.blur()
        }
      }}
    />
  )
}
function NumberSetting({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <FormField label={label}>
      <Input
        key={value}
        aria-label={label}
        type="number"
        min={min}
        max={max}
        defaultValue={value}
        onBlur={(event) => {
          const number = Number(event.target.value)
          if (
            event.target.value.trim() &&
            Number.isInteger(number) &&
            number >= min &&
            number <= max
          )
            onChange(number)
          else event.target.value = String(value)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
        }}
      />
    </FormField>
  )
}
function TimerDuration({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const [minutes, setMinutes] = useState(String(Math.floor(value / 60)))
  const [seconds, setSeconds] = useState(String(value % 60))
  const duration = Number(minutes) * 60 + Number(seconds)
  const valid =
    minutes.trim() &&
    seconds.trim() &&
    Number.isInteger(Number(minutes)) &&
    Number.isInteger(Number(seconds)) &&
    Number(minutes) >= 0 &&
    Number(seconds) >= 0 &&
    Number(seconds) < 60 &&
    duration >= 10 &&
    duration <= 36000
  return (
    <form
      className="chat-rail-duration"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) onChange(duration)
      }}
    >
      <div className="chat-rail-duration-inputs">
        <FormField label="Минуты">
          <Input
            aria-label="Минуты таймера"
            type="number"
            min={0}
            max={600}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </FormField>
        <FormField label="Секунды">
          <Input
            aria-label="Секунды таймера"
            type="number"
            min={0}
            max={59}
            value={seconds}
            onChange={(event) => setSeconds(event.target.value)}
          />
        </FormField>
      </div>
      <div className="chat-rail-duration-presets">
        {[1, 5, 10, 30].map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => {
              setMinutes(String(minutes))
              setSeconds("0")
            }}
          >
            {minutes} мин
          </button>
        ))}
      </div>
      <Button type="submit" variant="secondary" disabled={!valid}>
        Установить время
      </Button>
    </form>
  )
}
