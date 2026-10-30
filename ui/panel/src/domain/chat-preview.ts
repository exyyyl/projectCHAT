import type { ChatMessage } from "./chat"

export const chatPreviewSamples = [
  ["regular", "Демонстрация"],
  ["long", "Длинное сообщение"],
  ["word", "Текст без пробелов"],
  ["link", "Длинная ссылка"],
  ["emotes", "Много смайликов"],
] as const
export type ChatPreviewKind = (typeof chatPreviewSamples)[number][0]

const names = [
  "peachysoul",
  "MoonByte",
  "exyyyl",
  "PixelFox",
  "Kira",
  "LimeCat",
]
const texts = [
  "Всем привет! 👋",
  "Вот это момент",
  "Kappa",
  "Давайте ещё один раунд",
  "Это было неожиданно ✨",
  "Спасибо за стрим 💛",
]
const colors = [
  "#d9a7ff",
  "#78d5c8",
  "#b9d88a",
  "#ffbb82",
  "#8cbcff",
  "#f1a5bb",
]

// Editor-only fixtures never enter the archive or the Twitch send queue.
export function createChatPreviewMessage(
  id: number,
  kind: ChatPreviewKind = "regular",
  now = Date.now()
): ChatMessage {
  const index = (id - 1) % names.length
  const text =
    kind === "long"
      ? "Длинное сообщение должно оставаться внутри виджета и читаться на нескольких строках. Зрители обсуждают стрим, делятся впечатлениями и задают вопросы — даже когда текста очень много.\nНовый абзац тоже сохраняется. ".repeat(
          2
        )
      : kind === "word"
        ? "ОченьДлинноеСообщениеБезПробелов".repeat(20).slice(0, 500)
        : kind === "link"
          ? "https://example.com/" + "long-stream-message-".repeat(24)
          : kind === "emotes"
            ? Array(40).fill("Kappa").join(" ")
            : texts[index]
  return {
    id,
    kind: "message",
    activityType: "",
    viewerId: `demo:${index}`,
    viewerName: names[index],
    viewerLogin: names[index].toLowerCase(),
    text,
    roles: [],
    badges: [],
    nameColor: colors[index],
    cheerBits: 0,
    sentAt: now,
    emotes:
      kind === "emotes"
        ? Array.from({ length: 40 }, (_, i) => ({
            start: i * 6,
            end: i * 6 + 5,
            id: "25",
          }))
        : text === "Kappa"
          ? [{ start: 0, end: 5, id: "25" }]
          : [],
  }
}
