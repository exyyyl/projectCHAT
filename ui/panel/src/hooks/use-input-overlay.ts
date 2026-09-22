import { useCallback, useEffect, useRef, useState } from "react"

import type {
  InputOverlayConfig,
  InputOverlayState,
} from "@/domain/input-overlay"

type InputCommand =
  | { type: "update"; config: InputOverlayConfig }
  | { type: "demo" }
  | { type: "reset" }

export function useInputOverlay() {
  const [state, setState] = useState<InputOverlayState | null>(null)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const revision = useRef(-1)

  const accept = useCallback((incoming: InputOverlayState) => {
    if (incoming.revision < revision.current) return
    revision.current = incoming.revision
    setState(incoming)
  }, [])

  useEffect(() => {
    const source = new EventSource("/api/input-overlay/events")
    source.addEventListener("input", (event) => {
      setConnected(true)
      accept(JSON.parse((event as MessageEvent).data) as InputOverlayState)
    })
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    return () => source.close()
  }, [accept])

  const send = useCallback(
    async (command: InputCommand) => {
      setBusy(true)
      setError("")
      try {
        const response = await fetch("/api/input-overlay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Poll-Client": "panel",
          },
          body: JSON.stringify(command),
        })
        const result = (await response.json()) as InputOverlayState & {
          error?: string
        }
        if (!response.ok)
          throw new Error(result.error || "Не удалось обновить оверлей.")
        accept(result)
        return true
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Не удалось обновить оверлей."
        )
        return false
      } finally {
        setBusy(false)
      }
    },
    [accept]
  )

  return {
    state,
    connected,
    busy,
    error,
    update: (config: InputOverlayConfig) => send({ type: "update", config }),
    demo: () => send({ type: "demo" }),
  }
}
