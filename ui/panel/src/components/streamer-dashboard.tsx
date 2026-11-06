import "@/components/streamer-dashboard.css"
import {
  Activity,
  Hash,
  HardDrive,
  Minus,
  Plus,
  RotateCcw,
  Settings2,
  Timer,
  X,
  Volume2,
  VolumeX,
  Pencil,
} from "lucide-react"
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SetStateAction,
} from "react"
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { Popover } from "radix-ui"
import { Input } from "@/components/ui/input"
import { StudioActivity, type StudioActivityControls } from "./studio-activity"
import { StreamerNotes } from "./streamer-notes"
import { useStreamerNotes } from "@/hooks/use-streamer-notes"
import { createTimerChime } from "@/domain/timer-chime"
import { ChatArchiveControls } from "./chat-archive-controls"
import { FormField, FormSwitch } from "@/components/form-controls"
import type { AppView } from "@/domain/app-navigation"
import type { ChatArchiveCleanup, ChatArchiveSummary } from "@/domain/chat"
import type { Contest } from "@/domain/contest"
import type { Poll } from "@/domain/polls"
import {
  normalizeWidgetOrder,
  reorderDashboardBlock,
  normalizeCounter,
  defaultCounter,
  counterValue,
  extendTimer,
  defaultTimer,
  normalizeTimer,
  pauseTimer,
  parseTimerDuration,
  formatTimerInput,
  startTimer,
  timerRemaining,
  type TimerState,
  type WidgetId,
} from "@/domain/streamer-widgets"

const titles: Record<WidgetId, string> = {
  activity: "Сейчас",
  timer: "Таймер",
  counter: "Счётчик",
  notes: "Заметки",
  todos: "Список дел",
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
  return [hours, minutes, rest]
    .map((part) => String(part).padStart(2, "0"))
    .join(":")
}

