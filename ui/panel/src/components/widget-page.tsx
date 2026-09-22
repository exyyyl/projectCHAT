import { useState } from "react"
import { Gift, ListChecks, MousePointer2 } from "lucide-react"

import {
  FormColor,
  FormSelect,
  FormSwitch,
  VisibilityButton,
} from "@/components/form-controls"
import type { Contest } from "@/domain/contest"

import { PollResults } from "@/components/poll-results"
import { InputOverlayPage } from "@/components/input-overlay-page"
import {
  StudioRail,
  StudioStage,
  StudioWorkspace,
} from "@/components/page-layout"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/toast"
import type { Draft, Poll, WidgetSettings } from "@/domain/polls"
import {
  SHOW_CONTEST_WIDGET,
  SHOW_INPUT_OVERLAY,
} from "@/domain/release-features"

type WidgetPageProps = {
  contest?: Contest | null
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

const widgetKinds = [
  { id: "polls", label: "Опросы", icon: ListChecks },
  ...(SHOW_CONTEST_WIDGET
    ? [{ id: "contests" as const, label: "Конкурсы", icon: Gift }]
    : []),
  ...(SHOW_INPUT_OVERLAY
    ? [
        {
          id: "input-overlay" as const,
          label: "Клавиши и мышь",
          icon: MousePointer2,
        },
      ]
    : []),
] as const

export function WidgetPage(props: WidgetPageProps) {
  const [selected, setSelected] =
    useState<(typeof widgetKinds)[number]["id"]>("polls")
  const visible = props.poll ? props.poll.visible : props.draft.showOverlay
  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden"
      aria-label="Виджеты"
    >
      <div
        className="flex min-h-14 shrink-0 flex-wrap items-center gap-1 px-5 py-2"
        role="group"
        aria-label="Выбор виджета"
      >
        {widgetKinds.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={selected === id ? "secondary" : "ghost"}
            className="h-8 gap-2 rounded-md px-2.5 text-xs"
            aria-pressed={selected === id}
            onClick={() => setSelected(id)}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
        {selected === "polls" && (
          <div className="ml-auto">
            <VisibilityButton
              visible={visible}
              disabled={props.busy}
              onChange={props.onSetOutput}
            />
          </div>
        )}
      </div>
      <div className={selected === "polls" ? "min-h-0 flex-1" : "hidden"}>
        <PollWidgetEditor {...props} />
      </div>
      {SHOW_CONTEST_WIDGET && selected === "contests" && (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
          <div className="max-w-sm text-center">
            <Gift className="mx-auto mb-4 size-7 text-muted-foreground" />
            <h2 className="text-lg font-medium">
              Виджет конкурса ещё в разработке
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Рулетка и победитель доступны в разделе «Конкурсы». Отдельного
              источника для OBS пока нет.
            </p>
            {props.contest && (
              <div className="mt-5 rounded-xl bg-surface-subtle px-4 py-3 text-sm">
                {props.contest.participants.length} участников
              </div>
            )}
          </div>
        </div>
      )}
      {SHOW_INPUT_OVERLAY && selected === "input-overlay" && (
        <div className="min-h-0 flex-1">
          <InputOverlayPage />
        </div>
      )}
    </section>
  )
}

function PollWidgetEditor({
  poll,
  draft,
  widget: savedWidget,
  busy,
  onUpdate,
}: WidgetPageProps) {
  const showToast = useToast()
  const widget = { ...defaults, ...savedWidget }
  const overlayOrigin = import.meta.env.DEV
    ? "http://127.0.0.1:4317"
    : location.origin
  const overlayUrl = `${overlayOrigin}/overlay`
  const overlaySize = widget.width === "wide" ? "640 × 640" : "480 × 640"
  const update = (patch: Partial<WidgetSettings>) =>
    onUpdate({ ...widget, ...patch })
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(overlayUrl)
      showToast({ message: "Ссылка скопирована", tone: "success" })
    } catch {
      showToast({ message: "Не удалось скопировать ссылку", tone: "error" })
    }
  }
  return (
    <StudioWorkspace
      aria-label="Виджет опроса"
      className="xl:grid-cols-[minmax(0,1fr)_21rem]"
    >
      <StudioStage className="preview-stage bg-panel-muted px-6 py-5 lg:px-6 xl:overflow-y-auto">
        <div className="mb-6 flex justify-end text-xs text-muted-foreground">
          <span>{overlaySize} px</span>
        </div>
        <div className="flex min-h-96 flex-1 items-center justify-center py-6">
          <div
            className={`w-full ${widget.width === "wide" ? "max-w-xl" : widget.width === "narrow" ? "max-w-sm" : "max-w-md"}`}
          >
            <PollResults poll={poll || draft} compact widget={widget} />
          </div>
        </div>
      </StudioStage>
      <StudioRail className="flex flex-col bg-panel px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Оформление</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            disabled={busy}
            onClick={() => onUpdate(defaults)}
          >
            Сбросить
          </Button>
        </div>
        <Tabs defaultValue="style" className="mt-4">
          <TabsList className="widget-editor-tabs grid h-9 grid-cols-3 border-0 bg-surface-subtle p-1">
            <TabsTrigger value="style" className="rounded-md px-1">
              Стиль
            </TabsTrigger>
            <TabsTrigger value="options" className="rounded-md px-1">
              Варианты
            </TabsTrigger>
            <TabsTrigger value="content" className="rounded-md px-1">
              Состав
            </TabsTrigger>
          </TabsList>
          <TabsContent value="style" className="mt-5">
            <div className="mb-5">
              <FormColor
                value={widget.accent}
                colors={colors}
                disabled={busy}
                onChange={(accent) => update({ accent })}
              />
            </div>
            {styleChoices.map((field) => (
              <FormSelect
                key={field.key}
                label={field.label}
                value={String(widget[field.key])}
                options={field.options.map(([value, label]) => [
                  String(value),
                  label,
                ])}
                disabled={
                  busy ||
                  (field.key === "opacity" && widget.surface === "minimal")
                }
                onChange={(value) => {
                  const option = field.options.find(
                    (option) => String(option[0]) === value
                  )
                  if (option) update({ [field.key]: option[0] })
                }}
              />
            ))}
          </TabsContent>
          <TabsContent value="options" className="mt-5">
            {optionChoices.map((field) => (
              <FormSelect
                key={field.key}
                label={field.label}
                value={String(widget[field.key])}
                options={field.options.map(([value, label]) => [value, label])}
                disabled={busy}
                onChange={(value) => {
                  const option = field.options.find(
                    (option) => option[0] === value
                  )
                  if (option) update({ [field.key]: option[0] })
                }}
              />
            ))}
          </TabsContent>
          <TabsContent value="content" className="mt-5">
            {contentFields.map(([key, label]) => (
              <FormSwitch
                key={key}
                label={label}
                checked={widget[key]}
                disabled={busy}
                onCheckedChange={(checked) => update({ [key]: checked })}
              />
            ))}
          </TabsContent>
        </Tabs>
        <div className="mt-auto pt-8">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Источник OBS</span>
            <span className="text-muted-foreground">{overlaySize} px</span>
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
            <Button variant="secondary" size="sm" onClick={() => void copy()}>
              Копировать ссылку
            </Button>
          </div>
        </div>
      </StudioRail>
    </StudioWorkspace>
  )
}

