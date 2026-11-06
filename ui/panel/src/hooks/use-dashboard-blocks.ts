import { useCallback, useEffect, useState, type SetStateAction } from "react"
import {
  restoreDashboardBlocks,
  normalizeWidgetOrder,
  widgetIds,
  type WidgetId,
} from "@/domain/streamer-widgets"

export function useDashboardBlocks() {
  const [order, updateOrder] = useState<WidgetId[]>(() => {
    try {
      return restoreDashboardBlocks(
        JSON.parse(localStorage.getItem("cue-home-widgets") || "null")
      )
    } catch {
      return [...widgetIds]
    }
  })
  const setOrder = useCallback((next: SetStateAction<WidgetId[]>) => {
    updateOrder((current) =>
      normalizeWidgetOrder(typeof next === "function" ? next(current) : next)
    )
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(
        "cue-home-widgets",
        JSON.stringify({ version: 2, order })
      )
    } catch {
      /* The panel still works when local storage is unavailable. */
    }
  }, [order])
  const [participants, setParticipants] = useState(() => {
    try {
      return localStorage.getItem("cue-home-participants") !== "false"
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem("cue-home-participants", String(participants))
    } catch {
      /* keep usable without storage */
    }
  }, [participants])
  return [order, setOrder, participants, setParticipants] as const
}
