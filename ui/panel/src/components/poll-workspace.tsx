import { ArrowRight, BookmarkPlus, Plus, X } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

import { PollDraftFields } from "@/components/poll-draft-fields"
import { PollTimer, Keyword } from "@/components/poll-results"
import {
  SplitWorkspace,
  WorkspaceContent,
  WorkspacePane,
} from "@/components/page-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FormActions,
  FormSegmented,
  FormSwitch,
} from "@/components/form-controls"
import { useToast } from "@/components/ui/toast"
import { useDemoMode } from "@/hooks/use-demo-mode"
import type {
  CommandResult,
  Draft,
  Poll,
  PollOption,
  VoteActivity,
} from "@/domain/polls"
import { percentages, pluralVotes, validateDraft } from "@/domain/polls"

type PollWorkspaceProps = {
  poll: Poll | null
  draft: Draft
  connected: boolean
  busy: boolean
  twitchPhase: string
  onChangeDraft: (update: (current: Draft) => Draft) => void
  onStart: () => void
  onClear: () => void
  onSetOutput: (visible: boolean) => void
  onRun: (
    type: string,
    data?: Record<string, unknown>
  ) => Promise<CommandResult | null>
  onVote: (option: PollOption) => void
  onSimulate: () => void
  onSaveAsPreset: (draft: Draft) => void
  canCreatePreset: boolean
}

export function PollWorkspace({
  poll,
  draft,
  connected,
  busy,
  twitchPhase,
  onChangeDraft,
  onStart,
  onClear,
  onSetOutput,
  onRun,
  onVote,
  onSimulate,
  onSaveAsPreset,
  canCreatePreset,
}: PollWorkspaceProps) {
  const showChat =
    !!poll && (poll.source === "twitch" || poll.status === "running")

  return (
    <SplitWorkspace
      aria-label="Опросы"
      className={
        showChat
          ? "lg:grid-cols-[minmax(0,1fr)_minmax(300px,.65fr)]"
          : "lg:grid-cols-1"
      }
    >
      <WorkspacePane>
        <WorkspaceContent className={poll ? "max-w-3xl" : "max-w-5xl"}>
          {poll ? (
            <ActivePoll
              poll={poll}
              busy={busy}
              onSetOutput={onSetOutput}
              onRun={onRun}
              onVote={onVote}
              onSimulate={onSimulate}
              onClear={onClear}
              onSaveAsPreset={onSaveAsPreset}
              canCreatePreset={canCreatePreset}
            />
          ) : (
            <PollComposer
              draft={draft}
              connected={connected}
              busy={busy}
              twitchPhase={twitchPhase}
              onChange={onChangeDraft}
              onSetOutput={onSetOutput}
              onStart={onStart}
              onSaveAsPreset={onSaveAsPreset}
              canCreatePreset={canCreatePreset}
            />
          )}
        </WorkspaceContent>
      </WorkspacePane>

      {showChat && (
        <WorkspacePane className="bg-sidebar">
          <WorkspaceContent>
            <ChatVoteFeed current={poll} />
          </WorkspaceContent>
        </WorkspacePane>
      )}
    </SplitWorkspace>
  )
}

function PollComposer({
  draft,
  connected,
  busy,
  twitchPhase,
  onChange,
  onSetOutput,
  onStart,
  onSaveAsPreset,
  canCreatePreset,
}: {
  draft: Draft
  connected: boolean
  busy: boolean
  twitchPhase: string
  onChange: PollWorkspaceProps["onChangeDraft"]
  onSetOutput: (visible: boolean) => void
  onStart: () => void
  onSaveAsPreset: (draft: Draft) => void
  canCreatePreset: boolean
}) {
  const { enabled: demoEnabled } = useDemoMode()
  const showToast = useToast()
  const [showValidation, setShowValidation] = useState(false)
  const composerRef = useRef<HTMLDivElement>(null)
  const draftError = validateDraft(draft)
  const twitchUnavailable =
    draft.source === "twitch" && twitchPhase !== "connected"
  const startIssue = !connected
    ? "Нет связи с локальным сервером."
    : draftError
      ? draftError
      : twitchUnavailable
        ? "Подключите Twitch через профиль."
        : ""

  return (
    <div ref={composerRef} className="space-y-7">
      <PollDraftFields
        draft={draft}
        idPrefix="poll"
        showValidation={showValidation}
        onChange={onChange}
        extraSettings={
          <div className="grid gap-5">
            {demoEnabled && (
              <FormSegmented
                label="Голоса"
                value={draft.source}
                options={[
                  ["twitch", "Twitch"],
                  ["test", "Демо"],
                ]}
                disabled={busy}
                onChange={(source) =>
                  onChange((item) => ({
                    ...item,
                    source: source as Draft["source"],
                  }))
                }
              />
            )}

            <FormSegmented
              label="Виджет в OBS"
              value={draft.showOverlay ? "stream" : "panel"}
              options={[
                ["stream", "Включён"],
                ["panel", "Скрыт"],
              ]}
              disabled={busy}
              onChange={(value) => onSetOutput(value === "stream")}
            />
          </div>
        }
        actions={
          <FormActions
            secondary={
              <Button
                variant="secondary"
                size="icon"
                className="size-11"
                disabled={busy || !canCreatePreset}
                aria-label="Сохранить как шаблон"
                onClick={() => onSaveAsPreset(structuredClone(draft))}
              >
                <BookmarkPlus />
              </Button>
            }
            primary={
              <Button
                className="h-11 w-full text-[15px]"
                disabled={busy}
                onClick={() => {
                  if (draftError) {
                    setShowValidation(true)
                    requestAnimationFrame(() => {
                      composerRef.current
                        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
                        ?.focus()
                    })
                    showToast({ message: draftError, tone: "error" })
                    return
                  }
                  if (startIssue) {
                    showToast({
                      message: startIssue,
                      tone: twitchUnavailable ? "warning" : "error",
                    })
                    return
                  }
                  setShowValidation(false)
                  onStart()
                }}
              >
                {busy ? "Запуск…" : "Запустить опрос"}
              </Button>
            }
          />
        }
      />
    </div>
  )
}

