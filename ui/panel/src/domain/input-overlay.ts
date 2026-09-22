export type InputLayout = "fps" | "moba" | "compact"
export type InputSurface = "solid" | "glass" | "minimal"
export type InputKeyShape = "soft" | "round" | "square"

export type InputOverlayConfig = {
  accent: string
  captureEnabled: boolean
  keyShape: InputKeyShape
  layout: InputLayout
  opacity: 70 | 85 | 100
  scale: 80 | 100 | 120
  showMouse: boolean
  showWheel: boolean
  surface: InputSurface
  visible: boolean
}

export type InputOverlayState = {
  schema: 1
  revision: number
  config: InputOverlayConfig
  pressedKeys: string[]
  pressedMouse: string[]
  wheel: "up" | "down" | null
  demo: boolean
  runtime: {
    supported: boolean
    listening: boolean
    platform: string
    message: string
  }
}

export const INPUT_LAYOUTS: Record<InputLayout, string[][]> = {
  fps: [
    ["1", "2", "3", "4", "5"],
    ["Q", "W", "E", "R", "F"],
    ["A", "S", "D"],
    ["Shift", "Ctrl", "Space"],
  ],
  moba: [
    ["1", "2", "3", "4", "5", "6"],
    ["Q", "W", "E", "R"],
    ["D", "F", "Space"],
    ["Ctrl", "Alt"],
  ],
  compact: [["W"], ["A", "S", "D"], ["Shift", "Space"]],
}

export const DEFAULT_INPUT_OVERLAY_CONFIG: InputOverlayConfig = {
  accent: "#d3fb75",
  captureEnabled: false,
  keyShape: "soft",
  layout: "fps",
  opacity: 85,
  scale: 100,
  showMouse: true,
  showWheel: true,
  surface: "glass",
  visible: true,
}
