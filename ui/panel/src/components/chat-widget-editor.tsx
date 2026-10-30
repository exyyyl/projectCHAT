import { AnimatedSettings } from "@/components/animated-settings"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import {
  Check,
  Palette,
  Type,
  MessageSquare,
  Sparkles,
  LayoutTemplate,
  X,
} from "lucide-react"
import {
  chatOverlayDefaults,
  chatOverlayPresets,
  chatOverlayStyle,
  matchingChatOverlayPreset,
} from "../../../../public/chat-overlay-model.js"
import type {
  ChatOverlayPreset,
  ChatOverlaySettings,
} from "../../../../public/chat-overlay-model.js"
import { Input } from "@/components/ui/input"
import { FormSelect, FormSwitch } from "@/components/form-controls"
import { ChatOverlayView } from "./chat-overlay-view"
import { ChatOverlayLive } from "./chat-overlay-live"
import { ChatWidgetToolbar } from "./chat-widget-toolbar"
import type { WidgetKind } from "./widget-kind-tabs"
import "./chat-widget-editor.css"

import { createChatPreviewMessage } from "@/domain/chat-preview"
import type { ChatPreviewKind } from "@/domain/chat-preview"
function NumberProperty({
  label,
  value,
  min,
  max,
  unit = "px",
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  onChange: (value: number) => void
}) {
  const commit = (element: HTMLInputElement) => {
    const parsed = Number(element.value)
    const next =
      element.value.trim() && Number.isFinite(parsed)
        ? Math.max(min, Math.min(max, Math.round(parsed)))
        : value
    element.value = String(next)
    if (next !== value) onChange(next)
  }
  return (
    <label className="chat-adjust-number">
      <span>{label}</span>
      <span>
        <Input
          key={value}
          type="number"
          defaultValue={value}
          min={min}
          max={max}
          aria-label={label}
          onBlur={(event) => commit(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
        />
        <small>{unit}</small>
      </span>
    </label>
  )
}
function ColorProperty({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="chat-adjust-color">
      <span>{label}</span>
      <span>
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          key={value}
          defaultValue={value.toUpperCase()}
          maxLength={7}
          aria-label={`${label}, HEX`}
          onBlur={(event) => {
            const next = event.currentTarget.value
            if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase())
            else event.currentTarget.value = value.toUpperCase()
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
        />
      </span>
    </label>
  )
}
function StylePreview({ preset }: { preset: ChatOverlayPreset }) {
  const settings = { ...chatOverlayDefaults, ...preset.settings }
  return (
    <span className="chat-look-art" aria-hidden="true">
      <span
        className="cue-chat-overlay"
        data-style={settings.style}
        data-align="left"
        style={chatOverlayStyle(settings) as CSSProperties}
      >
        {[0, 1].map((index) => (
          <span className="cue-chat-slot" key={index}>
            <span className="cue-chat-message">
              <span
                className="cue-chat-author"
                style={{
                  color: settings.useTwitchColors
                    ? ["#d9a7ff", "#78d5c8"][index]
                    : settings.nameColor,
                }}
              >
                <strong>{["peachysoul", "MoonByte"][index]}</strong>
              </span>
              <span className="cue-chat-body">
                {index ? "Вот это момент" : "Всем привет!"}
              </span>
            </span>
          </span>
        ))}
      </span>
    </span>
  )
}
export function ChatWidgetEditor({
  settings,
  onUpdate,
  onSelectKind,
}: {
  settings: ChatOverlaySettings
  onUpdate: (patch: Partial<ChatOverlaySettings>) => void
  onSelectKind: (kind: WidgetKind) => void
}) {
  const id = useId()
  const [panel, setPanel] = useState<
    "look" | "text" | "colors" | "messages" | "motion" | null
  >(null)
  const [source, setSource] = useState<ChatPreviewKind | "live">("regular")
  const [playing, setPlaying] = useState(true)
  const [scene, setScene] = useState("dark")
  const [size, setSize] = useState({ width: 480, height: 600 })
  const [messages, setMessages] = useState(() =>
    [1, 2, 3].map((id) => createChatPreviewMessage(id))
  )
  const nextId = useRef(4)
  const stage = useRef<HTMLDivElement>(null)
  const panelTrigger = useRef<HTMLButtonElement>(null)
  const preset = matchingChatOverlayPreset(settings)
  const scale = Math.min(1, Math.max(0.2, (size.width - 32) / 480))
  const previewHeight = Math.max(80, size.height - 32)
  const sections = [
    ["look", "Оформление", LayoutTemplate],
    ["text", "Текст", Type],
    ["colors", "Цвета", Palette],
    ["messages", "Сообщения", MessageSquare],
    ["motion", "Анимация", Sparkles],
  ] as const
  const selectSource = (value: string) => {
    const next = value as ChatPreviewKind | "live"
    setSource(next)
    if (next !== "live") {
      setMessages([createChatPreviewMessage(nextId.current++, next)])
      setPlaying(next === "regular")
    }
  }
  const closePanel = () => {
    setPanel(null)
    panelTrigger.current?.focus()
  }
  useLayoutEffect(() => {
    const node = stage.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!playing || source === "live") return
    const timer = setInterval(() => {
      const message = createChatPreviewMessage(nextId.current++, source)
      setMessages((current) => [...current, message].slice(-40))
    }, 3500)
    return () => clearInterval(timer)
  }, [playing, source])
  const properties = {
    look: (
      <>
        <div
          className="chat-looks-list"
          role="group"
          aria-label="Готовые оформления чата"
        >
          {chatOverlayPresets.map((look) => (
            <button
              type="button"
              className="chat-look"
              key={look.id}
              aria-pressed={preset?.id === look.id}
              onClick={() => onUpdate(look.settings)}
            >
              <StylePreview preset={look} />
              <span className="chat-look-name">
                {look.name}
                {preset?.id === look.id && <Check aria-hidden="true" />}
              </span>
            </button>
          ))}
        </div>
        <FormSelect
          disabled={false}
          label="Вид сообщений"
          value={settings.style}
          options={[
            ["cards", "Карточки"],
            ["minimal", "Строки"],
            ["bubble", "Пузыри"],
          ]}
          onChange={(style) =>
            onUpdate({ style: style as ChatOverlaySettings["style"] })
          }
        />
      </>
    ),
    text: (
      <>
        <FormSelect
          disabled={false}
          label="Шрифт"
          value={settings.font}
          options={[
            ["geist", "Geist"],
            ["system", "Системный"],
            ["mono", "Моно"],
          ]}
          onChange={(font) =>
            onUpdate({ font: font as ChatOverlaySettings["font"] })
          }
        />
        <NumberProperty
          label="Размер текста"
          value={settings.fontSize}
          min={14}
          max={48}
          onChange={(fontSize) => onUpdate({ fontSize })}
        />
        <NumberProperty
          label="Размер смайликов"
          value={settings.emoteSize}
          min={20}
          max={72}
          onChange={(emoteSize) => onUpdate({ emoteSize })}
        />
      </>
    ),
    colors: (
      <>
        <ColorProperty
          label="Текст"
          value={settings.textColor}
          onChange={(textColor) => onUpdate({ textColor })}
        />
        {settings.style !== "minimal" && (
          <>
            <ColorProperty
              label="Фон"
              value={settings.backgroundColor}
              onChange={(backgroundColor) => onUpdate({ backgroundColor })}
            />
            <NumberProperty
              label="Непрозрачность фона"
              value={settings.opacity}
              min={0}
              max={100}
              unit="%"
              onChange={(opacity) => onUpdate({ opacity })}
            />
            <NumberProperty
              label="Скругление"
              value={settings.radius}
              min={0}
              max={32}
              onChange={(radius) => onUpdate({ radius })}
            />
          </>
        )}
        <FormSwitch
          label="Цвета ников Twitch"
          checked={settings.useTwitchColors}
          onCheckedChange={(useTwitchColors) => onUpdate({ useTwitchColors })}
        />
        {!settings.useTwitchColors && (
          <ColorProperty
            label="Ник"
            value={settings.nameColor}
            onChange={(nameColor) => onUpdate({ nameColor })}
          />
        )}
      </>
    ),
    messages: (
      <>
        <NumberProperty
          label="Сообщений на экране"
          value={settings.maxMessages}
          min={1}
          max={30}
          unit=""
          onChange={(maxMessages) => onUpdate({ maxMessages })}
        />
        <FormSwitch
          label="Скрывать по таймеру"
          checked={settings.hideAfter > 0}
          onCheckedChange={(hide) => onUpdate({ hideAfter: hide ? 20 : 0 })}
        />
        {settings.hideAfter > 0 && (
          <NumberProperty
            label="Время показа"
            value={settings.hideAfter}
            min={1}
            max={300}
            unit="сек"
            onChange={(hideAfter) => onUpdate({ hideAfter })}
          />
        )}
        <NumberProperty
          label="Между сообщениями"
          value={settings.gap}
          min={0}
          max={32}
          onChange={(gap) => onUpdate({ gap })}
        />
        <FormSelect
          disabled={false}
          label="Выравнивание"
          value={settings.alignment}
          options={[
            ["left", "Слева"],
            ["right", "Справа"],
          ]}
          onChange={(alignment) =>
            onUpdate({
              alignment: alignment as ChatOverlaySettings["alignment"],
            })
          }
        />
        <FormSwitch
          label="Значки Twitch"
          checked={settings.showBadges}
          onCheckedChange={(showBadges) => onUpdate({ showBadges })}
        />
        <FormSwitch
          label="Время сообщений"
          checked={settings.showTime}
          onCheckedChange={(showTime) => onUpdate({ showTime })}
        />
        <FormSelect
          disabled={false}
          label="Приоритет смайликов"
          value={settings.emoteProvider}
          options={[
            ["ffz", "FrankerFaceZ"],
            ["7tv", "7TV"],
            ["bttv", "BetterTTV"],
          ]}
          onChange={(emoteProvider) =>
            onUpdate({
              emoteProvider:
                emoteProvider as ChatOverlaySettings["emoteProvider"],
            })
          }
        />
      </>
    ),
    motion: (
      <>
        <FormSelect
          disabled={false}
          label="Появление"
          value={settings.animation}
          options={[
            ["slide", "Плавный подъём"],
            ["fade", "Растворение"],
            ["none", "Без анимации"],
          ]}
          onChange={(animation) =>
            onUpdate({
              animation: animation as ChatOverlaySettings["animation"],
            })
          }
        />
        {settings.animation !== "none" && (
          <NumberProperty
            label="Длительность"
            value={settings.animationDuration}
            min={150}
            max={1200}
            unit="мс"
            onChange={(animationDuration) => onUpdate({ animationDuration })}
          />
        )}
      </>
    ),
  }
  return (
    <section
      className="widget-studio chat-studio"
      aria-label="Редактор виджета чата"
    >
      <ChatWidgetToolbar
        enabled={settings.enabled}
        source={source}
        playing={playing}
        scene={scene}
        onToggleOutput={() => onUpdate({ enabled: !settings.enabled })}
        onSourceChange={selectSource}
        onTogglePlayback={() => setPlaying((value) => !value)}
        onSceneChange={setScene}
        onSelectKind={onSelectKind}
      />
      <div className="widget-canvas-workspace">
        <div className="chat-studio-canvas" data-scene={scene} ref={stage}>
          <div
            className="chat-canvas-preview"
            style={{ width: 480 * scale, height: previewHeight }}
          >
            <div
              style={{
                width: 480,
                height: previewHeight / scale,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              {source === "live" ? (
                <ChatOverlayLive preview />
              ) : (
                <ChatOverlayView
                  messages={messages}
                  settings={
                    source === "regular" && playing
                      ? settings
                      : { ...settings, hideAfter: 0 }
                  }
                  preview
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <div
        className="widget-edit-dock"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation()
            closePanel()
          }
        }}
      >
        <div
          className="widget-edit-navigation"
          role="group"
          aria-label="Настроить виджет чата"
        >
          {sections.map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              ref={panel === key ? panelTrigger : undefined}
              aria-pressed={panel === key}
              aria-expanded={panel === key}
              aria-controls={id + "-properties"}
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
              className="widget-close-properties"
              type="button"
              aria-label="Закрыть настройки"
              onClick={closePanel}
            >
              <X aria-hidden="true" />
            </button>
          )}
        </div>
        <AnimatedSettings active={panel}>
          {(shown) => (
            <div
              className="widget-property-tray"
              id={id + "-properties"}
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