const styleChoices = [
  {
    key: "surface",
    label: "Фон",
    options: [
      ["solid", "Обычный"],
      ["accent", "Акцентный"],
      ["minimal", "Без фона"],
    ],
  },
  {
    key: "width",
    label: "Ширина",
    options: [
      ["narrow", "Узкая"],
      ["medium", "Средняя"],
      ["wide", "Широкая"],
    ],
  },
  {
    key: "font",
    label: "Шрифт",
    options: [
      ["geist", "Geist"],
      ["system", "Системный"],
      ["mono", "Моно"],
    ],
  },
  {
    key: "opacity",
    label: "Прозрачность",
    options: [
      [70, "70%"],
      [85, "85%"],
      [100, "100%"],
    ],
  },
  {
    key: "density",
    label: "Плотность",
    options: [
      ["comfortable", "Обычная"],
      ["compact", "Компактная"],
    ],
  },
  {
    key: "radius",
    label: "Скругление",
    options: [
      ["small", "Малое"],
      ["medium", "Среднее"],
      ["large", "Большое"],
    ],
  },
  {
    key: "titleSize",
    label: "Заголовок",
    options: [
      ["small", "Меньше"],
      ["medium", "Обычно"],
      ["large", "Крупнее"],
    ],
  },
] as const
const optionChoices = [
  {
    key: "optionStyle",
    label: "Форма",
    options: [
      ["rows", "Строки"],
      ["cards", "Карточки"],
      ["outline", "Контур"],
    ],
  },
  {
    key: "optionSize",
    label: "Размер текста",
    options: [
      ["small", "Меньше"],
      ["medium", "Обычно"],
      ["large", "Крупнее"],
    ],
  },
  {
    key: "keywordStyle",
    label: "Ключевые слова",
    options: [
      ["outline", "Контур"],
      ["filled", "Заливка"],
      ["text", "Текст"],
    ],
  },
  {
    key: "barSize",
    label: "Полосы",
    options: [
      ["thin", "Тонкие"],
      ["medium", "Средние"],
      ["thick", "Толстые"],
    ],
  },
] as const
const contentFields = [
  ["showTimer", "Таймер"],
  ["showKeywords", "Ключевые слова"],
  ["showVotes", "Количество голосов"],
  ["showPercentages", "Проценты"],
  ["showBars", "Полосы результатов"],
] as const
