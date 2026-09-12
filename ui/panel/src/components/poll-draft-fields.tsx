import { Plus, X } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Draft } from "@/domain/polls"

const durations = [
  [30, "30 сек"],
  [60, "1 мин"],
  [180, "3 мин"],
  [300, "5 мин"],
] as const

type PollDraftFieldsProps = {
  draft: Draft
  idPrefix: string
  extraSettings?: ReactNode
  showValidation?: boolean
  layout?: "stacked" | "split"
  onChange: (update: (current: Draft) => Draft) => void
}

export function PollDraftFields({
  draft,
  idPrefix,
  extraSettings,
  showValidation = false,
  layout = "stacked",
  onChange,
}: PollDraftFieldsProps) {
  const normalizedWords = draft.options.map((option) =>
    option.word.normalize("NFKC").trim().toLocaleLowerCase("ru")
  )
  const invalidWords = normalizedWords.map(
    (word, index) =>
      !word ||
      /\s/u.test(word) ||
      normalizedWords.some(
        (candidate, candidateIndex) =>
          candidateIndex !== index && candidate === word
      )
  )
  const invalidDuration =
    !Number.isInteger(draft.duration) ||
    draft.duration < 10 ||
    draft.duration > 3600

  const questionField = (
    <div className="space-y-2">
      <label
        className="text-xs text-muted-foreground"
        htmlFor={`${idPrefix}-question`}
      >
        Вопрос
      </label>
      <Textarea
        id={`${idPrefix}-question`}
        rows={3}
        maxLength={100}
        placeholder="Что выбираем?"
        value={draft.question}
        aria-invalid={
          showValidation && !draft.question.trim() ? true : undefined
        }
        onChange={(event) =>
          onChange((item) => ({ ...item, question: event.target.value }))
        }
        className="resize-none text-lg"
      />
    </div>
  )

  const optionsField = (
    <div>
      <div className="mb-2 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_32px] gap-2 text-xs text-muted-foreground">
        <span>Вариант</span>
        <span>Ключевое слово</span>
        <span />
      </div>
      <div className="space-y-2">
        {draft.options.map((option, index) => (
          <div
            key={option.id}
            className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_32px] gap-2"
          >
            <Input
              value={option.name}
              maxLength={40}
              placeholder={`Вариант ${index + 1}`}
              aria-label={`Вариант ${index + 1}`}
              aria-invalid={
                showValidation && !option.name.trim() ? true : undefined
              }
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
              placeholder="слово"
              aria-label={`Ключевое слово ${index + 1}`}
              aria-invalid={
                showValidation && invalidWords[index] ? true : undefined
              }
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
              type="button"
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
        type="button"
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
  )

  const durationField = (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">Длительность</div>
      <div className="flex flex-wrap items-center gap-3">
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
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Input
            type="number"
            min={10}
            max={3600}
            step={1}
            value={draft.duration || ""}
            aria-label="Своя длительность в секундах"
            aria-invalid={showValidation && invalidDuration ? true : undefined}
            className="w-22 font-mono tabular-nums"
            onChange={(event) =>
              onChange((item) => ({
                ...item,
                duration: Number(event.target.value),
              }))
            }
          />
          сек
        </label>
      </div>
    </div>
  )

  const rulesField = (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">Правила</div>
      <div className="space-y-1 rounded-xl bg-surface-subtle p-1">
        <div className="flex min-h-10 items-center justify-between gap-4 rounded-lg px-3 py-2">
          <label className="text-sm" htmlFor={`${idPrefix}-secret`}>
            Скрывать результаты до финала
          </label>
          <Switch
            id={`${idPrefix}-secret`}
            checked={draft.secret}
            onCheckedChange={(checked) =>
              onChange((item) => ({ ...item, secret: checked }))
            }
          />
        </div>
        <div className="flex min-h-10 items-center justify-between gap-4 rounded-lg px-3 py-2">
          <label className="text-sm" htmlFor={`${idPrefix}-allow-change`}>
            Разрешить переголосование
          </label>
          <Switch
            id={`${idPrefix}-allow-change`}
            checked={draft.allowChange}
            onCheckedChange={(checked) =>
              onChange((item) => ({ ...item, allowChange: checked }))
            }
          />
        </div>
      </div>
    </div>
  )

  if (layout === "split")
    return (
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(17rem,.8fr)]">
        <div className="space-y-6 rounded-2xl bg-surface-subtle p-5">
          {questionField}
          {optionsField}
        </div>
        <div className="space-y-5 rounded-2xl bg-surface-subtle p-5">
          {durationField}
          {extraSettings}
          {rulesField}
        </div>
      </div>
    )

  return (
    <div className="space-y-6">
      {questionField}
      {optionsField}
      {durationField}
      {extraSettings}
      {rulesField}
    </div>
  )
}
