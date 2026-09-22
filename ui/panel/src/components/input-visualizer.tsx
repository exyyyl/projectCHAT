import {
  INPUT_LAYOUTS,
  type InputOverlayConfig,
} from "@/domain/input-overlay"

type InputVisualizerProps = {
  config: InputOverlayConfig
  pressedKeys?: string[]
  pressedMouse?: string[]
  wheel?: "up" | "down" | null
}

const labels: Record<string, string> = {
  Alt: "ALT",
  Ctrl: "CTRL",
  Shift: "SHIFT",
  Space: "SPACE",
}

export function InputVisualizer({
  config,
  pressedKeys = [],
  pressedMouse = [],
  wheel = null,
}: InputVisualizerProps) {
  const activeKeys = new Set(pressedKeys)
  const activeMouse = new Set(pressedMouse)

  return (
    <div
      className={`input-visualizer input-surface-${config.surface} input-shape-${config.keyShape}`}
      style={
        {
          "--input-accent": config.accent,
          "--input-opacity": config.opacity / 100,
          "--input-scale": config.scale / 100,
        } as React.CSSProperties
      }
    >
      <div className={`input-keyboard input-layout-${config.layout}`}>
        {INPUT_LAYOUTS[config.layout].map((row, index) => (
          <div className="input-key-row" key={`${config.layout}-${index}`}>
            {row.map((code) => (
              <span
                key={code}
                data-code={code}
                className={`input-key ${activeKeys.has(code) ? "is-active" : ""}`}
              >
                {labels[code] || code}
              </span>
            ))}
          </div>
        ))}
      </div>

      {config.showMouse && (
        <div
          className={`input-mouse ${config.showWheel ? "" : "input-hide-wheel"}`}
          aria-label="Мышь"
        >
          <span
            className={`input-mouse-button input-mouse-left ${activeMouse.has("left") ? "is-active" : ""}`}
          />
          <span
            className={`input-mouse-button input-mouse-right ${activeMouse.has("right") ? "is-active" : ""}`}
          />
          <span className={`input-mouse-wheel ${wheel ? "is-active" : ""}`}>
            <i />
          </span>
          <span
            className={`input-mouse-side input-mouse-back ${activeMouse.has("back") ? "is-active" : ""}`}
          />
          <span
            className={`input-mouse-side input-mouse-forward ${activeMouse.has("forward") ? "is-active" : ""}`}
          />
        </div>
      )}
    </div>
  )
}
