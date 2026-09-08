import { ChevronDown, Eye, EyeOff, Plus, X } from "lucide-react"

import { PollResults, PollTimer } from "@/components/poll-results"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
  privatePreview: boolean
  widget: WidgetSettings
  onChangeDraft: (update: (current: Draft) => Draft) => void
  onStart: () => void
  onClear: () => void
  onSetOutput: (visible: boolean) => void
  onTogglePreview: () => void
  onRun: (
    type: string,
    data?: Record<string, unknown>
  ) => Promise<CommandResult | null>
  onVote: (option: PollOption) => void
  onSimulate: () => void
}

const durations = [
  [30, "30 сек"],
  [60, "1 мин"],
  [180, "3 мин"],
  [300, "5 мин"],
] as const

export function PollWorkspace({
  poll,
  draft,
  connected,
  busy,
  twitchPhase,
  privatePreview,
  widget,
  onChangeDraft,
  onStart,
  onClear,
  onSetOutput,
  onTogglePreview,
  onRun,
  onVote,
  onSimulate,
}: PollWorkspaceProps) {
  const current = poll || draft
  const isDemo = current.source === "test"
  const onStream = poll ? poll.visible : draft.showOverlay !== false
  const showPreview = onStream || privatePreview
  const total =
    poll?.options.reduce((sum, option) => sum + option.votes, 0) || 0
  const canStart =
    connected &&
    !busy &&
    !validateDraft(draft) &&
    (draft.source !== "twitch" || twitchPhase === "connected")

  return (
    <div
      className={`grid ${showPreview ? "lg:grid-cols-[minmax(360px,.82fr)_minmax(420px,1.18fr)]" : "grid-cols-1"}`}
    >
      <section className="min-w-0 p-6 lg:p-8">
        {poll && (
          <div className="mb-6 flex items-center justify-between gap-4">
            <span className="text-xs text-brand">
              {poll.status === "running" ? "Идёт опрос" : "Завершён"}
            </span>
            <PollTimer poll={poll} />
          </div>
        )}

        <ToggleGroup
          type="single"
          value={current.source}
          disabled={!!poll || busy}
          onValueChange={(value) =>
            value &&
            onChangeDraft((item) => ({
              ...item,
              source: value as Draft["source"],
            }))
          }
          className="mb-7 justify-start"
        >
          <ToggleGroupItem value="test">Демо</ToggleGroupItem>
          <ToggleGroupItem value="twitch">Twitch-чат</ToggleGroupItem>
        </ToggleGroup>

        {!poll && <DraftForm draft={draft} onChange={onChangeDraft} />}
        {poll && (
          <div>
            <PollResults poll={poll} />
            <div className="mt-5 text-xs text-muted-foreground">
              {pluralVotes(total)}
            </div>
          </div>
        )}

        <div className="mt-7">
          <ToggleGroup
            type="single"
            value={onStream ? "stream" : "panel"}
            disabled={busy}
            onValueChange={(value) => value && onSetOutput(value === "stream")}
            className="grid grid-cols-2 rounded-xl border border-border-subtle bg-surface-subtle p-1"
          >
            <ToggleGroupItem value="stream">
              <Eye />
              На стриме
            </ToggleGroupItem>
            <ToggleGroupItem value="panel">
              <EyeOff />
              Только в панели
            </ToggleGroupItem>
          </ToggleGroup>
          {!onStream && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={onTogglePreview}
            >
              {privatePreview ? "Свернуть предпросмотр" : "Предпросмотр"}
            </Button>
          )}
        </div>

        <div className="mt-7 flex gap-2">
          {!poll && (
            <Button
              className="h-10 flex-1"
              disabled={!canStart}
              onClick={onStart}
            >
              Запустить опрос
            </Button>
          )}
          {poll?.status === "running" && (
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
                Завершить
              </Button>
            </>
          )}
          {poll?.status === "ended" && (
            <Button className="h-10 flex-1" disabled={busy} onClick={onClear}>
              Редактировать
            </Button>
          )}
        </div>

        {poll?.status === "running" && isDemo && (
          <details className="group mt-7 border-t border-border-subtle pt-5">
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
      </section>
      {showPreview && (
        <PreviewPane current={current} onStream={onStream} widget={widget} />
      )}
    </div>
  )
}

function DraftForm({
  draft,
  onChange,
}: {
  draft: Draft
  onChange: PollWorkspaceProps["onChangeDraft"]
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor="poll-question"
        >
          Вопрос
        </label>
        <Textarea
          id="poll-question"
          rows={3}
          maxLength={100}
          value={draft.question}
          onChange={(event) =>
            onChange((item) => ({ ...item, question: event.target.value }))
          }
          className="resize-none text-lg"
        />
      </div>
      <div>
        <div className="mb-2 grid grid-cols-[1.35fr_1fr_32px] gap-2 text-xs text-muted-foreground">
          <span>Вариант</span>
          <span>Ключевое слово</span>
        </div>
        <div className="space-y-2">
          {draft.options.map((option, index) => (
            <div
              key={option.id}
              className="grid grid-cols-[1.35fr_1fr_32px] gap-2"
            >
              <Input
                value={option.name}
                maxLength={40}
                aria-label={`Вариант ${index + 1}`}
                onChange={(event) =>
                  onChange((item) => ({
                    ...item,
                    options: item.options.map((entry, optionIndex) =>
                      optionIndex === index
                        ? { ...entry, name: event.target.value }
                        : entry
                    ),
                  }))
                }
              />
              <Input
                value={option.word}
                maxLength={24}
                aria-label={`Ключевое слово ${index + 1}`}
                className="font-mono text-xs"
                onChange={(event) =>
                  onChange((item) => ({
                    ...item,
                    options: item.options.map((entry, optionIndex) =>
                      optionIndex === index
                        ? { ...entry, word: event.target.value }
                        : entry
                    ),
                  }))
                }
              />
              <Button
                variant="ghost"
                size="icon"
                disabled={draft.options.length <= 2}
                onClick={() =>
                  onChange((item) => ({
                    ...item,
                    options: item.options
                      .filter((_, optionIndex) => optionIndex !== index)
                      .map((entry, optionIndex) => ({
                        ...entry,
                        id: String(optionIndex + 1),
                      })),
                  }))
                }
              >
                <X />
                <span className="sr-only">Удалить вариант</span>
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          disabled={draft.options.length >= 6}
          onClick={() =>
            onChange((item) => ({
              ...item,
              options: [
                ...item.options,
                { id: String(item.options.length + 1), name: "", word: "" },
              ],
            }))
          }
        >
          <Plus />
          Добавить вариант
        </Button>
      </div>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Длительность</div>
        <ToggleGroup
          type="single"
          value={String(draft.duration)}
          onValueChange={(value) =>
            value && onChange((item) => ({ ...item, duration: Number(value) }))
          }
          className="justify-start"
        >
          {durations.map(([value, label]) => (
            <ToggleGroupItem key={value} value={String(value)}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <details className="group border-t border-border-subtle pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-muted-foreground">
          Дополнительно
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 space-y-3 text-sm">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={draft.secret}
              onChange={(event) =>
                onChange((item) => ({ ...item, secret: event.target.checked }))
              }
              className="accent-brand"
            />
            Скрывать результаты до финала
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={draft.allowChange}
              onChange={(event) =>
                onChange((item) => ({
                  ...item,
                  allowChange: event.target.checked,
                }))
              }
              className="accent-brand"
            />
            Разрешить переголосование
          </label>
        </div>
      </details>
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
  return (
    <section className="min-w-0 border-t border-border-subtle bg-panel-muted p-6 lg:border-t-0 lg:border-l lg:p-8">
      <div className="mb-4 text-xs font-medium text-muted-foreground">
        Предпросмотр
      </div>
      <div className="preview-stage min-h-97.5 rounded-2xl p-6">
        <div className="max-w-82.5">
          <PollResults poll={current} compact widget={widget} />
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        {onStream ? "На стриме" : "Скрыт на стриме"}
      </div>
    </section>
  )
}
