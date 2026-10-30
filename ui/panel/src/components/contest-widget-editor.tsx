import { useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  Palette,
  RectangleHorizontal,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { publicContest } from "../../../../public/contest-overlay-model.js"
import type {
  ContestOverlaySettings,
  PublicContest,
} from "../../../../public/contest-overlay-model.js"
import type { Contest } from "@/domain/contest"
import type { WidgetKind } from "./widget-kind-tabs"
import { WidgetStudioToolbar } from "./widget-studio-toolbar"
import { ContestOverlayView } from "./contest-overlay-view"
import { NumberProperty, ColorProperty } from "./widget-properties"
import { FormSwitch } from "./form-controls"

type Preview = "collecting" | "ready" | "drawing" | "winner" | "number" | "live"
export function ContestWidgetEditor({
  contest,
  settings,
  onUpdate,
  onSelectKind,
}: {
  contest: Contest | null
  settings: ContestOverlaySettings
  onUpdate: (patch: Partial<ContestOverlaySettings>) => void
  onSelectKind: (kind: WidgetKind) => void
}) {
  const id = useId()
  const [mode, setMode] = useState<Preview>("collecting")
  const [seed, setSeed] = useState(Date.now)
  const [scene, setScene] = useState("dark")
  const [panel, setPanel] = useState<"layout" | "colors" | "content" | null>(
    null
  )
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [height, setHeight] = useState(400)
  const stage = useRef<HTMLDivElement>(null),
    object = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const outer = stage.current,
      inner = object.current
    if (!outer || !inner) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === outer)
          setSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          })
        else setHeight(entry.contentRect.height)
      }
    })
    observer.observe(outer)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [])
  const sample = useMemo<PublicContest | null>(() => {
    if (mode === "live") return null
    const now = seed
    return {
      id: `demo:${seed}`,
      status:
        mode === "number" ? "collecting" : mode === "drawing" ? "winner" : mode,
      mode: mode === "number" ? "number" : "keyword",
      keyword: "участвую",
      numberMin: 1,
      numberMax: 100,
      winningNumber: null,
      deadline: now + 42000,
      drawnAt: mode === "drawing" ? now : now - 3000,
      participantCount: 128,
      recentNames: [
        "PixelFox",
        "MoonByte",
        "peachysoul",
        "Kira",
        "LimeCat",
        "exyyyl",
      ],
      winner:
        mode === "winner" || mode === "drawing" ? { name: "peachysoul" } : null,
    }
  }, [mode, seed])
  const preview = mode === "live" ? publicContest(contest) : sample
  const scale = Math.min(
    1,
    Math.max(0.1, (size.width - 32) / (settings.width + 48)),
    Math.max(0.1, (size.height - 32) / height)
  )
  const origin = import.meta.env.DEV ? "http://127.0.0.1:4317" : location.origin
  const sections = [
    ["layout", "Макет", RectangleHorizontal],
    ["colors", "Цвета", Palette],
    ["content", "Состав", SlidersHorizontal],
  ] as const
  const properties = {
    layout: (
      <>
        <NumberProperty
          label="Ширина"
          value={settings.width}
          min={280}
          max={1200}
          onChange={(width) => onUpdate({ width })}
        />
        <NumberProperty
          label="Размер текста"
          value={settings.fontSize}
          min={16}
          max={40}
          onChange={(fontSize) => onUpdate({ fontSize })}
        />
        <NumberProperty
          label="Скругление"
          value={settings.radius}
          min={0}
          max={40}
          onChange={(radius) => onUpdate({ radius })}
        />
        <NumberProperty
          label="Непрозрачность"
          value={settings.opacity}
          min={0}
          max={100}
          unit="%"
          onChange={(opacity) => onUpdate({ opacity })}
        />
      </>
    ),
    colors: (
      <>
        <ColorProperty
          label="Акцент"
          value={settings.accentColor}
          onChange={(accentColor) => onUpdate({ accentColor })}
        />
        <ColorProperty
          label="Фон"
          value={settings.backgroundColor}
          onChange={(backgroundColor) => onUpdate({ backgroundColor })}
        />
        <ColorProperty
          label="Текст"
          value={settings.textColor}
          onChange={(textColor) => onUpdate({ textColor })}
        />
      </>
    ),
    content: (
      <>
        <FormSwitch
          label="Таймер"
          checked={settings.showTimer}
          onCheckedChange={(showTimer) => onUpdate({ showTimer })}
        />
        <FormSwitch
          label="Число участников"
          checked={settings.showCount}
          onCheckedChange={(showCount) => onUpdate({ showCount })}
        />
        <FormSwitch
          label="Последние участники"
          checked={settings.showRecent}
          onCheckedChange={(showRecent) => onUpdate({ showRecent })}
        />
      </>
    ),
  }
  return (
    <section className="widget-studio" aria-label="Редактор виджета конкурса">
      <WidgetStudioToolbar
        kind="contests"
        enabled={settings.enabled}
        url={origin + "/contest-overlay"}
        dimensions={`${settings.width + 48} × ${Math.max(720, Math.ceil(height))} px`}
        scene={scene}
        onSceneChange={setScene}
        onToggleOutput={() => onUpdate({ enabled: !settings.enabled })}
        onSelectKind={onSelectKind}
        previewControls={
          <div
            className="studio-toolbar-modes"
            role="group"
            aria-label="Источник конкурса на холсте"
          >
            <button
              type="button"
              aria-pressed={mode !== "live"}
              onClick={() => {
                if (mode === "live") {
                  setMode("collecting")
                  setSeed(Date.now())
                }
              }}
            >
              Демо
            </button>
            <button
              type="button"
              aria-pressed={mode === "live"}
              onClick={() => setMode("live")}
            >
              Текущий конкурс
            </button>
          </div>
        }
        testControls={
          <>
            {(
              [
                ["collecting", "Приём"],
                ["ready", "Набор закрыт"],
                ["drawing", "Рулетка"],
                ["winner", "Победитель"],
                ["number", "Число"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value)
                  setSeed(Date.now())
                }}
              >
                {label}
              </button>
            ))}
          </>
        }
      />
      <div className="widget-canvas-workspace">
        <div className="widget-canvas" data-background={scene} ref={stage}>
          <div
            style={{
              width: (settings.width + 48) * scale,
              height: height * scale,
              position: "relative",
              flex: "none",
              margin: 16,
            }}
          >
            <div
              ref={object}
              style={{
                width: settings.width + 48,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                position: "absolute",
              }}
            >
              {preview ? (
                <ContestOverlayView
                  contest={preview}
                  settings={settings}
                  preview
                />
              ) : (
                <div className="widget-unavailable">
                  <p>Запусти конкурс в разделе «Конкурсы» или выбери «Демо».</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="widget-edit-dock">
        <div
          className="widget-edit-navigation"
          role="group"
          aria-label="Настроить виджет конкурса"
        >
          {sections.map(([key, label, Icon]) => (
            <button
              type="button"
              key={key}
              aria-pressed={panel === key}
              aria-expanded={panel === key}
              aria-controls={id}
              data-active={panel === key || undefined}
              onClick={() =>
                setPanel((current) => (current === key ? null : key))
              }
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
          {panel && (
            <button
              type="button"
              className="widget-close-properties"
              aria-label="Закрыть настройки"
              onClick={() => setPanel(null)}
            >
              <X />
            </button>
          )}
        </div>
        {panel && (
          <div
            className="widget-property-tray"
            id={id}
            role="region"
            aria-label={`Настройки: ${sections.find((item) => item[0] === panel)![1]}`}
          >
            <div className="widget-property-grid">{properties[panel]}</div>
          </div>
        )}
      </div>
    </section>
  )
}
