import { useCallback, useEffect, useState } from "react"

import type { ContestSetup, ContestState } from "@/domain/contest"

export function useContestController() {
  const [state, setState] = useState<ContestState | null>(null)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const source = new EventSource("/api/events")
    source.addEventListener("contest", (event) => {
      setState(JSON.parse((event as MessageEvent).data) as ContestState)
      setConnected(true)
    })
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    return () => source.close()
  }, [])

  const run = useCallback(
    async (command: Record<string, unknown>) => {
      if (busy || !connected) return null
      setBusy(true)
      setError("")
      try {
        const response = await fetch("/api/contest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Poll-Client": "panel",
          },
          body: JSON.stringify(command),
        })
        const result = (await response.json()) as ContestState & {
          error?: string
        }
        if (!response.ok)
          throw new Error(result.error || "Не удалось выполнить действие.")
        setState(result)
        return result
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Не удалось выполнить действие."
        )
        return null
      } finally {
        setBusy(false)
      }
    },
    [busy, connected]
  )

  const contest = state?.contest || null
  const contestId = contest?.id
  const contestSource = contest?.source
  const contestStatus = contest?.status

  useEffect(() => {
    if (
      !contestId ||
      contestSource !== "test" ||
      !["collecting", "winner"].includes(contestStatus || "")
    )
      return
    const delay = contestStatus === "collecting" ? 850 : 1800
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/contest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Poll-Client": "panel",
          },
          body: JSON.stringify({ type: "demo", contestId }),
        })
        const result = (await response.json()) as ContestState
        if (response.ok)
          setState((current) =>
            !current || result.revision >= current.revision ? result : current
          )
      } catch {
        // The normal SSE connection reports connectivity failures.
      }
    }, delay)
    return () => window.clearInterval(timer)
  }, [contestId, contestSource, contestStatus])

  return {
    state,
    contest,
    connected,
    busy,
    error,
    start: (setup: ContestSetup) => run({ type: "start", setup }),
    close: () => contest && run({ type: "close", contestId: contest.id }),
    draw: () => contest && run({ type: "draw", contestId: contest.id }),
    setEligibility: (participantId: string, eligible: boolean) =>
      contest &&
      run({
        type: "eligibility",
        contestId: contest.id,
        participantId,
        eligible,
      }),
    clearEligibility: () =>
      contest && run({ type: "clear", contestId: contest.id }),
    reset: () => contest && run({ type: "reset", contestId: contest.id }),
  }
}

export type ContestController = ReturnType<typeof useContestController>
