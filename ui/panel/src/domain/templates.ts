import type { ContestSetup } from "./contest"
import type { DecisionState } from "./decision-wheel"
import type { Draft, Preset, WidgetSettings } from "./polls"
import type { ChatOverlaySettings } from "../../../../public/chat-overlay-model.js"
import type { ContestOverlaySettings } from "../../../../public/contest-overlay-model.js"

export type TemplateData = {
  contest: ContestSetup
  wheel: Pick<
    DecisionState,
    "mode" | "minimum" | "maximum" | "options" | "withoutRepeats"
  >
  "poll-widget": WidgetSettings
  "chat-widget": Omit<ChatOverlaySettings, "enabled">
  "contest-widget": Omit<ContestOverlaySettings, "enabled">
}
export type TemplateKind = keyof TemplateData
export type SavedTemplate = {
  [K in TemplateKind]: {
    id: string
    name: string
    kind: K
    data: TemplateData[K]
    pinned: boolean
  }
}[TemplateKind]
export type LibraryTemplate =
  SavedTemplate | (Preset & { kind: "poll"; data: Draft })
export const templateLabels = {
  poll: "Опросы",
  contest: "Конкурсы",
  wheel: "Рулетка",
  "poll-widget": "Виджет опроса",
  "chat-widget": "Виджет чата",
  "contest-widget": "Виджет конкурса",
} as const
export type LibraryKind = keyof typeof templateLabels
export function wheelTemplate(state: DecisionState): TemplateData["wheel"] {
  return {
    mode: state.mode,
    minimum: state.minimum,
    maximum: state.maximum,
    options: state.options.filter((option) => option.label.trim()),
    withoutRepeats: state.withoutRepeats,
  }
}
export function templateSummary(template: LibraryTemplate): string {
  if (template.kind === "poll") return template.data.question
  if (template.kind === "contest") {
    const data = template.data
    return `${data.mode === "keyword" ? `Слово: ${data.keyword}` : data.mode === "active" ? "Активные зрители" : `Числа: ${data.numberMin}–${data.numberMax}`} · ${data.duration} с`
  }
  if (template.kind === "wheel")
    return template.data.mode === "list"
      ? template.data.options.map((item) => item.label).join(", ")
      : template.data.mode === "number"
        ? `${template.data.minimum}–${template.data.maximum}`
        : "Да / Нет"
  if (template.kind === "poll-widget")
    return `${template.data.layout === "horizontal" ? "Горизонтальный" : "Вертикальный"} · ${template.data.panelWidth} px`
  if (template.kind === "chat-widget")
    return `${{ cards: "Студия", minimal: "Лента", bubble: "Диалог" }[template.data.style]} · ${template.data.fontSize} px · ${template.data.maxMessages} сообщений`
  return `${template.data.width} px · текст ${template.data.fontSize} px`
}
