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
  "ae_evsoul",
  "kyst21",
  "marinaeslichto",
  "limaaay",
  "peachysoul",
  "exyyyl",
]
const longMessage = `Вот такая хуйня собачка Вот такая соба хуйнячка Вот такачка соба хуйня Такаватачка соба хуйня Соба такая хуй вотня Хуй собаня вот такачка Вот собаня хуй такачка Такаватая хуй собанячка Такабачья хуй соба вотня Така хуйная соба вотбачка Собаватая хуй такабачка Вотбачья хуй тока собаня Хуй собая такавотнячка Хуй такачка соба вотня`
const texts = [
  "Kappa",
  "За додобоны продам душу!",
  "Трудные времена создают сильных котят",
  "Я тебя могну, мо-мо-могну",
  longMessage,
  "халёу евринян!",
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
  const index =
    kind === "long" ? names.indexOf("peachysoul") : (id - 1) % names.length
  const text =
    kind === "long"
      ? longMessage
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
