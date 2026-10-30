import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import { Crown, Gift, Users } from "lucide-react"
import { contestPresentation } from "../../../../public/contest-overlay-model.js"
import type {
  ContestOverlaySettings,
  PublicContest,
} from "../../../../public/contest-overlay-model.js"
import "./contest-overlay.css"

export function ContestOverlayView({
  contest,
  settings,
  offset = 0,
  preview = false,
}: {
  contest: PublicContest | null
  settings: ContestOverlaySettings
  offset?: number
  preview?: boolean
}) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!contest) return
    const timer = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(timer)
  }, [contest])
  const presentation = contestPresentation(
    contest,
    Math.max(now + offset, contest?.drawnAt || 0)
  )
  if (!contest || (!preview && !settings.enabled)) return null
  const winner = presentation.phase === "winner",
    drawing = presentation.phase === "drawing"
  const remaining = `${Math.floor(presentation.seconds / 60)
    .toString()
    .padStart(
      2,
      "0"
    )}:${(presentation.seconds % 60).toString().padStart(2, "0")}`
  const style = {
    width: settings.width,
    fontSize: settings.fontSize,
    "--contest-accent": settings.accentColor,
    "--contest-text": settings.textColor,
    "--contest-background":
      settings.backgroundColor +
      Math.round((settings.opacity / 100) * 255)
        .toString(16)
        .padStart(2, "0"),
    "--contest-radius": `${settings.radius}px`,
  } as CSSProperties
  return (
    <div className="cue-contest-frame">
      <section
        className="cue-contest"
        style={style}
        aria-label="Конкурс на стриме"
        data-phase={presentation.phase}
      >
        <header>
          <span>
            <Gift aria-hidden="true" />
            Розыгрыш
          </span>
          {settings.showTimer && contest.status === "collecting" && (
            <time>{remaining}</time>
          )}
        </header>
        {winner || drawing ? (
          <div
            className="cue-contest-result"
            key={`${contest.id}:${contest.drawnAt}:${presentation.phase}`}
          >
            <Crown aria-hidden="true" />
            <p>{drawing ? "Выбираем победителя" : "Победитель"}</p>
            <strong className="cue-contest-name">{presentation.name}</strong>
            {winner && contest.mode === "number" && (
              <span>Угадано число {contest.winningNumber}</span>
            )}
          </div>
        ) : (
          <div className="cue-contest-entry">
            <h2>
              {contest.status === "collecting"
                ? contest.mode === "number"
                  ? "Угадай число"
                  : "Участвуй в розыгрыше"
                : contest.status === "finished"
                  ? "Конкурс завершён"
                  : "Приём участников завершён"}
            </h2>
            {contest.status === "collecting" ? (
              contest.mode === "keyword" ? (
                <p>
                  Напиши{" "}
                  <strong className="cue-contest-keyword">
                    {contest.keyword}
                  </strong>{" "}
                  в чат
                </p>
              ) : contest.mode === "number" ? (
                <p>
                  От <strong>{contest.numberMin}</strong> до{" "}
                  <strong>{contest.numberMax}</strong> — напиши свой вариант в
                  чат
                </p>
              ) : (
                <p>Напиши любое сообщение в чат</p>
              )
            ) : (
              <p>
                {contest.mode === "number"
                  ? `Загаданное число: ${contest.winningNumber}`
                  : "Скоро узнаем победителя"}
              </p>
            )}
          </div>
        )}
        {settings.showCount && (
          <div className="cue-contest-count">
            <Users aria-hidden="true" />
            <span>{contest.participantCount} участников</span>
          </div>
        )}
        {settings.showRecent &&
          !winner &&
          !drawing &&
          contest.recentNames.length > 0 && (
            <div className="cue-contest-recent">
              {contest.recentNames.slice(-3).map((name, index) => (
                <span key={index}>{name}</span>
              ))}
            </div>
          )}
      </section>
    </div>
  )
}
