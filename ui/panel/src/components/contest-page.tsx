import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crown,
  ExternalLink,
  Hash,
  MessageCircle,
  MessagesSquare,
  RotateCcw,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react"
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import {
  FormDuration,
  FormField,
  FormSegmented,
  FormStack,
  FormSwitch,
} from "@/components/form-controls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import type {
  Contest,
  ContestAudienceRole,
  ContestParticipant,
  ContestSetup,
} from "@/domain/contest"
import type { ContestController } from "@/hooks/use-contest-controller"
import { useDemoMode } from "@/hooks/use-demo-mode"

const formatTimer = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

const formatMessageTime = (value: number) =>
  new Intl.DateTimeFormat("ru", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value)

export function ContestPage({
  twitchConnected,
  controller,
}: {
  twitchConnected: boolean
  controller: ContestController
}) {
  const { enabled: demoEnabled } = useDemoMode()
  const showToast = useToast()
  const [setup, setSetup] = useState<ContestSetup>({
    mode: "keyword",
    keyword: "",
    antiSpam: false,
    allowedRoles: ["viewer", "subscriber", "vip", "moderator"],
    duration: 60,
    source: "twitch",
  })
  const [validation, setValidation] = useState(false)
  const contest = controller.contest

  useEffect(() => {
    if (controller.error)
      showToast({ message: controller.error, tone: "error" })
  }, [controller.error, showToast])

  if (!controller.state)
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Подключение…
      </div>
    )

  const activeContest = contest?.status === "finished" ? null : contest

  const start = () => {
    const keyword = setup.keyword.trim()
    if (
      (setup.mode === "keyword" && (!keyword || /\s/u.test(keyword))) ||
      setup.duration < 10 ||
      setup.duration > 3600 ||
      setup.allowedRoles.length === 0
    ) {
      setValidation(true)
      showToast({
        message:
          setup.mode === "keyword" && !keyword
            ? "Добавьте слово для участия."
            : setup.mode === "keyword" && /\s/u.test(keyword)
              ? "Слово должно быть без пробелов."
              : setup.allowedRoles.length === 0
                ? "Выберите хотя бы одну группу зрителей."
                : "Укажите время от 10 до 3600 секунд.",
        tone: "error",
      })
      return
    }
    if (setup.source === "twitch" && !twitchConnected) {
      showToast({
        message: "Сначала подключите Twitch через профиль.",
        tone: "warning",
      })
      return
    }
    setValidation(false)
    void controller.start({ ...setup, keyword })
  }

  return (
    <ContestConsole
      contest={activeContest}
      setup={setup}
      busy={controller.busy}
      serverNow={controller.state.serverNow}
      twitchConnected={twitchConnected}
      demoEnabled={demoEnabled}
      validation={validation}
      onSetupChange={setSetup}
      onStart={start}
      onClose={() => void controller.close()}
      onDraw={() => void controller.draw()}
      onReset={() => void controller.reset()}
      onClear={() => void controller.clearEligibility()}
      onEligibility={(participantId, eligible) =>
        void controller.setEligibility(participantId, eligible)
      }
    />
  )
}

function ContestConsole({
  contest,
  setup,
  busy,
  serverNow,
  twitchConnected,
  demoEnabled,
  validation,
  onSetupChange,
  onStart,
  onClose,
  onDraw,
  onReset,
  onClear,
  onEligibility,
}: {
  contest: Contest | null
  setup: ContestSetup
  busy: boolean
  serverNow: number
  twitchConnected: boolean
  demoEnabled: boolean
  validation: boolean
  onSetupChange: (setup: ContestSetup) => void
  onStart: () => void
  onClose: () => void
  onDraw: () => void
  onReset: () => void
  onClear: () => void
  onEligibility: (participantId: string, eligible: boolean) => void
}) {
  const reveal = useWinnerReveal(contest)

  return (
    <section className="contest-console h-full min-h-0" aria-label="Конкурсы">
      <main
        className={`contest-console-control min-w-0 px-6 py-7 ${contest ? "lg:min-h-0 lg:overflow-hidden" : "lg:min-h-0 lg:overflow-y-auto"}`}
      >
        {contest ? (
          <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-col lg:h-full">
            <ContestControls
              contest={contest}
              busy={busy}
              serverNow={serverNow}
              onClose={onClose}
              onReset={onReset}
            />
            <ContestPool
              contest={contest}
              busy={busy}
              onDraw={onDraw}
              onClear={onClear}
              onEligibility={onEligibility}
            />
          </div>
        ) : (
          <ContestSetupPanel
            setup={setup}
            busy={busy}
            twitchConnected={twitchConnected}
            demoEnabled={demoEnabled}
            validation={validation}
            onChange={onSetupChange}
            onStart={onStart}
          />
        )}
      </main>
      <ContestChat
        contest={contest}
        winnerName={reveal.name}
        drawing={reveal.drawing}
      />
    </section>
  )
}

