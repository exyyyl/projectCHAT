import { ArrowRight, BookmarkPlus, Eye, EyeOff } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { PollDraftFields } from "@/components/poll-draft-fields"
import { PollResults, PollTimer } from "@/components/poll-results"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useToast } from "@/components/ui/toast"
import type {
  CommandResult,
  Draft,
  Poll,
  PollOption,
  VoteActivity,
  WidgetSettings,
} from "@/domain/polls"
import { pluralVotes, validateDraft } from "@/domain/polls"

type PollWorkspaceProps = {
  poll: Poll | null
  draft: Draft
  connected: boolean
  busy: boolean
  twitchPhase: string
  widget: WidgetSettings
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
  widget,
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
  const current = poll || draft
  const onStream = poll ? poll.visible : draft.showOverlay

  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(390px,.86fr)_minmax(420px,1.14fr)]">
      <section className="min-w-0 p-6 lg:p-8">
        <div className="mx-auto max-w-160">
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
        </div>
      </section>

      <PreviewPane current={current} onStream={onStream} widget={widget} />
    </div>
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
  const showToast = useToast()
  const [showValidation, setShowValidation] = useState(false)
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
    <div className="space-y-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <SegmentedSetting label="Голоса">
          <ToggleGroup
            type="single"
            value={draft.source}
            disabled={busy}
            onValueChange={(value) =>
              value &&
              onChange((item) => ({
                ...item,
                source: value as Draft["source"],
              }))
            }
            className="grid w-full grid-cols-2 rounded-xl border border-border-subtle bg-surface-subtle p-1"
          >
            <ToggleGroupItem value="twitch">Twitch</ToggleGroupItem>
            <ToggleGroupItem value="test">Демо</ToggleGroupItem>
          </ToggleGroup>
        </SegmentedSetting>

        <SegmentedSetting label="Виджет в OBS">
          <ToggleGroup
            type="single"
            value={draft.showOverlay ? "stream" : "panel"}
            disabled={busy}
            onValueChange={(value) => value && onSetOutput(value === "stream")}
            className="grid w-full grid-cols-2 rounded-xl border border-border-subtle bg-surface-subtle p-1"
          >
            <ToggleGroupItem value="stream">Включён</ToggleGroupItem>
            <ToggleGroupItem value="panel">Скрыт</ToggleGroupItem>
          </ToggleGroup>
        </SegmentedSetting>
      </div>

      <PollDraftFields
        draft={draft}
        idPrefix="poll"
        showValidation={showValidation}
        onChange={onChange}
      />

      <div className="grid gap-2 pt-1 sm:grid-cols-[auto_minmax(0,1fr)]">
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
        <Button
          className="h-11 w-full text-[15px]"
          disabled={busy}
          onClick={() => {
            if (draftError) {
              setShowValidation(true)
              requestAnimationFrame(() => {
                document
                  .querySelector<HTMLElement>('[aria-invalid="true"]')
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
      </div>
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
  const total = poll.options.reduce((sum, option) => sum + option.votes, 0)

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

      <PollResults poll={poll} />
      <div className="mt-4 text-xs text-muted-foreground">
        {pluralVotes(total)}
      </div>

      <div className="mt-7 space-y-2">
        <div className="text-xs text-muted-foreground">Виджет в OBS</div>
        <ToggleGroup
          type="single"
          value={poll.visible ? "stream" : "panel"}
          disabled={busy}
          onValueChange={(value) => value && onSetOutput(value === "stream")}
          className="grid w-full grid-cols-2 rounded-xl border border-border-subtle bg-surface-subtle p-1"
        >
          <ToggleGroupItem value="stream">Включён</ToggleGroupItem>
          <ToggleGroupItem value="panel">Скрыт</ToggleGroupItem>
        </ToggleGroup>
      </div>

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

function SegmentedSetting({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

function SourceChip({ source }: { source: Draft["source"] }) {
  const twitch = source === "twitch"
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium ring-1 ring-inset ${twitch ? "bg-[#9146ff]/10 text-[#c7a7ff] ring-[#9146ff]/20" : "bg-brand/9 text-brand ring-brand/15"}`}
    >
      {twitch ? "Twitch" : "Демо"}
    </span>
  )
}

function PreviewPane({
  current,
  onStream,
  widget,
}: {
  current: Draft | Poll
  onStream: boolean
  widget: WidgetSettings
}) {
  return (
    <section className="min-w-0 bg-panel-muted p-6 lg:p-8">
      <div className="lg:sticky lg:top-8">
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-muted-foreground">
              Предпросмотр
            </span>
            <span
              className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium ring-1 ring-inset ${onStream ? "bg-brand/9 text-brand ring-brand/15" : "bg-surface-subtle text-muted-foreground ring-border-subtle"}`}
            >
              {onStream ? (
                <Eye className="size-3.5" />
              ) : (
                <EyeOff className="size-3.5" />
              )}
              {onStream ? "Виджет включён" : "Виджет скрыт"}
            </span>
          </div>
          <div className="preview-stage min-h-80 rounded-2xl p-6">
            <div className="max-w-82.5">
              <PollResults poll={current} compact widget={widget} />
            </div>
          </div>
        </div>

        <ChatVoteFeed current={current} />
      </div>
    </section>
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
        at: sequence,
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
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Голоса из чата
        </span>
        <SourceChip source={current.source} />
      </div>

      {entries.length ? (
        <div
          className="max-h-64 space-y-1 overflow-y-auto rounded-xl bg-surface-subtle p-1"
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