function messageCountLabel(count: number) {
  const tail = count % 100
  if (tail >= 11 && tail <= 14) return "сообщений"
  if (count % 10 === 1) return "сообщение"
  if (count % 10 >= 2 && count % 10 <= 4) return "сообщения"
  return "сообщений"
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
  channelId,
  onArchiveCleanup,
  onNavigate,
  order,
  onOrderChange,
  blocksAction,
  activityControls,
}: {
  activityControls?: StudioActivityControls
  order: WidgetId[]
  onOrderChange: Dispatch<SetStateAction<WidgetId[]>>
  /** Receives a callback that enters the block arrangement mode. */
  blocksAction: (arrange: () => void) => ReactNode
  poll: Poll | null
  contest: Contest | null
  summary: ChatArchiveSummary | null
  channelId: string
  onArchiveCleanup: (change: ChatArchiveCleanup) => void
  onNavigate: (view: AppView) => void
}) {
  const notes = useStreamerNotes(
    order.includes("notes") || order.includes("todos")
  )
  const [timer, setTimer] = useState<TimerState>(() =>
    stored("cue-home-timer", defaultTimer, (value) =>
      normalizeTimer(value, Date.now())
    )
  )
  const [timerReady, setTimerReady] = useState(
    () =>
      timer.deadline !== null ||
      (timer.remaining > 0 && timer.remaining < timer.duration)
  )
  const [timerInput, setTimerInput] = useState("")
  const [timerFinished, setTimerFinished] = useState(false)
  const timeInput = useRef<HTMLInputElement>(null)
  const parsedDuration = parseTimerDuration(timerInput)
  const [now, setNow] = useState(() => Date.now())
  const [chime] = useState(createTimerChime)
  const [counter, setCounter] = useState(() =>
    stored("cue-home-counter", defaultCounter, normalizeCounter)
  )
  const [timerOptions, setTimerOptions] = useState(() =>
    stored(
      "cue-home-timer-options",
      { label: "Таймер", progress: true, sound: true },
      (value) => {
        const saved = value as {
          label?: unknown
          progress?: unknown
          sound?: unknown
        } | null
        return {
          label:
            typeof saved?.label === "string"
              ? saved.label.slice(0, 32)
              : "Таймер",
          progress: saved?.progress !== false,
          sound: saved?.sound !== false,
        }
      }
    )
  )

  useEffect(() => {
    persist("cue-home-timer", timer)
  }, [timer])
  useEffect(() => {
    persist("cue-home-counter", counter)
  }, [counter])
  useEffect(() => {
    persist("cue-home-timer-options", timerOptions)
  }, [timerOptions])
  useEffect(() => () => chime.dispose(), [chime])
  const finishTimer = useEffectEvent((deadline: number) => {
    if (timer.deadline !== deadline) return
    setTimer((value) => ({ ...value, remaining: 0, deadline: null }))
    setTimerReady(false)
    setTimerInput("")
    setTimerFinished(true)
    if (timerOptions.sound) chime.play()
  })
  useEffect(() => {
    if (timer.deadline === null) return
    const deadline = timer.deadline
    const interval = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (deadline <= current) {
        window.clearInterval(interval)
        finishTimer(deadline)
      }
    }, 250)
    return () => window.clearInterval(interval)
  }, [timer.deadline])
  const toggleTimer = () => {
    const current = Date.now()
    if (!timerReady) {
      if (parsedDuration === null) return
      if (timerOptions.sound) void chime.prepare()
      setTimer(
        startTimer(
          {
            duration: parsedDuration,
            remaining: parsedDuration,
            deadline: null,
          },
          current
        )
      )
      setTimerReady(true)
      setTimerInput("")
      setTimerFinished(false)
    } else {
      if (timer.deadline === null && timerOptions.sound) void chime.prepare()
      setTimer((value) =>
        value.deadline === null
          ? startTimer(value, current)
          : pauseTimer(value, current)
      )
    }
    setNow(current)
  }
  const clearTimer = () => {
    setTimer((value) => ({ ...value, remaining: 0, deadline: null }))
    setTimerReady(false)
    setTimerInput("")
    setTimerFinished(false)
    setNow(Date.now())
  }
  const editTimer = () => {
    const current = Date.now()
    const paused = pauseTimer(timer, current)
    setTimer(paused)
    setTimerInput(clock(paused.remaining))
    setTimerReady(false)
    setTimerFinished(false)
    requestAnimationFrame(() => {
      timeInput.current?.focus()
      timeInput.current?.select()
    })
  }
  const remaining = timerRemaining(timer, now)

  const widgets: Record<WidgetId, ReactNode> = {
    activity: (
      <StudioActivity
        poll={poll}
        contest={contest}
        controls={activityControls}
        onNavigate={onNavigate}
      />
    ),
    timer: (
      <form
        className="chat-rail-inline-timer"
        onSubmit={(event) => {
          event.preventDefault()
          toggleTimer()
        }}
      >
        <div className="chat-rail-time-row">
          {timerReady ? (
            <>
              <output className="chat-rail-timer" aria-label="Осталось времени">
                {clock(remaining)}
              </output>
              <RailIconButton
                label="Изменить время таймера"
                icon={<Pencil />}
                onClick={editTimer}
              />
            </>
          ) : (
            <input
              ref={timeInput}
              className="chat-rail-time-input"
              aria-label="Время таймера, часы, минуты и секунды"
              placeholder="чч:мм:сс"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={timerInput}
              onChange={(event) => {
                const input = event.currentTarget
                const raw = input.value
                const caret = input.selectionStart ?? raw.length
                const formatted = formatTimerInput(raw)
                const digitsBeforeCaret = raw
                  .slice(0, caret)
                  .replace(/\D/g, "").length
                const forwardDelete =
                  event.nativeEvent instanceof InputEvent &&
                  event.nativeEvent.inputType === "deleteContentForward"
                setTimerInput(formatted)
                setTimerFinished(false)
                if (formatted !== raw)
                  requestAnimationFrame(() => {
                    if (document.activeElement !== input) return
                    let position = 0
                    let digits = 0
                    while (
                      position < formatted.length &&
                      digits < digitsBeforeCaret
                    ) {
                      if (/\d/.test(formatted[position])) digits++
                      position++
                    }
                    if (
                      formatted[position] === ":" &&
                      (forwardDelete || raw[caret - 1] === ":")
                    )
                      position++
                    input.setSelectionRange(position, position)
                  })
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  if (!event.repeat) event.currentTarget.form?.requestSubmit()
                }
              }}
            />
          )}
          <span className="sr-only" role="status">
            {timerFinished
              ? "Таймер завершён"
              : timerReady
                ? timer.deadline === null
                  ? "Таймер приостановлен"
                  : "Таймер запущен"
                : ""}
          </span>
        </div>
        {timerOptions.progress && timerReady && (
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
            type="submit"
            aria-label={
              timer.deadline !== null
                ? "Пауза"
                : timerReady
                  ? "Продолжить таймер"
                  : "Запустить таймер"
            }
            disabled={!timerReady && parsedDuration === null}
          >
            {timer.deadline !== null ? "Пауза" : timerReady ? "Далее" : "Старт"}
          </button>
          <button
            className="chat-rail-add-time"
            type="button"
            disabled={!timerReady}
            onClick={() => {
              const current = Date.now()
              setNow(current)
              setTimer((value) => extendTimer(value, 30, current))
            }}
          >
            +30 с
          </button>
          <button
            type="button"
            className="chat-rail-icon-button"
            aria-label={
              timerOptions.sound
                ? "Выключить звук таймера"
                : "Включить звук таймера"
            }
            aria-pressed={timerOptions.sound}
            onClick={() => {
              const sound = !timerOptions.sound
              if (sound) void chime.prepare()
              setTimerOptions((current) => ({ ...current, sound }))
            }}
          >
            {timerOptions.sound ? <Volume2 /> : <VolumeX />}
          </button>
          <RailIconButton
            label="Сбросить таймер"
            icon={<RotateCcw />}
            onClick={clearTimer}
            disabled={!timerReady && !timerInput}
          />
        </div>
      </form>
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
    notes: <StreamerNotes task={false} controller={notes} />,
    todos: <StreamerNotes task controller={notes} />,
    archive: (
      <div className="chat-rail-archive-summary">
        <div className="chat-rail-archive-total">
          <strong>{summary ? summary.count.toLocaleString("ru") : "—"}</strong>
          <span>{messageCountLabel(summary?.count || 0)}</span>
        </div>
        {summary && (
          <span className="chat-rail-archive-bytes">
            {(summary.storageBytes / 1024 / 1024).toLocaleString("ru", {
              maximumFractionDigits: 1,
            })}{" "}
            МБ
          </span>
        )}
      </div>
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
  }
  const visibleOrder = normalizeWidgetOrder(order)
  const renderBlock = (id: WidgetId) => (
    <>
      {id !== "notes" && id !== "todos" && (
        <div className="chat-rail-heading">
          <h2>
            {id === "timer" ? (
              <Timer aria-hidden="true" />
            ) : id === "counter" ? (
              <Hash aria-hidden="true" />
            ) : id === "activity" ? (
              <Activity aria-hidden="true" />
            ) : id === "archive" ? (
              <HardDrive aria-hidden="true" />
            ) : null}
            {id === "timer"
              ? timerOptions.label || "Таймер"
              : id === "counter"
                ? counter.label || "Счётчик"
                : titles[id]}
          </h2>
          {id === "archive" ? (
            <ChatArchiveControls
              key={channelId}
              channelId={channelId}
              summary={summary}
              onCleanup={onArchiveCleanup}
            />
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
      )}
      {widgets[id]}
    </>
  )
  return (
    <ArrangeableRail
      order={visibleOrder}
      onOrderChange={onOrderChange}
      blocksAction={blocksAction}
      renderBlock={renderBlock}
    />
  )
}

const sortableTransition = {
  duration: 220,
  easing: "cubic-bezier(.16,1,.3,1)",
}

/** Long presses on text fields keep their native behaviour (selection, caret). */
function startsOnTextField(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "input, textarea, select, [contenteditable=''], [contenteditable='true']"
      )
    )
  )
}

function ArrangeableRail({
  order,
  onOrderChange,
  blocksAction,
  renderBlock,
}: {
  order: WidgetId[]
  onOrderChange: Dispatch<SetStateAction<WidgetId[]>>
  /** Receives a callback that enters the block arrangement mode. */
  blocksAction: (arrange: () => void) => ReactNode
  renderBlock: (id: WidgetId) => ReactNode
}) {
  const reduced = useReducedMotion()
  const rail = useRef<HTMLElement>(null)
  const [arrangeRequested, setArranging] = useState(false)
  const [dragging, setDragging] = useState<WidgetId | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const sortable: WidgetId[] = order.filter((id) => id !== "activity")
  // Nothing left to sort: leave the mode instead of keeping an empty edit state.
  const arranging = arrangeRequested && sortable.length > 0
  // Outside the arrangement mode a block is picked up only after a long press,
  // like the iPhone home screen; inside it any short drag moves a block.
  const mouse = useMemo(
    () => ({
      activationConstraint: arranging
        ? { distance: 4 }
        : { delay: 450, tolerance: 6 },
    }),
    [arranging]
  )
  const touch = useMemo(
    () => ({
      activationConstraint: arranging
        ? { delay: 90, tolerance: 8 }
        : { delay: 450, tolerance: 8 },
    }),
    [arranging]
  )
  const sensors = useSensors(
    useSensor(MouseSensor, mouse),
    useSensor(TouchSensor, touch),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const finish = () => {
    setArranging(false)
    setDragging(null)
  }
  const exitOnOutsidePress = useEffectEvent((event: PointerEvent) => {
    const target = event.target as Node | null
    if (dragging || !target) return
    if (target === rail.current || !rail.current?.contains(target)) finish()
  })
  const exitOnEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && !dragging) {
      event.preventDefault()
      finish()
    }
  })
  // Entering the mode from the menu moves keyboard focus onto the first block.
  useEffect(() => {
    if (focusRequest)
      rail.current
        ?.querySelector<HTMLElement>(".chat-rail-block[data-sortable]")
        ?.focus()
  }, [focusRequest])
  useEffect(() => {
    if (!arranging) return
    const press = (event: PointerEvent) => exitOnOutsidePress(event)
    const key = (event: KeyboardEvent) => exitOnEscape(event)
    document.addEventListener("pointerdown", press, true)
    document.addEventListener("keydown", key)
    return () => {
      document.removeEventListener("pointerdown", press, true)
      document.removeEventListener("keydown", key)
    }
  }, [arranging])
  const label = (id: string | number) => titles[id as WidgetId] || "Блок"
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Нажмите пробел, чтобы взять блок. Стрелки меняют место. Пробел подтверждает, Escape отменяет.",
        },
        announcements: {
          onDragStart: ({ active }) =>
            `${label(active.id)}: перенос. Используйте стрелки.`,
          onDragOver: ({ active, over }) =>
            over
              ? `${label(active.id)}: позиция ${sortable.indexOf(over.id as WidgetId) + 1} из ${sortable.length}.`
              : "За пределами списка. Отпустите для отмены.",
          onDragEnd: ({ over }) =>
            over ? "Порядок блоков сохранён." : "Перенос отменён.",
          onDragCancel: () => "Перенос отменён.",
        },
      }}
      onDragStart={({ active }) => {
        setArranging(true)
        setDragging(active.id as WidgetId)
      }}
      onDragCancel={() => setDragging(null)}
      onDragEnd={({ active, over }) => {
        setDragging(null)
        if (over && active.id !== over.id)
          onOrderChange((current) =>
            reorderDashboardBlock(
              current,
              active.id as WidgetId,
              over.id as WidgetId
            )
          )
      }}
    >
      <aside
        ref={rail}
        className="chat-home-rail"
        aria-label="Инструменты стримера"
        data-arranging={arranging || undefined}
        data-dragging={dragging ? true : undefined}
      >
        <div className="studio-rail-toolbar">
          {arranging ? (
            <div className="studio-arrange-bar" role="status">
              <span>Перетащите блоки</span>
              <button type="button" onClick={finish}>
                Готово
              </button>
            </div>
          ) : (
            blocksAction(() => {
              setArranging(true)
              setFocusRequest((value) => value + 1)
            })
          )}
        </div>
        <SortableContext items={sortable} strategy={rectSortingStrategy}>
          {order.map((id) =>
            id === "activity" ? (
              <section
                key={id}
                className="chat-rail-block"
                data-widget={id}
                data-pinned={arranging || undefined}
              >
                <div className="chat-rail-block-body" inert={arranging}>
                  {renderBlock(id)}
                </div>
              </section>
            ) : (
              <SortableRailBlock
                key={id}
                id={id}
                arranging={arranging}
                reduced={reduced}
                onRemove={() => {
                  if (sortable.length === 1) finish()
                  onOrderChange((current) =>
                    current.filter((item) => item !== id)
                  )
                }}
              >
                {renderBlock(id)}
              </SortableRailBlock>
            )
          )}
        </SortableContext>
      </aside>
    </DndContext>
  )
}

