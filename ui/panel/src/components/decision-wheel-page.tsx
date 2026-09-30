import { useEffect, useId, useRef, useState } from "react"
import {
  Plus,
  RotateCcw,
  Trash2,
  CircleDashed,
  ChevronRight,
} from "lucide-react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  FormField,
  FormStack,
  FormSwitch,
  FormSegmented,
} from "@/components/form-controls"
import {
  StudioWorkspace,
  StudioStage,
  StudioRail,
} from "@/components/page-layout"
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

export function DecisionWheelPage() {
  const [state, setState] = useState<DecisionState>(loadWheel)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [presentation, setPresentation] = useState<{
    entries: DecisionOption[]
    winnerIndex: number
  } | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulk, setBulk] = useState("")
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
      setResult(null)
      gsap.fromTo(
        reel.current,
        { y: 0 },
        {
          y: (2 - winnerIndex) * rowHeight,
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
    }))
    setResult(null)
    setPresentation(null)
  }
  const addOption = () =>
    setState((current) => ({
      ...current,
      options: [...current.options, { id: crypto.randomUUID(), label: "" }],
    }))
  const importOptions = () => {
    const seen = new Set(
      state.options.map((option) => option.label.trim().toLocaleLowerCase("ru"))
    )
    const additions = bulk
      .split(/\r?\n/)
      .map((label) => label.trim().slice(0, 120))
      .filter((label) => {
        const normalized = label.toLocaleLowerCase("ru")
        if (!label || seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
    if (state.options.length + additions.length > 40) {
      showToast({
        message: "В рулетке может быть до 40 вариантов",
        tone: "error",
      })
      return
    }
    setState((current) => ({
      ...current,
      options: [
        ...current.options,
        ...additions.map((label) => ({ id: crypto.randomUUID(), label })),
      ],
    }))
    setBulk("")
    setBulkOpen(false)
  }

  return (
    <div className="roulette-page h-full">
      <StudioWorkspace className="roulette-workspace" aria-label="Рулетка">
        <StudioStage className="roulette-stage">
          <div className="roulette-canvas">
            {presentation && (
              <div className="roulette-marker" aria-hidden="true">
                <ChevronRight />
              </div>
            )}
            <div className="roulette-window" aria-hidden="true">
              <div
                ref={reel}
                className={presentation ? "roulette-reel" : "hidden"}
              >
                {presentation?.entries.map((option, index) => (
                  <div
                    key={index + "-" + option.id}
                    className="roulette-row"
                    data-winner={
                      (!spinning && index === presentation.winnerIndex) ||
                      undefined
                    }
                  >
                    <span>{option.label.trim()}</span>
                  </div>
                ))}
              </div>
            </div>
            {!presentation && (
              <div className="roulette-ready">
                <CircleDashed
                  className="size-7 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <p className="text-lg font-medium">
                  {state.mode === "list" && options.length < 2
                    ? "Добавьте варианты"
                    : "Готово к выбору"}
                </p>
              </div>
            )}
          </div>
          <div className="roulette-controls">
            <p
              className="mb-4 text-center text-xs text-muted-foreground"
              aria-live="polite"
            >
              {spinning
                ? "Выбираем…"
                : rangeError ||
                  (state.mode === "list" && options.length < 2
                    ? "Минимум 2 разных варианта"
                    : !available.length
                      ? "Варианты закончились — начните заново"
                      : "Доступно: " + available.length)}
              <span className="sr-only">{result && "Выбрано: " + result}</span>
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={spinning || !canSpin}
                onClick={spin}
              >
                <CircleDashed />
                {spinning ? "Выбираем…" : "Крутить"}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Начать заново"
                disabled={
                  spinning || (!state.excluded.length && !state.history.length)
                }
                onClick={reset}
              >
                <RotateCcw />
              </Button>
            </div>
          </div>
        </StudioStage>
        <StudioRail>
          <FormStack>
            <FormSegmented
              label="Режим"
              value={state.mode}
              options={[
                ["list", "Список"],
                ["number", "Число"],
                ["yes-no", "Да / нет"],
              ]}
              disabled={spinning}
              onChange={changeMode}
            />
            {state.mode === "list" && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Варианты
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {state.options.length}/40
                  </span>
                </div>
                <div className="decision-options space-y-2">
                  {state.options.map((option, index) => (
                    <div
                      key={option.id}
                      className="flex items-center gap-2"
                      data-excluded={
                        (state.withoutRepeats &&
                          state.excluded.includes(option.id)) ||
                        undefined
                      }
                    >
                      <Input
                        aria-label={"Вариант " + (index + 1)}
                        placeholder={"Вариант " + (index + 1)}
                        value={option.label}
                        maxLength={120}
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
                        size="icon-sm"
                        aria-label={"Удалить вариант " + (index + 1)}
                        disabled={spinning}
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
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={spinning || state.options.length >= 40}
                    onClick={addOption}
                  >
                    <Plus />
                    Вариант
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={spinning || state.options.length >= 40}
                    onClick={() => setBulkOpen(!bulkOpen)}
                  >
                    Добавить списком
                  </Button>
                </div>
                {bulkOpen && (
                  <div className="mt-4">
                    <FormField
                      label="По одному варианту на строку"
                      htmlFor={id + "-bulk"}
                    >
                      <Textarea
                        id={id + "-bulk"}
                        value={bulk}
                        disabled={spinning}
                        onChange={(event) => setBulk(event.target.value)}
                        placeholder={"Minecraft\nValorant\nHollow Knight"}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={spinning || !bulk.trim()}
                        onClick={importOptions}
                      >
                        Добавить
                      </Button>
                    </FormField>
                  </div>
                )}
              </div>
            )}
            {state.mode === "number" && (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="От" htmlFor={id + "-min"}>
                    <Input
                      id={id + "-min"}
                      type="number"
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
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    {rangeError}
                  </p>
                )}
              </div>
            )}
            <FormSwitch
              label="Без повторов"
              checked={state.withoutRepeats}
              disabled={spinning}
              onCheckedChange={(withoutRepeats) =>
                setState((current) => ({ ...current, withoutRepeats }))
              }
            />
            {!!state.history.length && (
              <div>
                <span className="mb-3 block text-xs font-medium text-muted-foreground">
                  История
                </span>
                <ol className="space-y-2">
                  {state.history.map((label, index) => (
                    <li
                      key={index + "-" + label}
                      className="truncate text-sm text-foreground/80"
                    >
                      {label}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </FormStack>
        </StudioRail>
      </StudioWorkspace>
    </div>
  )
}
