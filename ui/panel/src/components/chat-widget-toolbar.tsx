import type { ReactNode } from "react"
import { Pause, Play } from "lucide-react"
import { WidgetStudioToolbar } from "./widget-studio-toolbar"
import type { WidgetKind } from "./widget-kind-tabs"
import type { ChatPreviewKind } from "@/domain/chat-preview"
export function ChatWidgetToolbar({
  enabled,
  source,
  playing,
  scene,
  onToggleOutput,
  onSourceChange,
  onTogglePlayback,
  onSceneChange,
  onSelectKind,
  templateAction,
}: {
  enabled: boolean
  templateAction?: ReactNode
  source: ChatPreviewKind | "live"
  playing: boolean
  scene: string
  onToggleOutput: () => void
  onSourceChange: (source: ChatPreviewKind | "live") => void
  onTogglePlayback: () => void
  onSceneChange: (scene: string) => void
  onSelectKind: (kind: WidgetKind) => void
}) {
  const origin = import.meta.env.DEV ? "http://127.0.0.1:4317" : location.origin
  return (
    <WidgetStudioToolbar
      kind="chat"
      enabled={enabled}
      url={origin + "/chat-overlay"}
      dimensions="480 × 720 px"
      scene={scene}
      onToggleOutput={onToggleOutput}
      onSceneChange={onSceneChange}
      onSelectKind={onSelectKind}
      templateAction={templateAction}
      previewControls={
        <>
          <div
            className="studio-toolbar-modes"
            role="group"
            aria-label="Источник сообщений на холсте"
          >
            <button
              type="button"
              aria-pressed={source !== "live"}
              onClick={() => {
                if (source === "live") onSourceChange("regular")
              }}
            >
              Демо
            </button>
            <button
              type="button"
              aria-pressed={source === "live"}
              onClick={() => {
                if (source !== "live") onSourceChange("live")
              }}
            >
              Твой чат
            </button>
          </div>
          {source !== "live" && (
            <button
              type="button"
              className="studio-toolbar-icon"
              aria-label={
                playing
                  ? "Приостановить демонстрацию"
                  : "Продолжить демонстрацию"
              }
              title={
                playing
                  ? "Приостановить демонстрацию"
                  : "Продолжить демонстрацию"
              }
              onClick={onTogglePlayback}
            >
              {playing ? <Pause /> : <Play />}
            </button>
          )}
        </>
      }
      testControls={
        <>
          {(
            [
              ["regular", "Обычное"],
              ["long", "Длинное"],
              ["word", "Без пробелов"],
              ["link", "Ссылка"],
              ["emotes", "Смайлики"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={source === value}
              onClick={() => onSourceChange(value)}
            >
              {label}
            </button>
          ))}
        </>
      }
    />
  )
}
