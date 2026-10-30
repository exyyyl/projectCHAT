import {
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
import type { AppView } from "@/domain/app-navigation"
import type { ChatArchiveSummary } from "@/domain/chat"
import type { Contest } from "@/domain/contest"
import type { Poll } from "@/domain/polls"
import { defaultTimer, normalizeTimer, normalizeWidgetOrder, pauseTimer, resetTimer, startTimer, timerRemaining, type TimerState, type WidgetId, widgetIds } from "@/domain/streamer-widgets"

const titles: Record<WidgetId, string> = {
  activity: "Активность",
  timer: "Таймер",
  counter: "Счётчик",
  notes: "Заметки",
  archive: "Архив чата",
}

function stored<T>(key: string, fallback: T, normalize: (value: unknown) => T): T {
  try { return normalize(JSON.parse(localStorage.getItem(key) || "null")) } catch { return fallback }
}

function persist(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* local data may be unavailable */ }
}

function clock(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
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

function RailIconButton({ label, icon, onClick, disabled = false }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="chat-rail-icon-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{icon}</button>
}

export function StreamerDashboard({ poll, contest, summary, onNavigate }: { poll: Poll | null; contest: Contest | null; summary: ChatArchiveSummary | null; onNavigate: (view: AppView) => void }) {
  const [order, setOrder] = useState<WidgetId[]>(() => stored("cue-home-widgets", [...widgetIds], normalizeWidgetOrder))
  const [customizing, setCustomizing] = useState(false)
  const [timer, setTimer] = useState<TimerState>(() => stored("cue-home-timer", defaultTimer, (value) => normalizeTimer(value, Date.now())))
  const [now, setNow] = useState(() => Date.now())
  const [minutesInput, setMinutesInput] = useState(() => String(timer.duration / 60))
  const [counter, setCounter] = useState(() => stored("cue-home-counter", { label: "Счётчик", value: 0 }, (value) => {
    const data = value as { label?: unknown; value?: unknown } | null
    return data && typeof data.label === "string" && Number.isSafeInteger(data.value) && Math.abs(Number(data.value)) <= 1_000_000
      ? { label: data.label.slice(0, 32), value: Number(data.value) }
      : { label: "Счётчик", value: 0 }
  }))
  const [memo, setMemo] = useState("")
  const [memoLoaded, setMemoLoaded] = useState(false)
  const memoRef = useRef("")
  const memoDirty = useRef(false)

  useEffect(() => { persist("cue-home-widgets", order) }, [order])
  useEffect(() => { persist("cue-home-timer", timer) }, [timer])
  useEffect(() => { persist("cue-home-counter", counter) }, [counter])
  useEffect(() => {
    if (timer.deadline === null) return
    const interval = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      setTimer((value) => value.deadline !== null && value.deadline <= current ? { ...value, remaining: 0, deadline: null } : value)
    }, 250)
    return () => window.clearInterval(interval)
  }, [timer.deadline])
  useEffect(() => {
    void fetch("/api/chat/memo").then((response) => response.json()).then((data: { text?: string }) => {
      if (!memoDirty.current) { setMemo(data.text || ""); memoRef.current = data.text || "" }
      setMemoLoaded(true)
    }).catch(() => setMemoLoaded(true))
    return () => { if (memoDirty.current) void saveMemo(memoRef.current) }
  }, [])
  useEffect(() => {
    if (!memoLoaded || !memoDirty.current) return
    const timeout = window.setTimeout(() => {
      void saveMemo(memo).then(() => { if (memoRef.current === memo) memoDirty.current = false })
    }, 600)
    return () => window.clearTimeout(timeout)
  }, [memo, memoLoaded])

  const move = (id: WidgetId, offset: number) => setOrder((current) => {
    const index = current.indexOf(id)
    const nextIndex = index + offset
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
    const next = [...current]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    return next
  })
  const setDuration = (seconds: number) => {
    setTimer({ duration: seconds, remaining: seconds, deadline: null })
    setMinutesInput(String(seconds / 60))
    setNow(Date.now())
  }
  const toggleTimer = () => {
    const current = Date.now()
    setNow(current)
    setTimer((value) => value.deadline === null ? startTimer(value, current) : pauseTimer(value, current))
  }
  const clearTimer = () => { setTimer((value) => resetTimer(value)); setNow(Date.now()) }
  const remaining = timerRemaining(timer, now)

  const widgets: Record<WidgetId, ReactNode> = {
    activity: <>
      <button type="button" className="chat-rail-action" onClick={() => onNavigate("polls")}><ListChecks aria-hidden="true" /><span><strong>Опрос</strong><small>{poll?.status === "running" ? poll.question : "Не запущен"}</small></span></button>
      <button type="button" className="chat-rail-action" onClick={() => onNavigate("contests")}><Gift aria-hidden="true" /><span><strong>Конкурс</strong><small>{contest && contest.status !== "finished" ? contest.status === "collecting" ? `#${contest.keyword || "Участники"}` : "Выбор победителя" : "Не запущен"}</small></span></button>
    </>,
    timer: <>
      <div className="chat-rail-timer" data-finished={!timer.deadline && remaining === 0 || undefined}>{clock(remaining)}</div>
      <div className="chat-rail-timer-controls">
        <RailIconButton label={timer.deadline === null ? "Запустить таймер" : "Пауза"} icon={timer.deadline === null ? <Play /> : <Pause />} onClick={toggleTimer} />
        <RailIconButton label="Сбросить таймер" icon={<RotateCcw />} onClick={clearTimer} />
      </div>
      {customizing && <div className="chat-rail-timer-presets"><button type="button" onClick={() => setDuration(300)}>5 мин</button><button type="button" onClick={() => setDuration(600)}>10 мин</button><button type="button" onClick={() => setDuration(1800)}>30 мин</button><label>Минуты<input type="number" min="1" max="600" value={minutesInput} onChange={(event) => setMinutesInput(event.target.value)} onBlur={() => { const value = Number(minutesInput); if (Number.isInteger(value) && value >= 1 && value <= 600) setDuration(value * 60) }} /></label></div>}
    </>,
    counter: <>
      {customizing && <input className="chat-rail-counter-label" aria-label="Название счётчика" maxLength={32} value={counter.label} onChange={(event) => setCounter((current) => ({ ...current, label: event.target.value }))} />}
      <div className="chat-rail-counter"><strong>{counter.value}</strong><span>{counter.label || "Счётчик"}</span></div>
      <div className="chat-rail-counter-controls"><RailIconButton label="Уменьшить счётчик" icon={<Minus />} onClick={() => setCounter((current) => ({ ...current, value: Math.max(-1_000_000, current.value - 1) }))} /><RailIconButton label="Увеличить счётчик" icon={<Plus />} onClick={() => setCounter((current) => ({ ...current, value: Math.min(1_000_000, current.value + 1) }))} /><RailIconButton label="Сбросить счётчик" icon={<RotateCcw />} onClick={() => setCounter((current) => ({ ...current, value: 0 }))} /></div>
    </>,
    notes: <textarea className="chat-rail-note-input" aria-label="Заметки для стрима" placeholder="Что держать под рукой во время эфира…" maxLength={5000} value={memo} onChange={(event) => { setMemo(event.target.value); memoRef.current = event.target.value; memoDirty.current = true }} />,
    archive: <><strong className="chat-rail-archive-count">{summary ? summary.count.toLocaleString("ru") : "—"}</strong><span className="chat-rail-archive-size">сообщений · {summary ? `${(summary.storageBytes / 1024 / 1024).toFixed(1)} МБ` : "0 МБ"}</span><small className="chat-rail-archive-limit">Лимит: 100 000 записей или 128 МБ</small></>,
  }

  return <aside className="chat-home-rail" aria-label="Инструменты стримера">
    <div className="chat-rail-top"><button type="button" aria-label={customizing ? "Завершить настройку блоков" : "Настроить блоки"} title={customizing ? "Готово" : "Настроить блоки"} onClick={() => setCustomizing((value) => !value)}><Settings2 aria-hidden="true" /></button></div>
    {order.map((id, index) => <section key={id} className="chat-rail-block"><div className="chat-rail-heading"><h2>{id === "timer" ? <Timer /> : id === "notes" ? <StickyNote /> : id === "archive" ? <HardDrive /> : null}{titles[id]}</h2>{customizing && <div className="chat-rail-edit"><RailIconButton label={`Поднять ${titles[id]}`} icon={<ChevronUp />} onClick={() => move(id, -1)} disabled={index === 0} /><RailIconButton label={`Опустить ${titles[id]}`} icon={<ChevronDown />} onClick={() => move(id, 1)} disabled={index === order.length - 1} /><RailIconButton label={`Скрыть ${titles[id]}`} icon={<X />} onClick={() => setOrder((current) => current.filter((item) => item !== id))} /></div>}</div>{widgets[id]}</section>)}
    {customizing && widgetIds.filter((id) => !order.includes(id)).length > 0 && <div className="chat-rail-hidden"><span>Добавить блок</span>{widgetIds.filter((id) => !order.includes(id)).map((id) => <button type="button" key={id} onClick={() => setOrder((current) => [...current, id])}><Plus aria-hidden="true" />{titles[id]}</button>)}</div>}
  </aside>
}
