import { useEffect, useState } from "react"
import { connectEvents } from "../../../../public/shared.js"
import { contestOverlayDefaults } from "../../../../public/contest-overlay-model.js"
import type {
  ContestOverlaySettings,
  PublicContest,
} from "../../../../public/contest-overlay-model.js"
import { ContestOverlayView } from "./contest-overlay-view"
type Snapshot = {
  contest: PublicContest | null
  settings: ContestOverlaySettings
  serverNow: number
}
export function ContestOverlayLive() {
  const [state, setState] = useState<Snapshot>({
    contest: null,
    settings: { ...contestOverlayDefaults },
    serverNow: 0,
  })
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const connection = connectEvents("/api/contest/overlay/events", {
      snapshot: (value: Snapshot) => {
        setState(value)
        setOffset(value.serverNow - Date.now())
      },
    })
    return () => connection.close()
  }, [])
  return (
    <ContestOverlayView
      contest={state.contest}
      settings={state.settings}
      offset={offset}
    />
  )
}
