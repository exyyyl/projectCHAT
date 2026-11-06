import { WidgetFontSelect } from "./widget-font-select"
import { WidgetLookGallery } from "./widget-look-gallery"
import { TemplateSaveButton, type SaveTemplate } from "./template-save-button"
import type { SavedTemplate, TemplateKind } from "@/domain/templates"
import type { ReactNode } from "react"
import { AnimatedSettings } from "@/components/animated-settings"
import type { ContestOverlaySettings } from "../../../../public/contest-overlay-model.js"
import { useId, useLayoutEffect, useRef, useState } from "react"
import {
  ListChecks,
  Palette,
  LayoutTemplate,
  RectangleHorizontal,
  RotateCcw,
  SlidersHorizontal,
  Type,
  X,
} from "lucide-react"
import {
  resolveWidget,
  widgetDefaults,
} from "../../../../public/widget-model.js"
import { FormSelect, FormSwitch } from "@/components/form-controls"
import { PollOverlay } from "@/components/poll-overlay"
import { NumberProperty, ColorProperty } from "./widget-properties"
import type { Contest } from "@/domain/contest"
import type { Draft, Poll, WidgetSettings } from "@/domain/polls"
import { ChatWidgetEditor } from "./chat-widget-editor"
import { WidgetStudioToolbar } from "./widget-studio-toolbar"
import { ContestWidgetEditor } from "./contest-widget-editor"
import type { WidgetKind } from "./widget-kind-tabs"
import type { ChatOverlaySettings } from "../../../../public/chat-overlay-model.js"
import "./widget-studio.css"

/* Widget studio · Operate
   A quiet canvas comes first. Selecting a part opens one small property tray below it.
   Cue controls and overlay customization remain independent; no permanent inspector.
*/

type WidgetPageProps = {
  initialKind?: WidgetKind
  onSaveTemplate?: SaveTemplate
  templates?: SavedTemplate[]
  templateAction?: ReactNode
  contestOverlay: ContestOverlaySettings
  onUpdateContestOverlay: (patch: Partial<ContestOverlaySettings>) => void
  chatOverlay: ChatOverlaySettings
  onUpdateChatOverlay: (patch: Partial<ChatOverlaySettings>) => void
  contest?: Contest | null
  poll: Poll | null
  draft: Draft
  widget: WidgetSettings
  busy: boolean
  onUpdate: (patch: Partial<WidgetSettings>) => void
  onSetOutput: (visible: boolean) => void
}

type PreviewMode = "results" | "empty" | "ended" | "live"
const colorFields = [
  ["accent", "Акцент"],
  ["panelColor", "Фон"],
  ["textColor", "Основной текст"],
  ["mutedColor", "Вторичный текст"],
  ["trackColor", "Подложка полос"],
] as const
const contentFields = [
  ["showTimer", "Таймер"],
  ["showKeywords", "Ключевые слова"],
  ["showVotes", "Количество голосов"],
  ["showPercentages", "Проценты"],
  ["showBars", "Полосы результатов"],
  ["showTotal", "Общее число голосов"],
  ["showNumbers", "Нумерация вариантов"],
  ["highlightWinner", "Выделять победителя"],
] as const

export function WidgetPage(props: WidgetPageProps) {
  const [selected, setSelected] = useState<WidgetKind>(
    props.initialKind || "polls"
  )
  const kind: TemplateKind =
    selected === "polls"
      ? "poll-widget"
      : selected === "chat"
        ? "chat-widget"
        : "contest-widget"
  const templateAction = props.onSaveTemplate ? (
    <TemplateSaveButton
      compact
      kind={kind}
      data={
        selected === "polls"
          ? props.widget
          : selected === "chat"
            ? props.chatOverlay
            : props.contestOverlay
      }
      current={props.templates?.find((template) => template.kind === kind)}
      onSave={props.onSaveTemplate}
      disabled={props.busy}
    />
  ) : undefined
  if (selected === "chat")
    return (
      <ChatWidgetEditor
        settings={props.chatOverlay}
        onUpdate={props.onUpdateChatOverlay}
        onSelectKind={setSelected}
        templateAction={templateAction}
      />
    )
  if (selected === "contests")
    return (
      <ContestWidgetEditor
        contest={props.contest ?? null}
        settings={props.contestOverlay}
        onUpdate={props.onUpdateContestOverlay}
        onSelectKind={setSelected}
        templateAction={templateAction}
      />
    )
  return (
    <PollWidgetEditor
      {...props}
      templateAction={templateAction}
      onSelectKind={setSelected}
    />
  )
}

