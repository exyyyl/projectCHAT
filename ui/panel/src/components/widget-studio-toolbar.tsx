import { useId, useRef, useState } from "react"
import type { ReactNode } from "react"
import {
  SlidersHorizontal,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react"
import { Popover } from "radix-ui"
import { Button } from "@/components/ui/button"
import { useCopyLink } from "@/hooks/use-copy-link"
import { WidgetKindTabs } from "./widget-kind-tabs"
import type { WidgetKind } from "./widget-kind-tabs"

export function WidgetStudioToolbar({
  kind,
  enabled,
  disabled = false,
  url,
  dimensions,
  previewControls,
  testControls,
  scene,
  onToggleOutput,
  onSceneChange,
  onSelectKind,
}: {
  kind: WidgetKind
  enabled: boolean
  disabled?: boolean
  url: string
  dimensions: string
  previewControls: ReactNode
  testControls: ReactNode
  scene: string
  onToggleOutput: () => void
  onSceneChange: (scene: string) => void
  onSelectKind: (kind: WidgetKind) => void
}) {
  const { copied, copy } = useCopyLink(url)
  const [testing, setTesting] = useState(false)
  const testId = useId()
  const testTrigger = useRef<HTMLButtonElement>(null)
  const label = { chat: "чат", polls: "опрос", contests: "конкурс" }[kind]
  const visibilityAction = enabled ? "Скрыть оверлей" : "Показать оверлей"
  return (
    <>
      <header className="widget-studio-toolbar studio-toolbar">
        <div className="studio-toolbar-context">
          <WidgetKindTabs kind={kind} onChange={onSelectKind} />
          <div
            className="studio-toolbar-preview"
            role="group"
            aria-label="Проверка оформления"
          >
            {previewControls}
            <button
              ref={testTrigger}
              type="button"
              className="studio-toolbar-test"
              aria-expanded={testing}
              aria-controls={testId}
              onClick={() => setTesting((value) => !value)}
              title="Тестовые состояния и фон холста"
            >
              <SlidersHorizontal aria-hidden="true" />
              <span>Тест</span>
            </button>
          </div>
        </div>
        <div
          className="studio-toolbar-output"
          role="group"
          aria-label={`Вывод: ${label} в OBS`}
        >
          <button
            type="button"
            className="studio-toolbar-visibility"
            aria-label={`Показывать ${label} в OBS`}
            disabled={disabled}
            aria-pressed={enabled}
            title={visibilityAction}
            onClick={onToggleOutput}
          >
            {enabled ? (
              <Eye aria-hidden="true" />
            ) : (
              <EyeOff aria-hidden="true" />
            )}
            <span>{enabled ? "Скрыть оверлей" : "Показать оверлей"}</span>
          </button>
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button
                variant="secondary"
                size="sm"
                title={`Подключить ${label} к OBS`}
                aria-label={`Подключить ${label} к OBS`}
              >
                <ExternalLink aria-hidden="true" />
                Подключить OBS
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="widget-small-popover studio-connect"
                align="end"
                sideOffset={8}
                collisionPadding={12}
              >
                <strong>Оверлей для OBS</strong>
                <p>Добавь источник «Браузер» и вставь ссылку.</p>
                <code>{url}</code>
                <span>{dimensions} · прозрачный фон</span>
                <Button size="sm" onClick={copy}>
                  <Copy aria-hidden="true" />
                  {copied ? "Скопировано" : "Копировать ссылку"}
                </Button>
                <a href={url} target="_blank" rel="noreferrer">
                  Открыть оверлей <ExternalLink aria-hidden="true" />
                </a>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
        {testing && (
          <div
            className="studio-toolbar-test-tray"
            id={testId}
            role="region"
            aria-label="Тестовые состояния и фон"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation()
                setTesting(false)
                testTrigger.current?.focus()
              }
            }}
          >
            <div
              className="studio-toolbar-samples"
              role="group"
              aria-label="Тестовые состояния"
            >
              {testControls}
            </div>
            <div
              className="studio-toolbar-backgrounds"
              role="group"
              aria-label="Фон холста"
            >
              {(
                [
                  ["dark", "Тёмный"],
                  ["light", "Светлый"],
                  ["chroma", "Хромакей"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-label={"Фон: " + label}
                  title={label}
                  data-scene={value}
                  aria-pressed={scene === value}
                  onClick={() => onSceneChange(value)}
                >
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}
      </header>
    </>
  )
}
