import type { WidgetSettings } from "./polls"
import type { ContestOverlaySettings } from "../../../../public/contest-overlay-model.js"

type Look<T> = { id: string; name: string; settings: Partial<T> }
const palettes = [
  {
    id: "cue",
    background: "#111318",
    text: "#f4f4f5",
    muted: "#a1a5af",
    accent: "#d3fb75",
    track: "#30343c",
  },
  {
    id: "violet",
    background: "#19171f",
    text: "#f1eef5",
    muted: "#b4aebf",
    accent: "#b4a3d4",
    track: "#343039",
  },
  {
    id: "ocean",
    background: "#151b20",
    text: "#eef1f3",
    muted: "#a7b2b9",
    accent: "#a1bcc8",
    track: "#30383e",
  },
  {
    id: "paper",
    background: "#f3f3f0",
    text: "#252628",
    muted: "#63665f",
    accent: "#58644d",
    track: "#d9dcd5",
  },
  {
    id: "ember",
    background: "#1d1a18",
    text: "#f0ede9",
    muted: "#b8afa5",
    accent: "#c6ad91",
    track: "#37322d",
  },
  {
    id: "rose",
    background: "#1e1a1d",
    text: "#f2edf0",
    muted: "#b7aeb3",
    accent: "#c5a2b1",
    track: "#383137",
  },
  {
    id: "mono",
    background: "#1a1a1c",
    text: "#f1f1f2",
    muted: "#acadb2",
    accent: "#c5c6ca",
    track: "#36363b",
  },
  {
    id: "transparent",
    background: "#111318",
    text: "#f4f4f5",
    muted: "#bfc1c7",
    accent: "#c5c6ca",
    track: "#44474f",
  },
] as const

const pollBase: Partial<WidgetSettings> = {
  font: "geist",
  layout: "vertical",
  alignment: "left",
  panelWidth: 440,
  optionStyle: "cards",
  keywordStyle: "filled",
  cornerRadius: 16,
  titleFontSize: 30,
  optionFontSize: 16,
  padding: 24,
  gap: 12,
  barHeight: 6,
}
const pollCompositions: Record<
  (typeof palettes)[number]["id"],
  Partial<WidgetSettings>
> = {
  cue: {},
  violet: {
    panelWidth: 480,
    optionStyle: "rows",
    keywordStyle: "text",
    cornerRadius: 14,
    titleFontSize: 30,
    barHeight: 4,
  },
  ocean: {
    font: "system",
    layout: "horizontal",
    panelWidth: 960,
    cornerRadius: 14,
    titleFontSize: 28,
    gap: 12,
    barHeight: 4,
  },
  paper: {
    font: "serif",
    panelWidth: 480,
    optionStyle: "rows",
    keywordStyle: "text",
    cornerRadius: 12,
    titleFontSize: 30,
    optionFontSize: 18,
    barHeight: 3,
  },
  ember: {
    font: "system",
    layout: "grid",
    panelWidth: 800,
    cornerRadius: 14,
    titleFontSize: 28,
    barHeight: 4,
  },
  rose: {
    layout: "grid",
    panelWidth: 760,
    cornerRadius: 16,
    titleFontSize: 30,
    keywordStyle: "text",
    barHeight: 4,
  },
  mono: {
    font: "mono",
    panelWidth: 420,
    optionStyle: "outline",
    keywordStyle: "text",
    cornerRadius: 12,
    titleFontSize: 24,
    optionFontSize: 14,
    padding: 20,
    gap: 8,
    barHeight: 3,
  },
  transparent: {
    font: "system",
    layout: "horizontal",
    panelWidth: 1040,
    optionStyle: "rows",
    keywordStyle: "text",
    cornerRadius: 0,
    titleFontSize: 28,
    padding: 16,
    barHeight: 4,
  },
}
const contestBase: Partial<ContestOverlaySettings> = {
  font: "geist",
  layout: "stacked",
  alignment: "left",
  width: 480,
  fontSize: 24,
  radius: 16,
}
const contestCompositions: Record<
  (typeof palettes)[number]["id"],
  Partial<ContestOverlaySettings>
> = {
  cue: {},
  violet: { width: 500, radius: 14 },
  ocean: { font: "system", layout: "split", width: 680, radius: 14 },
  paper: { font: "serif", width: 520, fontSize: 26, radius: 12 },
  ember: { font: "system", layout: "split", width: 720, radius: 14 },
  rose: { width: 440, alignment: "center", radius: 16 },
  mono: {
    font: "mono",
    layout: "banner",
    width: 960,
    fontSize: 20,
    radius: 12,
  },
  transparent: {
    font: "system",
    layout: "banner",
    width: 1040,
    fontSize: 22,
    radius: 0,
  },
}
const names = {
  cue: "Cue",
  violet: "Ирис",
  ocean: "Панорама",
  paper: "Бумага",
  ember: "Янтарь",
  rose: "Роза",
  mono: "Графит",
  transparent: "Титр",
}
export const pollWidgetLooks: Look<WidgetSettings>[] = palettes.map((p) => ({
  id: p.id,
  name: names[p.id],
  settings: {
    panelColor: p.background,
    textColor: p.text,
    mutedColor: p.muted,
    accent: p.accent,
    trackColor: p.track,
    surface: p.id === "transparent" ? "minimal" : "solid",
    opacity: 100,
    ...pollBase,
    ...pollCompositions[p.id],
  },
}))
export const contestWidgetLooks: Look<ContestOverlaySettings>[] = palettes.map(
  (p) => ({
    id: p.id,
    name: names[p.id],
    settings: {
      backgroundColor: p.background,
      textColor: p.text,
      accentColor: p.accent,
      opacity: p.id === "transparent" ? 0 : 100,
      ...contestBase,
      ...contestCompositions[p.id],
    },
  })
)
export function matchesLook<T extends object>(settings: T, patch: Partial<T>) {
  return Object.entries(patch).every(
    ([key, value]) => settings[key as keyof T] === value
  )
}
