import type { CSSProperties } from "react"
import { resolveWidget, widgetStyle } from "../../../../public/widget-model.js"
import "../../../../public/widget.css"
import {
  formatTime,
  percentages,
  type Draft,
  type Poll,
  type WidgetSettings,
} from "@/domain/polls"
import { PollTimer } from "@/components/poll-results"

export function PollOverlay({
  poll,
  widget: input,
  endedPreview = false,
  selectedPart,
  onSelectPart,
}: {
  poll: Draft | Poll
  widget: WidgetSettings
  endedPreview?: boolean
  selectedPart?: "question" | "options" | "background"
  onSelectPart?: (part: "question" | "options" | "background") => void
}) {
  const widget = resolveWidget(input)
  const options = poll.options.map((option) => ({
    ...option,
    votes: option.votes || 0,
  }))
  const share = percentages(options)
  const maximum = Math.max(0, ...options.map((option) => option.votes))
  const total = options.reduce((sum, option) => sum + option.votes, 0)
  const ended = endedPreview || ("status" in poll && poll.status === "ended")
  const secret = poll.secret && "status" in poll && !ended
  return (
    <article
      className="cue-poll-widget"
      data-layout={widget.layout}
      data-surface={widget.surface}
      data-option-style={widget.optionStyle}
      data-keyword-style={widget.keywordStyle}
      data-ended={ended}
      data-highlight={widget.highlightWinner}
      data-edit-selected={selectedPart === "background" || undefined}
      onClick={onSelectPart ? () => onSelectPart("background") : undefined}
      style={
        {
          ...widgetStyle(widget),
          "--cue-columns": Math.min(3, options.length),
        } as CSSProperties
      }
    >
      <header
        className="cue-widget-heading"
        role={onSelectPart ? "button" : undefined}
        tabIndex={onSelectPart ? 0 : undefined}
        aria-label={onSelectPart ? "Настроить текст вопроса" : undefined}
        data-editable={Boolean(onSelectPart) || undefined}
        data-edit-selected={selectedPart === "question" || undefined}
        onClick={
          onSelectPart
            ? (event) => {
                event.stopPropagation()
                onSelectPart("question")
              }
            : undefined
        }
        onKeyDown={
          onSelectPart
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  event.stopPropagation()
                  onSelectPart("question")
                }
              }
            : undefined
        }
      >
        <h3>{poll.question.trim() || "Вопрос опроса"}</h3>
        {widget.showTimer && (
          <div className="cue-widget-clock">
            {"status" in poll ? (
              <PollTimer poll={poll} />
            ) : (
              formatTime(poll.duration)
            )}
          </div>
        )}
      </header>
      <div
        className="cue-widget-options"
        role={onSelectPart ? "button" : undefined}
        tabIndex={onSelectPart ? 0 : undefined}
        aria-label={onSelectPart ? "Настроить варианты ответов" : undefined}
        data-editable={Boolean(onSelectPart) || undefined}
        data-edit-selected={selectedPart === "options" || undefined}
        onClick={
          onSelectPart
            ? (event) => {
                event.stopPropagation()
                onSelectPart("options")
              }
            : undefined
        }
        onKeyDown={
          onSelectPart
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  event.stopPropagation()
                  onSelectPart("options")
                }
              }
            : undefined
        }
      >
        {options.map((option, index) => (
          <div
            className="cue-widget-option"
            key={option.id}
            data-leading={!secret && maximum > 0 && option.votes === maximum}
            style={
              {
                "--cue-share": secret ? 0 : share[index] / 100,
              } as CSSProperties
            }
          >
            <div className="cue-widget-option-main">
              {widget.showNumbers && (
                <span className="cue-widget-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
              )}
              <div className="cue-widget-label">
                <span className="cue-widget-name">
                  {option.name.trim() || `Вариант ${index + 1}`}
                </span>
                {widget.showKeywords && (
                  <span className="cue-widget-keyword">
                    {option.word.trim() || "слово"}
                  </span>
                )}
              </div>
              {(widget.showVotes || widget.showPercentages) && (
                <span className="cue-widget-value">
                  <strong>
                    {secret
                      ? "—"
                      : widget.showPercentages
                        ? `${share[index]}%`
                        : option.votes}
                  </strong>
                  {widget.showVotes && widget.showPercentages && !secret && (
                    <small>{option.votes} голос.</small>
                  )}
                </span>
              )}
            </div>
            {widget.showBars && (
              <div className="cue-widget-track">
                <div
                  className="cue-widget-fill"
                  style={{
                    transform: `scaleX(${secret ? 0 : share[index] / 100})`,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {widget.showTotal && (
        <footer className="cue-widget-footer">
          <span>{ended ? "Голосование завершено" : "Всего голосов"}</span>
          <strong>{secret ? "—" : total.toLocaleString("ru")}</strong>
        </footer>
      )}
    </article>
  )
}
