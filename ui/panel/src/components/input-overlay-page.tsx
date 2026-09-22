import { useEffect, useState } from "react"

import { InputVisualizer } from "@/components/input-visualizer"
import {
  StudioRail,
  StudioStage,
  StudioWorkspace,
} from "@/components/page-layout"
import { Button } from "@/components/ui/button"
import {
  FormColor,
  FormSelect,
  FormSwitch,
  VisibilityButton,
} from "@/components/form-controls"
import { useToast } from "@/components/ui/toast"
import {
  DEFAULT_INPUT_OVERLAY_CONFIG,
  type InputOverlayConfig,
} from "@/domain/input-overlay"
import { useInputOverlay } from "@/hooks/use-input-overlay"

const colors = ["#d3fb75", "#b89aff", "#7ddcff", "#ff8fab", "#f8c86b"]

export function InputOverlayPage() {
  const { state, connected, busy, error, update, demo } = useInputOverlay()
  const [copied, setCopied] = useState(false)
  const showToast = useToast()
  const config = state?.config || DEFAULT_INPUT_OVERLAY_CONFIG
  const overlayOrigin = import.meta.env.DEV
    ? "http://127.0.0.1:4317"
    : location.origin
  const overlayUrl = `${overlayOrigin}/input-overlay`

  useEffect(() => {
    if (error) showToast({ message: error, tone: "error" })
  }, [error, showToast])

  useEffect(() => {
    if (
      state?.runtime.supported &&
      state.config.captureEnabled &&
      state.runtime.message
    )
      showToast({ message: state.runtime.message, tone: "error" })
  }, [
    showToast,
    state?.config.captureEnabled,
    state?.runtime.message,
    state?.runtime.supported,
  ])

  const change = (patch: Partial<InputOverlayConfig>) =>
    void update({ ...config, ...patch })

  const copyUrl = async () => {
    await navigator.clipboard.writeText(overlayUrl)
    setCopied(true)
    showToast({ message: "Ссылка на оверлей скопирована", tone: "success" })
    window.setTimeout(() => setCopied(false), 1600)
  }

  const runtimeLabel = state?.demo
    ? "Демо"
    : state?.runtime.listening
      ? "Ввод активен"
      : state?.runtime.supported
        ? state.runtime.message
          ? "Ошибка"
          : config.captureEnabled
            ? "Запуск…"
            : "Выключен"
        : "Windows"

  return (
    <StudioWorkspace
      aria-label="Оверлей клавиатуры и мыши"
      className="xl:grid-cols-[minmax(0,1fr)_21rem]"
    >
      <StudioStage className="bg-panel-muted px-6 py-5 lg:px-6 xl:overflow-y-auto">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`size-2 rounded-full ${state?.runtime.listening ? "bg-brand" : "bg-muted-foreground/35"}`}
            />
            {runtimeLabel}
          </div>
          <VisibilityButton
            visible={config.visible}
            disabled={busy}
            onChange={(visible) => change({ visible })}
          />
        </div>

        <div className="flex min-h-96 flex-1 items-center justify-center py-6">
          <InputVisualizer
            config={config}
            pressedKeys={state?.pressedKeys}
            pressedMouse={state?.pressedMouse}
            wheel={state?.wheel}
          />
        </div>
      </StudioStage>

      <StudioRail className="flex flex-col bg-panel px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium">Настройка</h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void update(DEFAULT_INPUT_OVERLAY_CONFIG)}
          >
            Сбросить
          </Button>
        </div>

        <div className="mt-5 space-y-0">
          <div>
            <FormSwitch
              label="Отслеживание"
              checked={config.captureEnabled}
              disabled={busy || !state?.runtime.supported}
              onCheckedChange={(captureEnabled) => change({ captureEnabled })}
            />
          </div>

          <FormSelect
            label="Набор клавиш"
            value={config.layout}
            disabled={busy}
            options={[
              ["fps", "FPS"],
              ["moba", "MOBA"],
              ["compact", "Мини"],
            ]}
            onChange={(layout) =>
              change({ layout: layout as InputOverlayConfig["layout"] })
            }
          />

          <FormColor
            value={config.accent}
            colors={colors.map((value) => ({ value, label: `Цвет ${value}` }))}
            disabled={busy}
            onChange={(accent) => change({ accent })}
          />
          <FormSelect
            label="Фон"
            value={config.surface}
            disabled={busy}
            options={[
              ["solid", "Обычный"],
              ["glass", "Стекло"],
              ["minimal", "Без фона"],
            ]}
            onChange={(surface) =>
              change({ surface: surface as InputOverlayConfig["surface"] })
            }
          />

          <FormSelect
            label="Форма"
            value={config.keyShape}
            disabled={busy}
            options={[
              ["square", "Строго"],
              ["soft", "Мягко"],
              ["round", "Круглее"],
            ]}
            onChange={(keyShape) =>
              change({ keyShape: keyShape as InputOverlayConfig["keyShape"] })
            }
          />

          <FormSelect
            label="Размер"
            value={String(config.scale)}
            disabled={busy}
            options={[
              ["80", "80%"],
              ["100", "100%"],
              ["120", "120%"],
            ]}
            onChange={(scale) =>
              change({ scale: Number(scale) as InputOverlayConfig["scale"] })
            }
          />

          <FormSelect
            label="Прозрачность"
            value={String(config.opacity)}
            disabled={busy || config.surface === "minimal"}
            options={[
              ["70", "70%"],
              ["85", "85%"],
              ["100", "100%"],
            ]}
            onChange={(opacity) =>
              change({
                opacity: Number(opacity) as InputOverlayConfig["opacity"],
              })
            }
          />

          <div>
            <FormSwitch
              label="Мышь"
              checked={config.showMouse}
              disabled={busy}
              onCheckedChange={(showMouse) => change({ showMouse })}
            />
            <FormSwitch
              label="Колесо"
              checked={config.showWheel}
              disabled={busy || !config.showMouse}
              onCheckedChange={(showWheel) => change({ showWheel })}
            />
          </div>

          <Button
            className="h-10 w-full"
            disabled={busy || !connected || state?.demo}
            onClick={() => void demo()}
          >
            {state?.demo ? "Демо идёт" : "Проверить анимацию"}
          </Button>
        </div>
        <div className="mt-auto pt-8">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Источник OBS</span>
            <span className="text-muted-foreground">720 × 360 px</span>
          </div>
          <div
            className="mt-2 truncate rounded-md bg-surface-subtle px-2.5 py-2 font-mono text-[11px] text-muted-foreground"
            title={overlayUrl}
          >
            {overlayUrl}
          </div>
          <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={overlayUrl} target="_blank" rel="noreferrer">
                Открыть
              </a>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void copyUrl()}
            >
              {copied ? "Скопировано" : "Копировать ссылку"}
            </Button>
          </div>
        </div>
      </StudioRail>
    </StudioWorkspace>
  )
}