function ActivePoll({
  poll,
  busy,
  onSetOutput,
  onRun,
  onVote,
  onSimulate,
  onClear,
  onSaveAsPreset,
  canCreatePreset,
}: {
  poll: Poll
  busy: boolean
  onSetOutput: (visible: boolean) => void
  onRun: PollWorkspaceProps["onRun"]
  onVote: (option: PollOption) => void
  onSimulate: () => void
  onClear: () => void
  onSaveAsPreset: (draft: Draft) => void
  canCreatePreset: boolean
}) {
  const running = poll.status === "running"
  const instanceId = useId()
  const total = poll.options.reduce((sum, option) => sum + option.votes, 0)
  const hiddenResults = poll.secret && running
  const share = percentages(poll.options)
  const maximum = Math.max(0, ...poll.options.map((option) => option.votes))
  const showToast = useToast()
  const [addingOption, setAddingOption] = useState(false)
  const [optionName, setOptionName] = useState("")
  const [optionWord, setOptionWord] = useState("")
  const [showOptionValidation, setShowOptionValidation] = useState(false)
  const normalizedWord = optionWord
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ru")
  const optionIssue = !optionName.trim()
    ? "Добавьте название варианта."
    : !normalizedWord || /\s/u.test(normalizedWord)
      ? "Ключевое слово должно быть без пробелов."
      : poll.options.some((option) => option.word === normalizedWord)
        ? "Такое ключевое слово уже используется."
        : ""

  const addOption = async () => {
    if (optionIssue) {
      setShowOptionValidation(true)
      showToast({ message: optionIssue, tone: "error" })
      return
    }
    const result = await onRun("option-add", {
      pollId: poll.id,
      name: optionName,
      word: optionWord,
    })
    if (!result) return
    setOptionName("")
    setOptionWord("")
    setShowOptionValidation(false)
    setAddingOption(false)
    showToast({
      message: "Вариант добавлен · переголосование включено · минимум 30 сек",
      tone: "success",
    })
  }

  return (
    <div>
      <div className="mb-7 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`size-2 shrink-0 rounded-full ${running ? "bg-brand" : "bg-muted-foreground/60"}`}
          />
          <span className="truncate text-sm font-medium">
            {running ? "Опрос идёт" : "Опрос завершён"}
          </span>
          <SourceChip source={poll.source} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PollTimer poll={poll} />
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            disabled={busy || !canCreatePreset}
            aria-label="Сохранить как шаблон"
            onClick={() =>
              onSaveAsPreset({
                question: poll.question,
                options: poll.options.map(({ id, name, word }) => ({
                  id,
                  name,
                  word,
                })),
                duration: poll.duration,
                secret: poll.secret,
                allowChange: poll.allowChange,
                showOverlay: poll.visible,
                source: poll.source,
              })
            }
          >
            <BookmarkPlus />
          </Button>
        </div>
      </div>

      <h2 className="mb-6 text-2xl leading-snug font-semibold tracking-tight text-balance">
        {poll.question}
      </h2>
      <div className="space-y-2.5">
        {poll.options.map((option, index) => (
          <div
            key={option.id}
            className="relative isolate overflow-hidden rounded-xl bg-surface-subtle"
          >
            <div
              className="absolute inset-y-0 left-0 -z-10 bg-brand/8 transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${hiddenResults ? 0 : share[index]}%` }}
            />
            <div className="flex min-h-16 items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {option.name}
                </div>
                <div className="mt-1">
                  <Keyword>{option.word}</Keyword>
                </div>
              </div>
              <div
                className={`text-right tabular-nums ${!hiddenResults && maximum > 0 && option.votes === maximum ? "text-brand" : "text-muted-foreground"}`}
              >
                <div className="text-base font-semibold">
                  {hiddenResults ? "—" : `${share[index]}%`}
                </div>
                <div className="text-xs">
                  {hiddenResults ? "" : pluralVotes(option.votes)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex min-h-8 items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {pluralVotes(total)}
        </span>
        {running && poll.options.length < 6 && !addingOption && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            disabled={busy}
            onClick={() => setAddingOption(true)}
          >
            <Plus />
            Добавить вариант
          </Button>
        )}
      </div>

      {running && addingOption && (
        <div className="mt-3 animate-in rounded-xl bg-surface-subtle p-2.5 duration-200 fade-in slide-in-from-top-1">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,.9fr)_auto_auto]">
            <Input
              autoFocus
              value={optionName}
              maxLength={40}
              placeholder="Новый вариант"
              aria-label="Название нового варианта"
              aria-invalid={
                showOptionValidation && !optionName.trim() ? true : undefined
              }
              onChange={(event) => setOptionName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void addOption()}
            />
            <Input
              value={optionWord}
              maxLength={24}
              placeholder="слово"
              aria-label="Ключевое слово нового варианта"
              aria-invalid={
                showOptionValidation && !!optionIssue && !!optionName.trim()
                  ? true
                  : undefined
              }
              className="font-mono text-xs"
              onChange={(event) => setOptionWord(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void addOption()}
            />
            <Button
              size="sm"
              className="h-8 px-3"
              disabled={busy}
              onClick={() => void addOption()}
            >
              Добавить
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={busy}
              aria-label="Отменить добавление варианта"
              onClick={() => {
                setAddingOption(false)
                setShowOptionValidation(false)
              }}
            >
              <X />
            </Button>
          </div>
        </div>
      )}

      <div className="mt-5 flex gap-2">
        {running ? (
          <>
            <Button
              variant="outline"
              className="h-10"
              disabled={busy}
              onClick={() => void onRun("extend", { pollId: poll.id })}
            >
              +30 сек
            </Button>
            <Button
              variant="secondary"
              className="h-10 flex-1"
              disabled={busy}
              onClick={() => void onRun("finish", { pollId: poll.id })}
            >
              Завершить опрос
            </Button>
          </>
        ) : (
          <Button className="h-10 w-full" disabled={busy} onClick={onClear}>
            Изменить и запустить снова
          </Button>
        )}
      </div>

      <div className="mt-6 space-y-2 rounded-xl bg-surface-subtle p-4">
        <div className="text-xs text-muted-foreground">Правила</div>
        <div>
          <FormSwitch
            id={`${instanceId}-secret`}
            label="Скрывать результаты до финала"
            checked={poll.secret}
            disabled={busy || !running}
            onCheckedChange={(secret) =>
              void onRun("poll-rules", { pollId: poll.id, secret })
            }
          />
          <FormSwitch
            id={`${instanceId}-allow-change`}
            label="Разрешить переголосование"
            checked={poll.allowChange}
            disabled={busy || !running}
            onCheckedChange={(allowChange) =>
              void onRun("poll-rules", { pollId: poll.id, allowChange })
            }
          />
        </div>
      </div>

      <div className="mt-6">
        <FormSegmented
          label="Виджет в OBS"
          value={poll.visible ? "stream" : "panel"}
          options={[
            ["stream", "Включён"],
            ["panel", "Скрыт"],
          ]}
          disabled={busy}
          onChange={(value) => onSetOutput(value === "stream")}
        />
      </div>

      {running && poll.source === "test" && (
        <div className="mt-7 rounded-2xl border border-border-subtle bg-surface-subtle/70 p-3">
          <div className="px-1 pb-3 text-xs font-medium text-muted-foreground">
            Демо-голоса
          </div>
          <Button
            variant="secondary"
            className="mb-2 h-11 w-full"
            disabled={busy}
            onClick={onSimulate}
          >
            Случайные голоса
          </Button>
          <div className="grid gap-2 sm:grid-cols-2">
            {poll.options.map((option, optionIndex) => (
              <Button
                key={option.id}
                variant="ghost"
                className={`h-11 min-w-0 justify-between gap-3 bg-background/35 px-3 hover:bg-surface-raised ${poll.options.length % 2 === 1 && optionIndex === poll.options.length - 1 ? "sm:col-span-2" : ""}`}
                disabled={busy}
                onClick={() => onVote(option)}
              >
                <span className="truncate text-sm font-medium">
                  {option.name}
                </span>
                <span className="shrink-0 rounded-md bg-brand/9 px-2 py-1 font-mono text-[11px] text-brand">
                  {option.word}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SourceChip({ source }: { source: Draft["source"] }) {
  const twitch = source === "twitch"
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium ring-1 ring-inset ${twitch ? "bg-twitch/10 text-twitch ring-twitch/20" : "bg-brand/9 text-brand ring-brand/15"}`}
    >
      {twitch ? "Twitch" : "Демо"}
    </span>
  )
}

function ChatVoteFeed({ current }: { current: Draft | Poll }) {
  const poll = "status" in current ? current : null
  const liveEntries = poll ? [...poll.activity].reverse() : []
  const choicesRef = useRef(current.options)
  const [demoFallback, setDemoFallback] = useState<{
    pollId: string
    entries: VoteActivity[]
  }>({ pollId: "", entries: [] })
  const activeDemoId =
    poll?.status === "running" && poll.source === "test" ? poll.id : ""

  useEffect(() => {
    choicesRef.current = current.options
  }, [current.options])

  useEffect(() => {
    if (!activeDemoId) return
    let sequence = 0
    const viewers = ["PixelFox", "NightOwl", "LimeCat", "MoonByte", "Kira"]
    const pushMessage = () => {
      const choices = choicesRef.current
      if (!choices.length) return
      const option =
        choices[
          Math.random() < 0.45 ? 0 : Math.floor(Math.random() * choices.length)
        ]
      const viewerName = viewers[sequence % viewers.length]
      const entry: VoteActivity = {
        id: `demo-feed:${activeDemoId}:${sequence++}`,
        viewerName,
        optionId: option.id,
        at: Date.now(),
      }
      setDemoFallback((feed) => ({
        pollId: activeDemoId,
        entries: [
          entry,
          ...(feed.pollId === activeDemoId ? feed.entries : []),
        ].slice(0, 6),
      }))
    }
    const firstMessage = window.setTimeout(pushMessage, 240)
    const stream = window.setInterval(pushMessage, 1100)
    return () => {
      window.clearTimeout(firstMessage)
      window.clearInterval(stream)
    }
  }, [activeDemoId])

  const fallbackEntries =
    poll && demoFallback.pollId === poll.id ? demoFallback.entries : []
  const entries = liveEntries.length ? liveEntries : fallbackEntries

  if (current.source === "test" && poll?.status !== "running") return null

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Голоса из чата</span>
        <SourceChip source={current.source} />
      </div>

      {entries.length ? (
        <div
          className="space-y-1"
          aria-live="polite"
          aria-label={
            current.source === "twitch"
              ? "Совпавшие сообщения Twitch"
              : "Демо-голоса"
          }
        >
          {entries.map((entry) => {
            const option = current.options.find(
              (item) => item.id === entry.optionId
            )
            if (!option) return null
            const previousOption = current.options.find(
              (item) => item.id === entry.previousOptionId
            )
            return (
              <div
                key={entry.id}
                className="flex animate-in items-start gap-3 rounded-lg px-3 py-2.5 duration-200 fade-in slide-in-from-top-1"
              >
                <TwitchAvatar name={entry.viewerName} src={entry.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {entry.viewerName}
                    </span>
                    {previousOption && (
                      <span className="shrink-0 text-[11px] text-brand/70">
                        изменил(а) голос
                      </span>
                    )}
                    <time
                      dateTime={new Date(entry.at).toISOString()}
                      className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums"
                      title={new Date(entry.at).toLocaleString("ru-RU")}
                    >
                      {new Date(entry.at).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </time>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs">
                    {previousOption && (
                      <>
                        <span className="max-w-24 truncate text-muted-foreground line-through">
                          {previousOption.name}
                        </span>
                        <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                      </>
                    )}
                    <span className="flex min-w-0 items-center gap-2 rounded-md bg-brand/8 px-2 py-1">
                      <span className="truncate text-foreground">
                        {option.name}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-brand/70">
                        {option.word}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-surface-subtle px-4 py-5 text-sm text-muted-foreground">
          {poll?.status === "running"
            ? "Совпавшие сообщения появятся здесь."
            : "Совпавших сообщений не было."}
        </div>
      )}
    </div>
  )
}

function TwitchAvatar({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false)

  if (src && !failed)
    return (
      <img
        src={src}
        alt=""
        className="size-8 shrink-0 rounded-full bg-surface-raised object-cover"
        onError={() => setFailed(true)}
      />
    )

  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-medium text-foreground">
      {Array.from(name)[0]?.toLocaleUpperCase("ru")}
    </span>
  )
}