function ContestSetupPanel({
  setup,
  busy,
  twitchConnected,
  demoEnabled,
  validation,
  onChange,
  onStart,
}: {
  setup: ContestSetup
  busy: boolean
  twitchConnected: boolean
  demoEnabled: boolean
  validation: boolean
  onChange: (setup: ContestSetup) => void
  onStart: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const keywordId = useId()
  const roleOptions: ReadonlyArray<{
    value: ContestAudienceRole
    label: string
  }> = [
    { value: "viewer", label: "Зрители" },
    { value: "subscriber", label: "Подписчики" },
    { value: "vip", label: "VIP" },
    { value: "moderator", label: "Модераторы" },
  ]

  const setRole = (role: ContestAudienceRole) => {
    const selected = setup.allowedRoles.includes(role)
    onChange({
      ...setup,
      allowedRoles: selected
        ? setup.allowedRoles.filter((value) => value !== role)
        : [...setup.allowedRoles, role],
    })
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col">
      <div
        className="mb-7 flex items-center justify-between"
        aria-label={`Шаг ${step} из 3`}
      >
        <span className="text-xs font-medium text-muted-foreground">
          Шаг {step} из 3
        </span>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((item) => (
            <span
              key={item}
              className={`size-1.5 rounded-full transition-colors ${item === step ? "bg-brand" : "bg-muted-foreground/25"}`}
            />
          ))}
        </span>
      </div>

      <div className="flex-1">
        {step === 1 && (
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.02em]">
              Как зрители будут участвовать?
            </h1>
            <div className="mt-5 space-y-3">
              <ContestTypeCard
                icon={<MessagesSquare />}
                title="Активные зрители"
                description="Участником станет каждый, кто напишет в чат."
                selected={setup.mode === "active"}
                onClick={() => onChange({ ...setup, mode: "active" })}
              />
              <ContestTypeCard
                icon={<Hash />}
                title="Ключевое слово"
                description="В конкурс попадут зрители с точным совпадением."
                selected={setup.mode === "keyword"}
                onClick={() => onChange({ ...setup, mode: "keyword" })}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.02em]">
              Кто может участвовать?
            </h1>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {roleOptions.map((role) => {
                const selected = setup.allowedRoles.includes(role.value)
                return (
                  <button
                    key={role.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setRole(role.value)}
                    className={`flex min-h-14 items-center gap-3 rounded-xl px-4 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${selected ? "bg-brand/12 text-foreground" : "bg-surface-subtle text-muted-foreground hover:bg-surface-raised"}`}
                  >
                    <span
                      className={`flex size-5 items-center justify-center rounded-md border ${selected ? "text-brand-foreground border-brand bg-brand" : "border-border"}`}
                    >
                      {selected && <Check className="size-3.5" />}
                    </span>
                    {role.label}
                  </button>
                )
              })}
            </div>
            {validation && setup.allowedRoles.length === 0 && (
              <p className="mt-3 text-xs text-destructive">
                Выберите хотя бы одну группу.
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.02em]">
              Настройте конкурс
            </h1>
            <FormStack className="mt-5">
              {setup.mode === "keyword" && (
                <FormField label="Ключевое слово" htmlFor={keywordId}>
                  <Input
                    id={keywordId}
                    autoFocus
                    value={setup.keyword}
                    maxLength={32}
                    placeholder="участвую"
                    aria-invalid={
                      validation &&
                      (!setup.keyword.trim() || /\s/u.test(setup.keyword))
                        ? true
                        : undefined
                    }
                    className="font-mono"
                    onChange={(event) =>
                      onChange({ ...setup, keyword: event.target.value })
                    }
                  />
                </FormField>
              )}

              <FormDuration
                value={setup.duration}
                invalid={
                  validation && (setup.duration < 10 || setup.duration > 3600)
                }
                disabled={busy}
                onChange={(duration) => onChange({ ...setup, duration })}
              />

              {setup.mode === "keyword" && (
                <div className="rounded-xl bg-surface-subtle px-4 py-1">
                  <FormSwitch
                    label="Исключать за повтор"
                    checked={setup.antiSpam}
                    disabled={busy}
                    onCheckedChange={(antiSpam) =>
                      onChange({ ...setup, antiSpam })
                    }
                  />
                </div>
              )}

              {demoEnabled && (
                <FormSegmented
                  label="Источник"
                  value={setup.source}
                  options={[
                    ["twitch", "Twitch"],
                    ["test", "Демо"],
                  ]}
                  disabled={busy}
                  onChange={(source) =>
                    onChange({
                      ...setup,
                      source: source as ContestSetup["source"],
                    })
                  }
                />
              )}

              {!demoEnabled && !twitchConnected && (
                <p className="text-xs text-muted-foreground">
                  Подключите Twitch через профиль перед запуском.
                </p>
              )}
            </FormStack>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          disabled={step === 1 || busy}
          onClick={() => setStep((step - 1) as 1 | 2 | 3)}
        >
          <ArrowLeft /> Назад
        </Button>
        {step < 3 ? (
          <Button
            disabled={busy || (step === 2 && setup.allowedRoles.length === 0)}
            onClick={() => setStep((step + 1) as 1 | 2 | 3)}
          >
            Далее <ArrowRight />
          </Button>
        ) : (
          <Button disabled={busy} onClick={onStart}>
            {busy ? "Запуск…" : "Готово"}
          </Button>
        )}
      </div>
    </div>
  )
}

function ContestTypeCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: ReactNode
  title: string
  description: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-20 w-full items-center gap-4 rounded-xl p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${selected ? "bg-brand/12" : "bg-surface-subtle hover:bg-surface-raised"}`}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-brand/16 text-brand" : "bg-surface-raised text-muted-foreground"}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${selected ? "text-brand-foreground border-brand bg-brand" : "border-border"}`}
      >
        {selected && <Check className="size-3.5" />}
      </span>
    </button>
  )
}

