export type PollOption = {
  id: string
  name: string
  word: string
  votes?: number
}

export type VoteActivity = {
  id: string
  viewerName: string
  avatarUrl?: string
  optionId: string
  previousOptionId?: string
  at: number
}

export type Draft = {
  question: string
  options: PollOption[]
  duration: number
  secret: boolean
  allowChange: boolean
  showOverlay: boolean
  source: "test" | "twitch"
}

export type Poll = Omit<Draft, "options"> & {
  id: string
  status: "running" | "ended"
  visible: boolean
  deadline: number
  startedAt: number
  broadcasterId?: string | null
  options: Array<PollOption & { votes: number }>
  activity: VoteActivity[]
}

export type Preset = {
  id: string
  name: string
  draft: Draft
  pinned: boolean
}

export type PresetDialogState =
  | { mode: "create"; editorId: string; draft?: Draft; name?: string }
  | { mode: "edit"; preset: Preset }

export type WidgetSettings = {
  accent: string
  surface: "solid" | "glass" | "minimal"
  density: "comfortable" | "compact"
  radius: "small" | "medium" | "large"
  titleSize: "small" | "medium" | "large"
  width: "narrow" | "medium" | "wide"
  opacity: 70 | 85 | 100
  font: "geist" | "system" | "mono"
  optionStyle: "rows" | "cards" | "outline"
  optionSize: "small" | "medium" | "large"
  keywordStyle: "outline" | "filled" | "text"
  barSize: "thin" | "medium" | "thick"
  showTimer: boolean
  showKeywords: boolean
  showBars: boolean
  showVotes: boolean
  showPercentages: boolean
}

export type ServerState = {
  revision: number
  draftRevision: number
  serverNow: number
  draft: Draft
  presets: Preset[]
  widget: WidgetSettings
  poll: Poll | null
}

export type TwitchState = {
  phase: string
  login: string
  displayName?: string
  profileImageUrl?: string
  userId?: string
  error?: string
  lastGapAt?: number | null
  device?: { code: string; url: string } | null
}

export type CommandResult = {
  state: ServerState
  outcome?: string
}

export const EMPTY_TWITCH: TwitchState = { phase: "loading", login: "" }

export function createBlankDraft(): Draft {
  return {
    question: "",
    options: [
      { id: "1", name: "", word: "" },
      { id: "2", name: "", word: "" },
    ],
    duration: 60,
    secret: false,
    allowChange: false,
    showOverlay: true,
    source: "twitch",
  }
}

export function percentages(options: Array<{ votes?: number }>) {
  const total = options.reduce((sum, option) => sum + (option.votes || 0), 0)
  if (!total) return options.map(() => 0)

  const exact = options.map((option) => ((option.votes || 0) / total) * 100)
  const rounded = exact.map(Math.floor)
  const order = exact
    .map((value, index) => ({ index, rest: value - rounded[index] }))
    .sort((a, b) => b.rest - a.rest)
  const remainder = 100 - rounded.reduce((sum, value) => sum + value, 0)
  for (let index = 0; index < remainder; index++) rounded[order[index].index]++
  return rounded
}

export function validateDraft(draft: Draft | null) {
  if (!draft?.question.trim()) return "Добавьте вопрос."
  if (draft.options.length < 2) return "Добавьте хотя бы два варианта."

  const words = new Set<string>()
  for (const option of draft.options) {
    if (!option.name.trim() || !option.word.trim())
      return "Заполните варианты и ключевые слова."
    const word = option.word.normalize("NFKC").trim().toLocaleLowerCase("ru")
    if (/\s/u.test(word)) return "Ключевое слово должно быть без пробелов."
    if (words.has(word)) return "Ключевые слова должны различаться."
    words.add(word)
  }
  if (
    !Number.isInteger(draft.duration) ||
    draft.duration < 10 ||
    draft.duration > 3600
  )
    return "Укажите время от 10 до 3600 секунд."
  return ""
}

export const formatTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`

export const pluralVotes = (count: number) =>
  `${count} ${
    count % 10 === 1 && count % 100 !== 11
      ? "голос"
      : count % 10 >= 2 &&
          count % 10 <= 4 &&
          !(count % 100 >= 12 && count % 100 <= 14)
        ? "голоса"
        : "голосов"
  }`
