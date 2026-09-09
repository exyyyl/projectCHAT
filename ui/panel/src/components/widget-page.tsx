import { useState } from "react"

import { PollResults } from "@/components/poll-results"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useToast } from "@/components/ui/toast"
import type { Draft, Poll, WidgetSettings } from "@/domain/polls"

type WidgetPageProps = {
  poll: Poll | null
  draft: Draft
  widget: WidgetSettings
  busy: boolean
  onUpdate: (widget: WidgetSettings) => void
  onSetOutput: (visible: boolean) => void
}

const colors = [
  { value: "#d3fb75", label: "Лайм" },
  { value: "#a970ff", label: "Фиолетовый" },
  { value: "#6ee7f2", label: "Голубой" },
  { value: "#ff8fab", label: "Розовый" },
  { value: "#f8c86b", label: "Янтарный" },
  { value: "#f5f5f5", label: "Белый" },
]

const defaults: WidgetSettings = {
  accent: "#d3fb75",
  surface: "solid",
  density: "comfortable",
  radius: "medium",
  titleSize: "medium",
  width: "medium",
  opacity: 100,
  font: "geist",
  optionStyle: "rows",
  optionSize: "medium",
  keywordStyle: "outline",
  barSize: "medium",
  showTimer: true,
  showKeywords: true,
  showBars: true,
  showVotes: true,
  showPercentages: true,
}