function ContestControls({
  contest,
  busy,
  serverNow,
  onClose,
  onReset,
}: {
  contest: Contest
  busy: boolean
  serverNow: number
  onClose: () => void
  onReset: () => void
}) {
  const [clock, setClock] = useState(serverNow)
  const collecting = contest.status === "collecting"
  const ready = contest.status === "ready"
  const winner = contest.status === "winner"
  const eligible = contest.participants.filter(
    (participant) => participant.eligible
  )
  const remaining = Math.max(0, Math.ceil((contest.deadline - clock) / 1000))

  useEffect(() => {
    const offset = serverNow - Date.now()
    const timer = window.setInterval(() => setClock(Date.now() + offset), 250)
    return () => window.clearInterval(timer)
  }, [serverNow])

  return (
    <div className="flex flex-col gap-6">
      {collecting && (
        <div className="flex justify-end">
          <time
            className="shrink-0 rounded-lg bg-surface-subtle px-2.5 py-1.5 font-mono text-sm font-medium text-brand tabular-nums"
            aria-label={`Осталось ${remaining} секунд`}
          >
            {formatTimer(remaining)}
          </time>
        </div>
      )}

      <div className="rounded-xl bg-surface-subtle p-1">
        <ContestFact
          label="Участие"
          value={
            contest.mode === "keyword"
              ? `Слово: ${contest.keyword}`
              : "Активные зрители"
          }
        />
        <ContestFact
          label="Допущено"
          value={`${eligible.length} из ${contest.participants.length}`}
        />
        {winner && (
          <ContestFact
            label="Выбрано"
            value={`${contest.winnerHistory.length}`}
          />
        )}
      </div>

      <div className="grid gap-2">
        {collecting && (
          <Button
            variant="outline"
            className="h-10"
            disabled={busy}
            onClick={onClose}
          >
            Остановить участие
          </Button>
        )}
        {(ready || winner) && (
          <Button
            variant="outline"
            className="h-10"
            disabled={busy}
            onClick={onReset}
          >
            Новый конкурс
          </Button>
        )}
        {collecting && (
          <Button
            variant="ghost"
            className="h-9 text-muted-foreground"
            disabled={busy}
            onClick={onReset}
          >
            Отменить
          </Button>
        )}
      </div>
    </div>
  )
}

function ContestFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 rounded-lg px-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-right text-sm font-medium">{value}</span>
    </div>
  )
}

