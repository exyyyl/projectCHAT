import { TemplateSaveButton, type SaveTemplate } from "./template-save-button"
import { wheelTemplate, type SavedTemplate } from "@/domain/templates"
import { useEffect, useId, useRef, useState } from "react"
import {
  RotateCcw,
  CircleDashed,
  ChevronRight,
  Plus,
  X,
  ClipboardList,
  Check,
  History,
} from "lucide-react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FormField, FormSwitch } from "@/components/form-controls"
import { useToast } from "@/components/ui/toast"
import {
  availableDecisions,
  chooseDecision,
  decisionOptions,
  emptyDecisionState,
  numberRangeError,
  recordDecision,
  restoreDecisionState,
  type DecisionOption,
  type DecisionState,
} from "@/domain/decision-wheel"

gsap.registerPlugin(useGSAP)
const storageKey = "cue-decision-wheel"
const rowHeight = 64
function loadWheel() {
  try {
    return restoreDecisionState(
      JSON.parse(localStorage.getItem(storageKey) || "null")
    )
  } catch {
    return emptyDecisionState()
  }
}

export function DecisionWheelPage({
  template,
  onSaveTemplate,
  onSpinningChange,
}: {
  template?: Extract<SavedTemplate, { kind: "wheel" }>
  onSaveTemplate?: SaveTemplate
  onSpinningChange?: (spinning: boolean) => void
}) {
  const [state, setState] = useState<DecisionState>(() => {
    const saved = template
      ? { ...template.data, excluded: [], history: [] }
      : loadWheel()
    return saved.mode === "list" && saved.options.length === 0
      ? {
          ...saved,
          options: [
            { id: crypto.randomUUID(), label: "" },
            { id: crypto.randomUUID(), label: "" },
          ],
        }
      : saved
  })
  const [spinning, setSpinning] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulk, setBulk] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [presentation, setPresentation] = useState<{
    entries: DecisionOption[]
    winnerIndex: number
  } | null>(null)
  const reel = useRef<HTMLDivElement>(null)
  const spinLock = useRef(false)
  const saveWarning = useRef(false)
  const showToast = useToast()
  const id = useId()
  const options = decisionOptions(state)
  const available = availableDecisions(state)
  const rangeError =
    state.mode === "number"
      ? numberRangeError(state.minimum, state.maximum)
      : null
  const canSpin =
    !!available.length && (state.mode !== "list" || options.length >= 2)
  const { contextSafe } = useGSAP({ scope: reel })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
      saveWarning.current = false
    } catch {
      if (!saveWarning.current)
        showToast({
          message: "Не удалось сохранить рулетку на этом устройстве",
          tone: "error",
        })
      saveWarning.current = true
    }
  }, [state, showToast])

  const spin = () =>
    contextSafe(() => {
      if (spinLock.current || !canSpin) return
      const selected = chooseDecision(state)
      if (!selected || !reel.current) return
      spinLock.current = true
      // Cosmetic rows are independent of the uniformly sampled real result.
      const entries = Array.from(
        { length: 24 },
        () => available[Math.floor(Math.random() * available.length)]
      )
      const winnerIndex = entries.length
      entries.push(selected, available[0], available.at(-1)!)
      setPresentation({ entries, winnerIndex })
      setSpinning(true)
      onSpinningChange?.(true)
      setResult(null)
      gsap.fromTo(
        reel.current,
        { y: 0 },
        {
          y:
            ((reel.current?.parentElement?.clientHeight || 320) - rowHeight) /
              2 -
            winnerIndex * rowHeight,
          duration: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? 0
            : 3.8,
          ease: "power3.out",
          onComplete: () => {
            setState((current) => recordDecision(current, selected))
            setResult(selected.label.trim())
            spinLock.current = false
            setSpinning(false)
            onSpinningChange?.(false)
          },
        }
      )
    })()

  const reset = () => {
    setState((current) => ({ ...current, excluded: [], history: [] }))
    setResult(null)
    setPresentation(null)
  }
  const changeMode = (mode: string) => {
    if (mode !== "list" && mode !== "number" && mode !== "yes-no") return
    setState((current) => ({
      ...current,
      mode,
      withoutRepeats: mode === "list",
      options:
        mode === "list" && !current.options.length
          ? [
              { id: crypto.randomUUID(), label: "" },
              { id: crypto.randomUUID(), label: "" },
            ]
          : current.options,
    }))
    setResult(null)
    setPresentation(null)
  }
  const listError =
    state.mode === "list" &&
    state.options.some((option) => option.label.length > 120)
      ? "В одном варианте может быть до 120 символов"
      : null
  const changeOptions = (text: string) => {
    const lines = text ? text.split(/\r?\n/) : []
    if (lines.length > 40) {
      showToast({ message: "Можно добавить до 40 вариантов", tone: "warning" })
      return
    }
    setState((current) => {
      const used = new Set<string>()
      const next = lines.map((label, index) => {
        const matching = current.options.find(
          (option) => !used.has(option.id) && option.label === label
        )
        const previous = matching || current.options[index]
        const id =
          previous && !used.has(previous.id) ? previous.id : crypto.randomUUID()
        used.add(id)
        return { id, label }
      })
      return {
        ...current,
        options: next,
        excluded: current.excluded.filter((id) => used.has(id)),
      }
    })
  }

  return (
    <section className="roulette-page h-full" aria-label="Рулетка">
      <div className="template-filters" role="group" aria-label="Режим рулетки">
        {(
          [
            ["list", "Список"],
            ["number", "Число"],
            ["yes-no", "Да / нет"],
          ] as const
        ).map(([mode, label]) => (
          <Button
            key={mode}
            variant={state.mode === mode ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={state.mode === mode}
            disabled={spinning}
            onClick={() => changeMode(mode)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="roulette-form-layout">
        <div className="roulette-editor">
          <div className="roulette-block">
            <div className="roulette-block-heading">
              <h2>{state.mode === "number" ? "Диапазон" : "Варианты"}</h2>
              {state.mode === "list" && <span>{options.length}/40</span>}
            </div>
            {state.mode === "list" && (
              <>
                <div className="space-y-2">
                  {state.options.map((option, index) => (
                    <div key={option.id} className="roulette-option-row">
                      <Input
                        aria-label={`Вариант ${index + 1}`}
                        placeholder={`Вариант ${index + 1}`}
                        maxLength={120}
                        value={option.label}
                        disabled={spinning}
                        onChange={(event) =>
                          setState((current) => ({
                            ...current,
                            options: current.options.map((item) =>
                              item.id === option.id
                                ? { ...item, label: event.target.value }
                                : item
                            ),
                          }))
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Удалить вариант ${index + 1}`}
                        disabled={spinning || state.options.length <= 2}
                        onClick={() =>
                          setState((current) => ({
                            ...current,
                            options: current.options.filter(
                              (item) => item.id !== option.id
                            ),
                            excluded: current.excluded.filter(
                              (item) => item !== option.id
                            ),
                          }))
                        }
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={spinning || state.options.length >= 40}
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        options: [
                          ...current.options,
                          { id: crypto.randomUUID(), label: "" },
                        ],
                      }))
                    }
                  >
                    <Plus />
                    Добавить вариант
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={bulkOpen}
                    disabled={spinning}
                    onClick={() => setBulkOpen((value) => !value)}
                  >
                    <ClipboardList />
                    Вставить список
                  </Button>
                </div>
                {bulkOpen && (
                  <div className="space-y-3">
                    <FormField
                      label="По одному варианту на строку"
                      htmlFor={id + "-bulk"}
                    >
                      <Textarea
                        id={id + "-bulk"}
                        value={bulk}
                        maxLength={4840}
                        disabled={spinning}
                        onChange={(event) => setBulk(event.target.value)}
                        placeholder={"Minecraft\nValorant\nHollow Knight"}
                      />
                    </FormField>
                    <div className="flex justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={spinning || !bulk.trim()}
                        onClick={() => {
                          if (bulk.split(/\r?\n/).length <= 40) {
                            changeOptions(bulk)
                            setBulkOpen(false)
                            setBulk("")
                          } else
                            showToast({
                              message: "Можно добавить до 40 вариантов",
                              tone: "warning",
                            })
                        }}
                      >
                        Заменить варианты
                      </Button>
                    </div>
                  </div>
                )}
                {listError && (
                  <p role="alert" className="text-sm text-destructive">
                    {listError}
                  </p>
                )}
              </>
            )}
            {state.mode === "number" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="От" htmlFor={id + "-min"}>
                    <Input
                      id={id + "-min"}
                      type="number"
                      min={-1000000}
                      max={1000000}
                      step="1"
                      value={state.minimum}
                      disabled={spinning}
                      aria-invalid={!!rangeError}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          minimum: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="До" htmlFor={id + "-max"}>
                    <Input
                      id={id + "-max"}
                      type="number"
                      min={-1000000}
                      max={1000000}
                      step="1"
                      value={state.maximum}
                      disabled={spinning}
                      aria-invalid={!!rangeError}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          maximum: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                </div>
                {rangeError && (
                  <p role="alert" className="text-sm text-destructive">
                    {rangeError}
                  </p>
                )}
              </>
            )}
            {state.mode === "yes-no" && (
              <div className="roulette-answers">
                <span>Да</span>
                <span>Нет</span>
              </div>
            )}
          </div>
          {!!state.history.length && (
            <div className="roulette-block">
              <div className="roulette-block-heading">
                <h2>
                  <History aria-hidden="true" />
                  История
                </h2>
                <span>{state.history.length}</span>
              </div>
              <ol className="roulette-history">
                {state.history.map((label, index) => (
                  <li key={index + "-" + label}>
                    <span
                      className="roulette-history-position"
                      aria-hidden="true"
                    >
                      {state.history.length - index}
                    </span>
                    <span>{label}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <div className="roulette-block roulette-runner">
          <div className="roulette-block-heading">
            <h2>Результат</h2>
            {onSaveTemplate && (
              <TemplateSaveButton
                iconOnly
                kind="wheel"
                data={wheelTemplate(state)}
                current={template}
                onSave={onSaveTemplate}
                disabled={
                  spinning ||
                  (state.mode === "list" && options.length < 2) ||
                  !!rangeError ||
                  !!listError
                }
              />
            )}
          </div>
          <div className="roulette-canvas">
            <div className="roulette-marker" aria-hidden="true">
              <ChevronRight />
            </div>
            <div className="roulette-window" aria-hidden="true">
              <div
                ref={reel}
                className="roulette-reel"
                style={{ visibility: spinning ? "visible" : "hidden" }}
              >
                {presentation?.entries.map((option, index) => (
                  <div key={index + "-" + option.id} className="roulette-row">
                    <span>{option.label.trim()}</span>
                  </div>
                ))}
              </div>
            </div>
            {!spinning && (
              <div
                className="roulette-settled"
                data-result={Boolean(result) || undefined}
              >
                {result ||
                  (canSpin
                    ? "Готова к запуску"
                    : state.mode === "list" && options.length < 2
                      ? "Добавьте варианты"
                      : "Начните заново")}
              </div>
            )}
          </div>
          <FormSwitch
            label="Без повторов"
            checked={state.withoutRepeats}
            disabled={spinning}
            onCheckedChange={(withoutRepeats) =>
              setState((current) => ({ ...current, withoutRepeats }))
            }
          />
          {!available.length && options.length >= 2 && (
            <div className="roulette-exhausted" role="status">
              <Check aria-hidden="true" />
              <span>Все варианты выпали</span>
              <button type="button" onClick={reset}>
                Начать заново
              </button>
            </div>
          )}
          <div className="roulette-run-actions">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Начать заново"
              disabled={
                spinning || (!state.excluded.length && !state.history.length)
              }
              onClick={reset}
            >
              <RotateCcw />
            </Button>
            <Button
              type="button"
              disabled={spinning || !canSpin || !!listError}
              onClick={spin}
            >
              <CircleDashed />
              {spinning ? "Выбираем…" : "Крутить"}
            </Button>
          </div>
        </div>
      </div>
      <p className="sr-only" role="status">
        {spinning ? "Выбираем…" : result ? "Выбрано: " + result : ""}
      </p>
    </section>
  )
}
