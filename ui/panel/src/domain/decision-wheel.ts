export type DecisionOption = { id: string; label: string }
export type DecisionState = {
  mode: "list" | "number" | "yes-no"
  minimum: string
  maximum: string
  options: DecisionOption[]
  excluded: string[]
  history: string[]
  withoutRepeats: boolean
}

export function emptyDecisionState(): DecisionState {
  return {
    mode: "list",
    minimum: "1",
    maximum: "100",
    options: [],
    excluded: [],
    history: [],
    withoutRepeats: true,
  }
}

export function restoreDecisionState(value: unknown): DecisionState {
  if (!value || typeof value !== "object") return emptyDecisionState()
  const saved = value as Partial<DecisionState>
  const ids = new Set<string>()
  const options = Array.isArray(saved.options)
    ? saved.options
        .filter((option) => {
          if (
            !option ||
            typeof option.id !== "string" ||
            typeof option.label !== "string" ||
            ids.has(option.id)
          )
            return false
          ids.add(option.id)
          return true
        })
        .slice(0, 40)
        .map((option) => ({ id: option.id, label: option.label.slice(0, 120) }))
    : []
  return {
    mode:
      saved.mode === "number" || saved.mode === "yes-no" ? saved.mode : "list",
    minimum: typeof saved.minimum === "string" ? saved.minimum : "1",
    maximum: typeof saved.maximum === "string" ? saved.maximum : "100",
    options,
    excluded: Array.isArray(saved.excluded)
      ? saved.excluded.filter(
          (id) =>
            typeof id === "string" &&
            (options.some((option) => option.id === id) ||
              /^number:-?\d+$/.test(id) ||
              id === "answer:yes" ||
              id === "answer:no")
        )
      : [],
    history: Array.isArray(saved.history)
      ? saved.history.filter((label) => typeof label === "string").slice(0, 20)
      : [],
    withoutRepeats: saved.withoutRepeats !== false,
  }
}

export function decisionOptions(state: DecisionState) {
  if (state.mode === "yes-no")
    return [
      { id: "answer:yes", label: "Да" },
      { id: "answer:no", label: "Нет" },
    ]
  if (state.mode === "number") {
    if (numberRangeError(state.minimum, state.maximum)) return []
    const minimum = Number(state.minimum)
    return Array.from(
      { length: Number(state.maximum) - minimum + 1 },
      (_, index) => ({
        id: `number:${minimum + index}`,
        label: String(minimum + index),
      })
    )
  }
  const labels = new Set<string>()
  return state.options.filter((option) => {
    const label = option.label.trim().toLocaleLowerCase("ru")
    if (!label || labels.has(label)) return false
    labels.add(label)
    return true
  })
}

export function availableDecisions(state: DecisionState) {
  const excluded = new Set(state.excluded)
  return decisionOptions(state).filter(
    (option) => !state.withoutRepeats || !excluded.has(option.id)
  )
}

export function chooseDecision(
  state: DecisionState,
  randomWord = () => crypto.getRandomValues(new Uint32Array(1))[0]
) {
  const options = availableDecisions(state)
  if (!options.length) return null
  // Rejection sampling gives each option the same chance, including at the Uint32 boundary.
  const limit = Math.floor(0x100000000 / options.length) * options.length
  let word: number
  do {
    word = randomWord()
  } while (word >= limit)
  return options[word % options.length]
}

export function recordDecision(
  state: DecisionState,
  option: DecisionOption
): DecisionState {
  return {
    ...state,
    excluded: state.withoutRepeats
      ? [...new Set([...state.excluded, option.id])]
      : state.excluded,
    history: [option.label.trim(), ...state.history].slice(0, 20),
  }
}

export function numberRangeError(minimum: string, maximum: string) {
  const min = Number(minimum),
    max = Number(maximum)
  if (
    !minimum.trim() ||
    !maximum.trim() ||
    !Number.isInteger(min) ||
    !Number.isInteger(max)
  )
    return "Укажите целые числа"
  if (Math.abs(min) > 1_000_000 || Math.abs(max) > 1_000_000)
    return "Числа должны быть от −1 000 000 до 1 000 000"
  if (min > max) return "Начало диапазона должно быть не больше конца"
  if (max - min >= 10_000) return "В диапазоне может быть до 10 000 чисел"
  return null
}