function SortableRailBlock({
  id,
  arranging,
  reduced,
  onRemove,
  children,
}: {
  id: WidgetId
  arranging: boolean
  reduced: boolean
  onRemove: () => void
  children: ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: reduced ? null : sortableTransition })
  return (
    <section
      ref={setNodeRef}
      className="chat-rail-block"
      data-widget={id}
      data-sortable
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...(arranging
        ? {
            ...attributes,
            "aria-label": `${titles[id]}: переместить`,
            onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) =>
              listeners?.onKeyDown?.(event),
          }
        : {})}
      onMouseDown={(event) => {
        if (!arranging && startsOnTextField(event.target)) return
        listeners?.onMouseDown?.(event)
      }}
      onTouchStart={(event) => {
        if (!arranging && startsOnTextField(event.target)) return
        listeners?.onTouchStart?.(event)
      }}
      onContextMenu={(event) => {
        if (!startsOnTextField(event.target)) event.preventDefault()
      }}
    >
      {arranging && (
        <button
          type="button"
          className="chat-rail-remove"
          aria-label={`Убрать блок ${titles[id]}`}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={onRemove}
        >
          <Minus aria-hidden="true" />
        </button>
      )}
      <div className="chat-rail-block-body" inert={arranging}>
        {children}
      </div>
    </section>
  )
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
