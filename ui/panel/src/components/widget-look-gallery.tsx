import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { Check } from "lucide-react"
import type { Draft, WidgetSettings } from "@/domain/polls"
import { widgetDefaults } from "../../../../public/widget-model.js"
import {
  contestOverlayDefaults,
  type ContestOverlaySettings,
  type PublicContest,
} from "../../../../public/contest-overlay-model.js"
import {
  contestWidgetLooks,
  matchesLook,
  pollWidgetLooks,
} from "@/domain/widget-looks"
import { PollOverlay } from "./poll-overlay"
import { ContestOverlayView } from "./contest-overlay-view"
import "./widget-look-gallery.css"

const samplePoll: Draft = {
  question: "Во что играем?",
  options: [
    { id: "1", name: "Minecraft", word: "майн", votes: 12 },
    { id: "2", name: "Hollow Knight", word: "холлоу", votes: 8 },
    { id: "3", name: "Valorant", word: "вало", votes: 4 },
  ],
  duration: 180,
  secret: false,
  allowChange: false,
  showOverlay: true,
  source: "test",
}
const sampleContest: PublicContest = {
  id: "look-preview",
  status: "collecting",
  mode: "keyword",
  keyword: "участвую",
  numberMin: null,
  numberMax: null,
  winningNumber: null,
  deadline: 180000,
  drawnAt: 0,
  participantCount: 128,
  recentNames: ["ae_evsoul", "kyst21", "limaaay"],
  winner: null,
}
// Miniatures render the same components as the editor and OBS, without clocks.
function LookMiniature({
  width,
  children,
}: {
  width: number
  children: ReactNode
}) {
  const frame = useRef<HTMLSpanElement>(null),
    natural = useRef<HTMLSpanElement>(null)
  const [scale, setScale] = useState(0.18)
  useLayoutEffect(() => {
    const outer = frame.current,
      inner = natural.current
    if (!outer || !inner) return
    const measure = () => {
      const next = Math.min(
        1,
        (outer.clientWidth - 16) / width,
        (outer.clientHeight - 16) / Math.max(1, inner.offsetHeight)
      )
      setScale((current) => (Math.abs(current - next) < 0.001 ? current : next))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    observer.observe(inner)
    measure()
    return () => observer.disconnect()
  }, [width])
  return (
    <span className="widget-look-art" aria-hidden="true" ref={frame}>
      <span
        className="widget-look-natural"
        ref={natural}
        style={{ width, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {children}
      </span>
    </span>
  )
}

type Props =
  | {
      kind: "poll"
      settings: WidgetSettings
      onUpdate: (patch: Partial<WidgetSettings>) => void
    }
  | {
      kind: "contest"
      settings: ContestOverlaySettings
      onUpdate: (patch: Partial<ContestOverlaySettings>) => void
    }
export function WidgetLookGallery(props: Props) {
  const looks = props.kind === "poll" ? pollWidgetLooks : contestWidgetLooks
  return (
    <div
      className="widget-looks"
      role="group"
      aria-label={`Готовые оформления ${props.kind === "poll" ? "опроса" : "конкурса"}`}
    >
      {looks.map((look, index) => {
        const pollPatch = pollWidgetLooks[index].settings,
          contestPatch = contestWidgetLooks[index].settings
        const poll = { ...widgetDefaults, ...pollPatch },
          contest = { ...contestOverlayDefaults, ...contestPatch }
        const selected =
          props.kind === "poll"
            ? matchesLook(props.settings, pollPatch)
            : matchesLook(props.settings, contestPatch)
        return (
          <button
            type="button"
            key={look.id}
            className="widget-look"
            aria-label={`Применить оформление «${look.name}»`}
            aria-pressed={selected}
            onClick={() =>
              props.kind === "poll"
                ? props.onUpdate(pollPatch)
                : props.onUpdate(contestPatch)
            }
          >
            <LookMiniature
              width={
                props.kind === "poll" ? poll.panelWidth : contest.width + 48
              }
            >
              {props.kind === "poll" ? (
                <PollOverlay poll={samplePoll} widget={poll} />
              ) : (
                <ContestOverlayView
                  contest={sampleContest}
                  settings={contest}
                  preview
                  snapshotTime={0}
                />
              )}
            </LookMiniature>
            <span className="widget-look-name">
              {look.name}
              {selected && <Check aria-hidden="true" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