function ContestPool({
  contest,
  busy,
  onDraw,
  onClear,
  onEligibility,
}: {
  contest: Contest | null
  busy: boolean
  onDraw: () => void
  onClear: () => void
  onEligibility: (participantId: string, eligible: boolean) => void
}) {
  const [query, setQuery] = useState("")
  const participants = useMemo(
    () => contest?.participants || [],
    [contest?.participants]
  )
  const winnerHistory = useMemo(
    () => contest?.winnerHistory || [],
    [contest?.winnerHistory]
  )
  const drawnIds = useMemo(() => new Set(winnerHistory), [winnerHistory])
  const canEdit =
    contest?.status === "collecting" || contest?.status === "ready"
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru")
    const filtered = normalized
      ? participants.filter((participant) =>
          participant.name.toLocaleLowerCase("ru").includes(normalized)
        )
      : participants
    const recentFirst = [...filtered].reverse()
    const available = recentFirst.filter(
      (participant) => !drawnIds.has(participant.id)
    )
    const drawn = winnerHistory
      .map((id) => recentFirst.find((participant) => participant.id === id))
      .filter((participant): participant is ContestParticipant => !!participant)
    return [...available, ...drawn]
  }, [drawnIds, participants, query, winnerHistory])
  const eligible = participants.filter(
    (participant) => participant.eligible
  ).length
  const available = participants.filter(
    (participant) =>
      participant.eligible && !contest?.winnerHistory.includes(participant.id)
  ).length
  const winner = contest?.status === "winner"

  return (
    <section className="contest-pool mt-6 flex min-h-0 min-w-0 flex-col rounded-2xl bg-surface-subtle p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Участники</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {eligible} допущено
          </p>
        </div>
        {participants.length > 0 && canEdit && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={onClear}>
            Сбросить
          </Button>
        )}
      </div>

      <label className="mt-4 flex h-9 items-center gap-2 rounded-lg bg-panel-muted px-2.5 focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти"
          aria-label="Найти участника"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="mt-3 min-h-48 flex-1 space-y-1 overflow-y-auto overscroll-contain lg:min-h-0">
        {visible.length ? (
          visible.map((participant) => (
            <ParticipantRow
              key={participant.id}
              participant={participant}
              drawn={drawnIds.has(participant.id)}
              disabled={!canEdit || busy}
              onChange={(eligible) => onEligibility(participant.id, eligible)}
            />
          ))
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center text-center">
            <Users className="size-5 text-muted-foreground" />
            <p className="mt-3 text-sm">
              {query ? "Никого не найдено" : "Пока никого"}
            </p>
            {!query && (
              <p className="mt-1 max-w-48 text-xs text-muted-foreground">
                Зрители появятся после сообщения в чате
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-panel-muted p-2">
        <Button
          className="h-11 w-full"
          disabled={!contest || busy || available === 0}
          onClick={onDraw}
        >
          {winner ? <RotateCcw /> : <UserRound />}
          {winner ? "Выбрать другого" : "Выбрать победителя"}
        </Button>
        <p className="mt-2 pb-1 text-center text-xs text-muted-foreground">
          Доступно для выбора: {available}
        </p>
      </div>
    </section>
  )
}

function ParticipantRow({
  participant,
  drawn,
  disabled,
  onChange,
}: {
  participant: ContestParticipant
  drawn: boolean
  disabled: boolean
  onChange: (eligible: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={participant.eligible}
      aria-label={`${participant.name}${drawn ? ", уже выбран" : ""}`}
      disabled={disabled || drawn}
      onClick={() => onChange(!participant.eligible)}
      className={`group flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none ${drawn ? "text-muted-foreground opacity-45" : "hover:bg-surface-raised"}`}
    >
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${drawn ? "border-border text-muted-foreground" : participant.eligible ? "border-brand/40 bg-brand/12 text-brand" : "border-border text-muted-foreground"}`}
      >
        {drawn ? (
          <Crown className="size-3" />
        ) : participant.eligible ? (
          <Check className="size-3" />
        ) : (
          <X className="size-3" />
        )}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-sm ${drawn ? "text-muted-foreground" : participant.eligible ? "font-medium" : "text-muted-foreground line-through decoration-muted-foreground/40"}`}
      >
        {participant.name}
      </span>
      {participant.excludedReason === "repeat" && (
        <span className="text-[11px] text-muted-foreground">повтор</span>
      )}
    </button>
  )
}

function ContestChat({
  contest,
  winnerName,
  drawing,
}: {
  contest: Contest | null
  winnerName: string
  drawing: boolean
}) {
  const messageListRef = useRef<HTMLDivElement>(null)
  const shouldFollowRef = useRef(true)
  const winner = contest?.status === "winner" ? contest.winner : null
  const messages = winner
    ? contest?.winnerMessages.map((message) => ({
        ...message,
        name: winner.name,
      })) || []
    : (contest?.participants || []).map((participant) => ({
        id: participant.messageId,
        text: participant.message,
        at: participant.joinedAt,
        name: participant.name,
      }))
  const lastMessageId = messages.at(-1)?.id

  useLayoutEffect(() => {
    const list = messageListRef.current
    if (!list || !shouldFollowRef.current) return
    list.scrollTop = list.scrollHeight
  }, [lastMessageId])

  return (
    <aside className="contest-console-chat flex min-h-0 min-w-0 flex-col rounded-2xl bg-panel-muted px-5 py-6">
      {winner && (
        <div className="relative rounded-xl bg-brand/8 px-4 py-4 text-center">
          {contest?.source === "twitch" && (
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3"
            >
              <a
                href={`https://twitch.tv/${encodeURIComponent(winner.login || winner.name)}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Открыть канал победителя"
              >
                <ExternalLink />
              </a>
            </Button>
          )}
          <Crown className="mx-auto size-5 text-brand" />
          <div
            className={`mt-2 truncate text-xl font-semibold tracking-[-0.03em] transition-all ${drawing ? "scale-[.98] opacity-60 blur-[1px]" : "scale-100 opacity-100"}`}
          >
            {winnerName || winner.name}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Победитель</div>
        </div>
      )}

      <div
        ref={messageListRef}
        className={`${winner ? "mt-4" : ""} contest-chat-messages min-h-56 flex-1 space-y-1 overflow-y-auto overscroll-contain lg:min-h-0`}
        onScroll={(event) => {
          const list = event.currentTarget
          shouldFollowRef.current =
            list.scrollHeight - list.scrollTop - list.clientHeight < 72
        }}
      >
        {messages.length ? (
          messages.slice(-100).map((message) => (
            <div key={message.id} className="flex gap-3 rounded-lg px-2 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-semibold">
                {message.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-xs font-medium">
                    {message.name}
                  </span>
                  <time className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {formatMessageTime(message.at)}
                  </time>
                </div>
                <p className="mt-0.5 text-sm break-words text-muted-foreground">
                  {message.text}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center text-center">
            <MessageCircle className="size-5 text-muted-foreground" />
            <p className="mt-3 text-sm">Чат пока пуст</p>
            <p className="mt-1 max-w-48 text-xs text-muted-foreground">
              Здесь останутся сообщения участников
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}

function useWinnerReveal(contest: Contest | null) {
  const [name, setName] = useState("")
  const [drawing, setDrawing] = useState(false)
  const previousWinner = useRef<string | null>(null)
  const timers = useRef<{
    start?: number
    spin?: number
    finish?: number
  }>({})

  useEffect(
    () => () => {
      window.clearTimeout(timers.current.start)
      window.clearInterval(timers.current.spin)
      window.clearTimeout(timers.current.finish)
    },
    []
  )

  useEffect(() => {
    if (!contest?.winner) {
      previousWinner.current = null
      return
    }
    if (contest.winner.id === previousWinner.current) return
    previousWinner.current = contest.winner.id
    window.clearTimeout(timers.current.start)
    window.clearInterval(timers.current.spin)
    window.clearTimeout(timers.current.finish)
    const winnerName = contest.winner.name
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      contest.participants.length < 2
    ) {
      timers.current.start = window.setTimeout(() => {
        setName(winnerName)
        setDrawing(false)
      }, 0)
      return
    }

    timers.current.start = window.setTimeout(() => {
      setName(winnerName)
      setDrawing(true)
    }, 0)
    let step = 0
    timers.current.spin = window.setInterval(() => {
      setName(contest.participants[step % contest.participants.length].name)
      step += 1
      if (step >= 18) {
        window.clearInterval(timers.current.spin)
        setName(winnerName)
        timers.current.finish = window.setTimeout(() => setDrawing(false), 240)
      }
    }, 92)
  }, [contest])

  return { name, drawing }
}