function PollWidgetEditor({
  poll,
  draft,
  widget: savedWidget,
  busy,
  onUpdate,
  onSetOutput,
  onSelectKind,
  templateAction,
}: WidgetPageProps & { onSelectKind: (kind: WidgetKind) => void }) {
  const controlId = useId()
  const widget = resolveWidget(savedWidget)
  const [previewMode, setPreviewMode] = useState<PreviewMode>("results")
  const [background, setBackground] = useState("dark")
  const [zoom, setZoom] = useState("fit")
  const [panel, setPanel] = useState<
    "look" | "layout" | "text" | "options" | "colors" | "content" | null
  >(null)
  const [measurement, setMeasurement] = useState({ width: 600, height: 500 })
  const [objectHeight, setObjectHeight] = useState(500)
  const stageRef = useRef<HTMLDivElement>(null)
  const objectRef = useRef<HTMLDivElement>(null)
  const visible = poll ? poll.visible : draft.showOverlay
  const overlayOrigin = import.meta.env.DEV
    ? "http://127.0.0.1:4317"
    : location.origin
  const overlayUrl = overlayOrigin + "/overlay"
  const synthetic = previewMode !== "live"
  const preview: Draft | Poll = synthetic
    ? {
        ...draft,
        secret: false,
        duration: previewMode === "ended" ? 0 : 42,
        options: draft.options.map((option, index) => ({
          ...option,
          votes:
            previewMode === "empty" ? 0 : [148, 92, 56, 31, 18, 9][index] || 0,
        })),
      }
    : poll || draft

  useLayoutEffect(() => {
    const stage = stageRef.current,
      object = objectRef.current
    if (!stage || !object) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (
          entry.target === stage &&
          entry.contentRect.width > 0 &&
          entry.contentRect.height > 0
        )
          setMeasurement({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          })
        if (entry.target === object && entry.contentRect.height > 0)
          setObjectHeight(Math.ceil(entry.contentRect.height))
      }
    })
    observer.observe(stage)
    observer.observe(object)
    return () => observer.disconnect()
  }, [])

  const sourceWidth = widget.panelWidth + 48
  const sourceHeight = objectHeight + 48
  const fit = Math.min(
    1,
    Math.max(0.1, (measurement.width - 48) / sourceWidth),
    Math.max(0.1, (measurement.height - 48) / sourceHeight)
  )
  const scale = zoom === "fit" ? fit : Number(zoom)
  const updateFormat = (layout: WidgetSettings["layout"]) =>
    onUpdate({
      layout,
      panelWidth: layout === "horizontal" ? 960 : layout === "grid" ? 760 : 440,
    })

  const sections = [
    ["look", "Оформление", LayoutTemplate],
    ["layout", "Макет", RectangleHorizontal],
    ["text", "Текст", Type],
    ["options", "Варианты", ListChecks],
    ["colors", "Цвета", Palette],
    ["content", "Состав", SlidersHorizontal],
  ] as const

  const properties = {
    look: (
      <WidgetLookGallery kind="poll" settings={widget} onUpdate={onUpdate} />
    ),
    layout: (
      <>
        <FormSelect
          disabled={false}
          label="Формат"
          value={widget.layout}
          options={[
            ["vertical", "Вертикальный"],
            ["horizontal", "Горизонтальный"],
            ["grid", "Сетка"],
          ]}
          onChange={(value) => {
            if (value !== widget.layout)
              updateFormat(value as WidgetSettings["layout"])
          }}
        />
        <NumberProperty
          label="Ширина"
          value={widget.panelWidth}
          min={widget.layout === "vertical" ? 280 : 640}
          max={1600}
          onChange={(panelWidth) => onUpdate({ panelWidth })}
        />
        <NumberProperty
          label="Внутренний отступ"
          value={widget.padding}
          min={8}
          max={64}
          onChange={(padding) => onUpdate({ padding })}
        />
        <NumberProperty
          label="Скругление"
          value={widget.cornerRadius}
          min={0}
          max={48}
          onChange={(cornerRadius) => onUpdate({ cornerRadius })}
        />
      </>
    ),
    text: (
      <>
        <FormSelect
          disabled={false}
          label="Выравнивание заголовка"
          value={widget.alignment}
          options={[
            ["left", "По левому краю"],
            ["center", "По центру"],
          ]}
          onChange={(alignment) =>
            onUpdate({ alignment: alignment as WidgetSettings["alignment"] })
          }
        />

        <WidgetFontSelect
          value={widget.font}
          onChange={(font) => onUpdate({ font })}
        />
        <NumberProperty
          label="Размер вопроса"
          value={widget.titleFontSize}
          min={16}
          max={64}
          onChange={(titleFontSize) => onUpdate({ titleFontSize })}
        />
        <NumberProperty
          label="Размер вариантов"
          value={widget.optionFontSize}
          min={12}
          max={32}
          onChange={(optionFontSize) => onUpdate({ optionFontSize })}
        />
      </>
    ),
    options: (
      <>
        <FormSelect
          disabled={false}
          label="Оформление"
          value={widget.optionStyle}
          options={[
            ["cards", "Карточки"],
            ["fill", "Заливка по голосам"],
            ["rows", "Строки"],
            ["outline", "Контур"],
          ]}
          onChange={(optionStyle) =>
            onUpdate({
              optionStyle: optionStyle as WidgetSettings["optionStyle"],
            })
          }
        />
        <FormSelect
          disabled={false}
          label="Ключевые слова"
          value={widget.keywordStyle}
          options={[
            ["filled", "Мягкая заливка"],
            ["outline", "Контур"],
            ["text", "Только текст"],
          ]}
          onChange={(keywordStyle) =>
            onUpdate({
              keywordStyle: keywordStyle as WidgetSettings["keywordStyle"],
            })
          }
        />
        <NumberProperty
          label="Толщина полос"
          value={widget.barHeight}
          min={2}
          max={20}
          onChange={(barHeight) => onUpdate({ barHeight })}
        />
        <NumberProperty
          label="Между вариантами"
          value={widget.gap}
          min={4}
          max={40}
          onChange={(gap) => onUpdate({ gap })}
        />
      </>
    ),
    colors: (
      <>
        <FormSelect
          disabled={false}
          label="Поверхность"
          value={widget.surface}
          options={[
            ["solid", "Сплошной фон"],
            ["accent", "Тонированный"],
            ["minimal", "Прозрачный"],
          ]}
          onChange={(surface) =>
            onUpdate({ surface: surface as WidgetSettings["surface"] })
          }
        />
        <NumberProperty
          label="Непрозрачность фона"
          unit="%"
          value={widget.opacity}
          min={0}
          max={100}
          onChange={(opacity) => onUpdate({ opacity })}
        />
        {colorFields.map(([key, label]) => (
          <ColorProperty
            key={key}
            label={label}
            value={widget[key]}
            onChange={(value) => onUpdate({ [key]: value })}
          />
        ))}
      </>
    ),
    content: (
      <>
        {contentFields.map(([key, label]) => (
          <FormSwitch
            key={key}
            label={label}
            checked={widget[key]}
            onCheckedChange={(checked) => onUpdate({ [key]: checked })}
          />
        ))}
      </>
    ),
  }

  return (
    <section className="widget-studio" aria-label="Редактор виджета опроса">
      <WidgetStudioToolbar
        kind="polls"
        enabled={visible}
        disabled={busy}
        url={overlayUrl}
        dimensions={`${sourceWidth} × ${sourceHeight} px`}
        scene={background}
        onSceneChange={setBackground}
        onToggleOutput={() => onSetOutput(!visible)}
        onSelectKind={onSelectKind}
        templateAction={templateAction}
        previewControls={
          <div
            className="studio-toolbar-modes"
            role="group"
            aria-label="Источник опроса на холсте"
          >
            <button
              type="button"
              aria-pressed={synthetic}
              onClick={() => {
                if (!synthetic) setPreviewMode("results")
              }}
            >
              Демо
            </button>
            <button
              type="button"
              aria-pressed={!synthetic}
              onClick={() => setPreviewMode("live")}
            >
              {poll ? "Текущий опрос" : "Черновик"}
            </button>
          </div>
        }
        testControls={
          <>
            {(
              [
                ["results", "С голосами"],
                ["empty", "Без голосов"],
                ["ended", "Финал"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={previewMode === value}
                onClick={() => setPreviewMode(value)}
              >
                {label}
              </button>
            ))}
            <div
              className="studio-toolbar-samples"
              role="group"
              aria-label="Масштаб холста"
            >
              {[
                ["fit", "Авто"],
                ["0.5", "50%"],
                ["0.75", "75%"],
                ["1", "100%"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={zoom === value}
                  onClick={() => setZoom(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                onUpdate({ ...widgetDefaults })
                setPanel(null)
              }}
            >
              <RotateCcw aria-hidden="true" />
              Сбросить оформление
            </button>
          </>
        }
      />
      <div className="widget-canvas-workspace">
        <div
          className="widget-canvas"
          ref={stageRef}
          data-background={background}
        >
          <div
            className="widget-artboard-wrap"
            style={{ width: sourceWidth * scale, height: sourceHeight * scale }}
          >
            <div
              className="widget-artboard"
              style={{ width: sourceWidth, transform: "scale(" + scale + ")" }}
            >
              <div ref={objectRef}>
                <PollOverlay
                  poll={preview}
                  widget={widget}
                  endedPreview={previewMode === "ended"}
                  selectedPart={
                    panel === "text"
                      ? "question"
                      : panel === "options"
                        ? "options"
                        : panel === "colors"
                          ? "background"
                          : undefined
                  }
                  onSelectPart={(part) =>
                    setPanel(
                      part === "question"
                        ? "text"
                        : part === "options"
                          ? "options"
                          : "colors"
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="widget-edit-dock">
        <div
          className="widget-edit-navigation"
          role="group"
          aria-label="Настроить виджет"
        >
          {sections.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={panel === id}
              aria-expanded={panel === id}
              aria-controls={controlId + "-properties"}
              data-active={panel === id || undefined}
              onClick={() =>
                setPanel((current) => (current === id ? null : id))
              }
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
          {panel && (
            <button
              className="widget-close-properties"
              type="button"
              aria-label="Закрыть настройки"
              onClick={() => setPanel(null)}
            >
              <X aria-hidden="true" />
            </button>
          )}
        </div>
        <AnimatedSettings active={panel}>
          {(shown) => (
            <div
              className="widget-property-tray"
              id={controlId + "-properties"}
              role="region"
              aria-label={
                "Настройки: " + sections.find((item) => item[0] === shown)![1]
              }
            >
              <div className="widget-property-grid">{properties[shown]}</div>
            </div>
          )}
        </AnimatedSettings>
      </div>
    </section>
  )
}
