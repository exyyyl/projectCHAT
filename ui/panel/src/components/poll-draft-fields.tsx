import { Plus, X } from "lucide-react"
import { useId, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FormColumns,
  FormField,
  FormDuration,
  FormSwitch,
} from "@/components/form-controls"
import { Textarea } from "@/components/ui/textarea"
import type { Draft } from "@/domain/polls"

type PollDraftFieldsProps = {
  draft: Draft
  idPrefix: string
  extraSettings?: ReactNode
  showValidation?: boolean
  actions?: ReactNode
  leadingFields?: ReactNode
  onChange: (update: (current: Draft) => Draft) => void
}

export function PollDraftFields({
  draft,
  idPrefix: prefix,
  extraSettings,
  showValidation = false,
  actions,
  leadingFields,
  onChange,
}: PollDraftFieldsProps) {
  const instanceId = useId()
  const idPrefix = `${prefix}-${instanceId}`
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
    <FormField label="Вопрос" htmlFor={`${idPrefix}-question`}>
      <Textarea
        id={`${idPrefix}-question`}
        rows={2}
        className="min-h-20"
        maxLength={100}
        placeholder="Что выбираем?"
        value={draft.question}
        aria-invalid={
          showValidation && !draft.question.trim() ? true : undefined
        }
        onChange={(event) =>
          onChange((item) => ({ ...item, question: event.target.value }))
        }
      />
    </FormField>
  )

  const optionsField = (
    <div>
      <div className="mb-2 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_36px] gap-2 text-xs text-muted-foreground">
        <span>Вариант</span>
        <span>Ключевое слово</span>
        <span />
      </div>
      <div className="space-y-2">
        {draft.options.map((option, index) => (
          <div
            key={option.id}
            className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_36px] items-center gap-2"
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
    <FormDuration
      value={draft.duration}
      invalid={showValidation && invalidDuration}
      onChange={(duration) => onChange((item) => ({ ...item, duration }))}
    />
  )

  const rulesField = (
    <FormField label="Правила">
      <div>
        <FormSwitch
          id={`${idPrefix}-secret`}
          label="Скрывать результаты до финала"
          checked={draft.secret}
          onCheckedChange={(secret) =>
            onChange((item) => ({ ...item, secret }))
          }
        />
        <FormSwitch
          id={`${idPrefix}-allow-change`}
          label="Разрешить переголосование"
          checked={draft.allowChange}
          onCheckedChange={(allowChange) =>
            onChange((item) => ({ ...item, allowChange }))
          }
        />
      </div>
    </FormField>
  )

  return (
    <FormColumns
      settings={
        <>
          <div>{durationField}</div>
          {extraSettings && <div>{extraSettings}</div>}
          <div className="form-settings-wide">{rulesField}</div>
          {actions && <div className="form-settings-wide">{actions}</div>}
        </>
      }
    >
      {leadingFields}
      {questionField}
      {optionsField}
    </FormColumns>
  )
}
