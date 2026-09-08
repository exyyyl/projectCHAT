import { useState } from "react"
import { Check, Copy, ExternalLink, RotateCcw } from "lucide-react"

import { PollResults } from "@/components/poll-results"
import { Button } from "@/components/ui/button"
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
]

const defaults: WidgetSettings = {
  accent: "#d3fb75",
  surface: "solid",
  density: "comfortable",
  showTimer: true,
  showKeywords: true,
}

export function WidgetPage({
  poll,
  draft,
  widget,
  busy,
  onUpdate,
  onSetOutput,
}: WidgetPageProps) {
  const [copied, setCopied] = useState(false)
  const showToast = useToast()
  const current = poll || draft
  const visible = poll ? poll.visible : draft.showOverlay
  const overlayUrl = `${location.origin}/overlay`
  const update = (patch: Partial<WidgetSettings>) =>
    onUpdate({ ...widget, ...patch })

  return (
    <section className="p-6 lg:p-8" aria-label="Виджет">
      <div className="grid gap-4 xl:grid-cols-[minmax(420px,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-medium">Предпросмотр</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {poll
                    ? visible
                      ? "Сейчас виден на стриме"
                      : "Сейчас скрыт на стриме"
                    : visible
                      ? "Появится после запуска опроса"
                      : "Запустится скрытым"}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => onSetOutput(!visible)}
              >
                {visible ? "Скрыть" : "Показать"}
              </Button>
            </div>
            <div className="preview-stage flex min-h-105 items-start justify-center rounded-xl p-6 pt-10">
              <div className="w-full max-w-96">
                <PollResults poll={current} compact widget={widget} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-medium">Подключение к OBS</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browser Source · 480 × 640
                </p>
              </div>
              <Button asChild variant="ghost" size="icon-sm">
                <a href="/overlay" target="_blank" rel="noreferrer">
                  <ExternalLink />
                  <span className="sr-only">Открыть виджет</span>
                </a>
              </Button>
            </div>
            <button
              className="mt-4 flex w-full items-center justify-between gap-3 rounded-lg border border-border-subtle bg-panel px-3 py-2.5 text-left"
              onClick={async () => {
                await navigator.clipboard.writeText(overlayUrl)
                setCopied(true)
                showToast({
                  message: "Ссылка на виджет скопирована",
                  tone: "success",
                })
                setTimeout(() => setCopied(false), 1800)
              }}
            >
              <span className="truncate font-mono text-xs text-muted-foreground">
                {overlayUrl}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs">
                {copied ? (
                  <Check className="size-3.5 text-brand" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied ? "Скопировано" : "Копировать"}
              </span>
            </button>
          </div>
        </div>

        <div className="h-fit rounded-xl border border-border-subtle bg-surface-subtle p-5 xl:sticky xl:top-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium">Внешний вид</h2>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onUpdate(defaults)}
            >
              <RotateCcw />
              Сбросить
            </Button>
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <div className="mb-3 text-xs text-muted-foreground">Акцент</div>
              <div className="flex gap-2">
                {colors.map((color) => (
                  <button
                    key={color.value}
                    className={`flex size-8 items-center justify-center rounded-full border transition-transform hover:scale-105 ${
                      widget.accent === color.value
                        ? "border-white/70"
                        : "border-transparent"
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
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs text-muted-foreground">Фон</div>
              <ToggleGroup
                type="single"
                value={widget.surface}
                disabled={busy}
                onValueChange={(value) =>
                  value &&
                  update({ surface: value as WidgetSettings["surface"] })
                }
                className="grid grid-cols-2"
              >
                <ToggleGroupItem value="solid">Обычный</ToggleGroupItem>
                <ToggleGroupItem value="glass">Стекло</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div>
              <div className="mb-2 text-xs text-muted-foreground">
                Плотность
              </div>
              <ToggleGroup
                type="single"
                value={widget.density}
                disabled={busy}
                onValueChange={(value) =>
                  value &&
                  update({ density: value as WidgetSettings["density"] })
                }
                className="grid grid-cols-2"
              >
                <ToggleGroupItem value="comfortable">Обычная</ToggleGroupItem>
                <ToggleGroupItem value="compact">Компактная</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-3 border-t border-border-subtle pt-5 text-sm">
              <label className="flex items-center justify-between gap-4">
                <span>Таймер</span>
                <input
                  type="checkbox"
                  checked={widget.showTimer}
                  disabled={busy}
                  onChange={(event) =>
                    update({ showTimer: event.target.checked })
                  }
                  className="size-4 accent-brand"
                />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span>Ключевые слова</span>
                <input
                  type="checkbox"
                  checked={widget.showKeywords}
                  disabled={busy}
                  onChange={(event) =>
                    update({ showKeywords: event.target.checked })
                  }
                  className="size-4 accent-brand"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
