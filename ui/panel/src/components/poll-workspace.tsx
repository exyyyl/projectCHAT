import { ArrowRight, ChevronDown } from "lucide-react"
import { useState, type ReactNode } from "react"

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
}: {
  draft: Draft
  connected: boolean
  busy: boolean
  twitchPhase: string
  onChange: PollWorkspaceProps["onChangeDraft"]
  onSetOutput: (visible: boolean) => void
  onStart: () => void
}) {
  const showToast = useToast()
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
            <ToggleGroupItem value="twitch">Twitch-чат</ToggleGroupItem>
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
            <ToggleGroupItem value="stream">На стриме</ToggleGroupItem>
            <ToggleGroupItem value="panel">Скрыт</ToggleGroupItem>
          </ToggleGroup>
        </SegmentedSetting>
      </div>

      <PollDraftFields draft={draft} idPrefix="poll" onChange={onChange} />

      <div className="pt-1">
        <Button
          className="h-11 w-full text-[15px]"
          disabled={busy}
          onClick={() => {
            if (startIssue) {
              showToast({
                message: startIssue,
                tone: twitchUnavailable ? "warning" : "error",
              })
              return
            }
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
}: {
  poll: Poll
  busy: boolean
  onSetOutput: (visible: boolean) => void
  onRun: PollWorkspaceProps["onRun"]
  onVote: (option: PollOption) => void
  onSimulate: () => void
  onClear: () => void
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
          <span className="text-xs text-muted-foreground">
            {poll.source === "twitch" ? "Twitch-чат" : "Демо"}
          </span>
        </div>
        <PollTimer poll={poll} />
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
          <ToggleGroupItem value="stream">На стриме</ToggleGroupItem>
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
        <details className="group mt-7 rounded-xl bg-surface-subtle p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-muted-foreground">
            Демо-голоса
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 flex flex-wrap gap-2">
            {poll.options.map((option) => (
              <Button
                key={option.id}
                variant="outline"
                size="sm"
                className="font-mono"
                disabled={busy}
                onClick={() => onVote(option)}
              >
                {option.word}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onSimulate}
            >
              Сымитировать чат
            </Button>
          </div>
        </details>
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

function PreviewPane({
  current,
  onStream,
  widget,
}: {
  current: Draft | Poll
  onStream: boolean
  widget: WidgetSettings
}) {
  const twitchPoll = "status" in current && current.source === "twitch"

  return (
    <section className="min-w-0 bg-panel-muted p-6 lg:p-8">
      <div
        className={`lg:sticky lg:top-8 ${twitchPoll ? "2xl:grid 2xl:grid-cols-[minmax(420px,1.2fr)_minmax(280px,.8fr)] 2xl:items-start 2xl:gap-6" : ""}`}
      >
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-muted-foreground">
              Предпросмотр
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className={`size-1.5 rounded-full ${onStream ? "bg-brand" : "bg-muted-foreground/60"}`}
              />
              {onStream ? "В OBS" : "Скрыт в OBS"}
            </span>
          </div>
          <div
            className={`preview-stage rounded-2xl p-6 ${twitchPoll ? "min-h-80" : "min-h-97.5"}`}
          >
            <div className="max-w-82.5">
              <PollResults poll={current} compact widget={widget} />
            </div>
          </div>
        </div>

        {twitchPoll && <ChatVoteFeed poll={current} />}
      </div>
    </section>
  )
}

function ChatVoteFeed({ poll }: { poll: Poll }) {
  const entries = [...poll.activity].reverse()

  return (
    <div className="mt-6 2xl:mt-0">
      <div className="mb-3 text-xs font-medium text-muted-foreground">
        Голоса из чата
      </div>

      {entries.length ? (
        <div
          className="max-h-80 space-y-1 overflow-y-auto rounded-xl bg-surface-subtle p-1 2xl:max-h-[calc(100vh-8rem)]"
          aria-live="polite"
          aria-label="Совпавшие сообщения Twitch-чата"
        >
          {entries.map((entry) => {
            const option = poll.options.find(
              (item) => item.id === entry.optionId
            )
            if (!option) return null
            const previousOption = poll.options.find(
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
          {poll.status === "running"
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