export function WidgetPage({
  poll,
  draft,
  widget: savedWidget,
  busy,
  onUpdate,
  onSetOutput,
}: WidgetPageProps) {
  const [copied, setCopied] = useState(false)
  const showToast = useToast()
  const widget = { ...defaults, ...savedWidget }
  const current = poll || draft
  const visible = poll ? poll.visible : draft.showOverlay
  const overlayUrl = `${location.origin}/overlay`
  const overlaySize = widget.width === "wide" ? "640 × 640" : "480 × 640"
  const previewWidth = {
    narrow: "max-w-sm",
    medium: "max-w-md",
    wide: "max-w-xl",
  }[widget.width]
  const update = (patch: Partial<WidgetSettings>) =>
    onUpdate({ ...widget, ...patch })

  const copyOverlayUrl = async () => {
    await navigator.clipboard.writeText(overlayUrl)
    setCopied(true)
    showToast({ message: "Ссылка на виджет скопирована", tone: "success" })
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <section
      className="grid min-h-full xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_21.5rem]"
      aria-label="Виджет"
    >
      <div className="flex min-w-0 flex-col p-5 lg:p-6 xl:min-h-0">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`size-2 rounded-full ${visible ? "bg-brand" : "bg-muted-foreground/35"}`}
            />
            {poll
              ? visible
                ? "Виджет в OBS"
                : "Виджет скрыт"
              : visible
                ? "Покажется с опросом"
                : "Запустится скрытым"}
          </div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onSetOutput(!visible)}
          >
            {visible ? "Скрыть со стрима" : "Показать на стриме"}
          </Button>
        </div>

        <div className="preview-stage flex min-h-96 flex-1 items-start justify-center overflow-hidden rounded-2xl p-8 pt-12 lg:p-12 lg:pt-16">
          <div className={`w-full ${previewWidth}`}>
            <PollResults poll={current} compact widget={widget} />
          </div>
        </div>

        <div className="mt-3 flex shrink-0 items-center gap-3 rounded-xl bg-surface-subtle p-2 pl-4">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium">OBS Browser Source</div>
            <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
              <span className="truncate font-mono">{overlayUrl}</span>
              <span className="shrink-0 text-muted-foreground/45">·</span>
              <span className="shrink-0">Размер {overlaySize} px</span>
            </div>
          </div>
          <Button variant="ghost" asChild>
            <a href="/overlay" target="_blank" rel="noreferrer">
              Открыть
            </a>
          </Button>
          <Button variant="secondary" onClick={() => void copyOverlayUrl()}>
            {copied ? "Скопировано" : "Копировать ссылку"}
          </Button>
        </div>
      </div>

      <aside className="bg-[#0e1116] px-5 py-6 xl:min-h-0 xl:overflow-y-auto">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-[-0.02em]">
            Оформление
          </h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onUpdate(defaults)}
          >
            Сбросить
          </Button>
        </div>

        <Tabs defaultValue="style" className="mt-5">
          <TabsList className="grid h-10 grid-cols-3 rounded-xl border-0 bg-white/[0.025] p-1">
            <TabsTrigger
              value="style"
              className="rounded-lg after:hidden data-[state=active]:bg-white/[0.055]"
            >
              Стиль
            </TabsTrigger>
            <TabsTrigger
              value="options"
              className="rounded-lg after:hidden data-[state=active]:bg-white/[0.055]"
            >
              Варианты
            </TabsTrigger>
            <TabsTrigger
              value="content"
              className="rounded-lg after:hidden data-[state=active]:bg-white/[0.055]"
            >
              Видимость
            </TabsTrigger>
          </TabsList>

          <TabsContent value="style" className="mt-6 space-y-7">
            <ControlGroup label="Акцент">
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <button
                    key={color.value}
                    className={`flex size-8 items-center justify-center rounded-lg transition-[background,transform] hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none ${
                      widget.accent === color.value
                        ? "bg-white/10"
                        : "bg-transparent"
                    }`}
                    aria-label={color.label}
                    aria-pressed={widget.accent === color.value}
                    disabled={busy}
                    onClick={() => update({ accent: color.value })}
                  >
                    <span
                      className="size-5 rounded-full"
                      style={{ backgroundColor: color.value }}
                    />
                  </button>
                ))}
                <label
                  className="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-white/[0.045] focus-within:ring-2 focus-within:ring-ring/50"
                  title="Свой цвет"
                >
                  <span
                    className="flex size-5 items-center justify-center rounded-full"
                    style={{
                      background:
                        "conic-gradient(#ff6b8a, #f8c86b, #d3fb75, #6ee7f2, #a970ff, #ff6b8a)",
                    }}
                  >
                    <span className="size-2 rounded-full bg-[#171a1f]" />
                  </span>
                  <input
                    type="color"
                    value={widget.accent}
                    disabled={busy}
                    aria-label="Свой цвет акцента"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(event) => update({ accent: event.target.value })}
                  />
                </label>
              </div>
            </ControlGroup>

            <ControlGroup label="Фон">
              <Segmented
                value={widget.surface}
                disabled={busy}
                columns={3}
                options={[
                  ["solid", "Обычный"],
                  ["glass", "Стекло"],
                  ["minimal", "Без фона"],
                ]}
                onChange={(value) =>
                  update({ surface: value as WidgetSettings["surface"] })
                }
              />
            </ControlGroup>

            <ControlGroup label="Ширина">
              <Segmented
                value={widget.width}
                disabled={busy}
                columns={3}
                options={[
                  ["narrow", "Узкая"],
                  ["medium", "Средняя"],
                  ["wide", "Широкая"],
                ]}
                onChange={(value) =>
                  update({ width: value as WidgetSettings["width"] })
                }
              />
            </ControlGroup>

            <ControlGroup label="Шрифт">
              <Segmented
                value={widget.font}
                disabled={busy}
                columns={3}
                options={[
                  ["geist", "Geist"],
                  ["system", "Системный"],
                  ["mono", "Моно"],
                ]}
                onChange={(value) =>
                  update({ font: value as WidgetSettings["font"] })
                }
              />
            </ControlGroup>

            <ControlGroup label="Прозрачность">
              <Segmented
                value={String(widget.opacity)}
                disabled={busy || widget.surface === "minimal"}
                columns={3}
                options={[
                  ["70", "70%"],
                  ["85", "85%"],
                  ["100", "100%"],
                ]}
                onChange={(value) =>
                  update({
                    opacity: Number(value) as WidgetSettings["opacity"],
                  })
                }
              />
            </ControlGroup>

            <ControlGroup label="Плотность">
              <Segmented
                value={widget.density}
                disabled={busy}
                columns={2}
                options={[
                  ["comfortable", "Обычная"],
                  ["compact", "Компактная"],
                ]}
                onChange={(value) =>
                  update({ density: value as WidgetSettings["density"] })
                }
              />
            </ControlGroup>

            <ControlGroup label="Скругление">
              <Segmented
                value={widget.radius}
                disabled={busy}
                columns={3}
                options={[
                  ["small", "Малое"],
                  ["medium", "Среднее"],
                  ["large", "Большое"],
                ]}
                onChange={(value) =>
                  update({ radius: value as WidgetSettings["radius"] })
                }
              />
            </ControlGroup>

            <ControlGroup label="Заголовок">
              <Segmented
                value={widget.titleSize}
                disabled={busy}
                columns={3}
                options={[
                  ["small", "Меньше"],
                  ["medium", "Обычно"],
                  ["large", "Крупнее"],
                ]}
                onChange={(value) =>
                  update({ titleSize: value as WidgetSettings["titleSize"] })
                }
              />
            </ControlGroup>
          </TabsContent>

          <TabsContent value="options" className="mt-6 space-y-7">
            <ControlGroup label="Форма">
              <Segmented
                value={widget.optionStyle}
                disabled={busy}
                columns={3}
                options={[
                  ["rows", "Строки"],
                  ["cards", "Карточки"],
                  ["outline", "Контур"],
                ]}
                onChange={(value) =>
                  update({
                    optionStyle: value as WidgetSettings["optionStyle"],
                  })
                }
              />
            </ControlGroup>

            <ControlGroup label="Размер текста">
              <Segmented
                value={widget.optionSize}
                disabled={busy}
                columns={3}
                options={[
                  ["small", "Меньше"],
                  ["medium", "Обычно"],
                  ["large", "Крупнее"],
                ]}
                onChange={(value) =>
                  update({
                    optionSize: value as WidgetSettings["optionSize"],
                  })
                }
              />
            </ControlGroup>

            <ControlGroup label="Ключевые слова">
              <Segmented
                value={widget.keywordStyle}
                disabled={busy}
                columns={3}
                options={[
                  ["outline", "Контур"],
                  ["filled", "Заливка"],
                  ["text", "Текст"],
                ]}
                onChange={(value) =>
                  update({
                    keywordStyle: value as WidgetSettings["keywordStyle"],
                  })
                }
              />
            </ControlGroup>

            <ControlGroup label="Полосы">
              <Segmented
                value={widget.barSize}
                disabled={busy}
                columns={3}
                options={[
                  ["thin", "Тонкие"],
                  ["medium", "Средние"],
                  ["thick", "Толстые"],
                ]}
                onChange={(value) =>
                  update({ barSize: value as WidgetSettings["barSize"] })
                }
              />
            </ControlGroup>
          </TabsContent>

          <TabsContent value="content" className="mt-6">
            <div className="space-y-1 rounded-xl bg-white/[0.025] p-1">
              <ContentSwitch
                label="Таймер"
                checked={widget.showTimer}
                disabled={busy}
                onCheckedChange={(showTimer) => update({ showTimer })}
              />
              <ContentSwitch
                label="Ключевые слова"
                checked={widget.showKeywords}
                disabled={busy}
                onCheckedChange={(showKeywords) => update({ showKeywords })}
              />
              <ContentSwitch
                label="Количество голосов"
                checked={widget.showVotes}
                disabled={busy}
                onCheckedChange={(showVotes) => update({ showVotes })}
              />
              <ContentSwitch
                label="Проценты"
                checked={widget.showPercentages}
                disabled={busy}
                onCheckedChange={(showPercentages) =>
                  update({ showPercentages })
                }
              />
              <ContentSwitch
                label="Полосы результатов"
                checked={widget.showBars}
                disabled={busy}
                onCheckedChange={(showBars) => update({ showBars })}
              />
            </div>
          </TabsContent>
        </Tabs>
      </aside>
    </section>
  )
}

function ControlGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2.5 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  )
}

function Segmented({
  value,
  disabled,
  columns,
  options,
  onChange,
}: {
  value: string
  disabled: boolean
  columns: 2 | 3
  options: Array<readonly [string, string]>
  onChange: (value: string) => void
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      disabled={disabled}
      onValueChange={(next) => next && onChange(next)}
      className={`grid rounded-xl bg-white/[0.025] p-1 ${
        columns === 3 ? "grid-cols-3" : "grid-cols-2"
      }`}
    >
      {options.map(([option, label]) => (
        <ToggleGroupItem key={option} value={option} className="px-2">
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function ContentSwitch({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-10 items-center justify-between gap-4 rounded-lg px-3 py-2 hover:bg-white/[0.025]">
      <span className="text-sm">{label}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onCheckedChange}
      />
    </label>
  )
}
