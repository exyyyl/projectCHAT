import { useCallback, useEffect, useRef, useState } from "react"

import {
  type CommandResult,
  type Draft,
  EMPTY_TWITCH,
  type PollOption,
  type Preset,
  type PresetDialogState,
  type ServerState,
  type TwitchState,
  validateDraft,
} from "@/domain/polls"

export function usePollController() {
  const [state, setState] = useState<ServerState | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [twitch, setTwitch] = useState<TwitchState>(EMPTY_TWITCH)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [presetDialog, setPresetDialog] = useState<PresetDialogState | null>(
    null
  )
  const [deletePreset, setDeletePreset] = useState<Preset | null>(null)

  const stateRef = useRef(state)
  const draftRef = useRef(draft)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const generationRef = useRef(0)
  const draftRevisionRef = useRef(0)
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const accept = useCallback((incoming: ServerState, takeDraft = false) => {
    if (stateRef.current && incoming.revision < stateRef.current.revision)
      return
    stateRef.current = incoming
    setState(incoming)
    draftRevisionRef.current = incoming.draftRevision
    if (takeDraft || (!dirtyRef.current && !savingRef.current)) {
      draftRef.current = incoming.draft
      setDraft(incoming.draft)
    }
  }, [])

  const send = useCallback(
    (type: string, data: Record<string, unknown> = {}, takeDraft = false) => {
      const task = queueRef.current
        .catch(() => {})
        .then(async (): Promise<CommandResult> => {
          const body: Record<string, unknown> = { type, ...data }
          if (
            ["save-draft", "start", "preset-apply", "settings-import"].includes(
              type
            )
          )
            body.draftRevision = draftRevisionRef.current
          const response = await fetch("/api/command", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Poll-Client": "panel",
            },
            body: JSON.stringify(body),
          })
          const result = (await response.json()) as CommandResult & {
            error?: string
          }
          if (!response.ok)
            throw new Error(result.error || "Не удалось сохранить изменение.")
          accept(result.state, takeDraft)
          return result
        })
      queueRef.current = task
      return task
    },
    [accept]
  )

  useEffect(() => {
    const source = new EventSource("/api/events")
    source.addEventListener("state", (event) => {
      setConnected(true)
      accept(JSON.parse((event as MessageEvent).data))
    })
    source.addEventListener("twitch", (event) => {
      const value = JSON.parse((event as MessageEvent).data) as TwitchState
      setTwitch(value)
    })
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    return () => source.close()
  }, [accept])

  useEffect(() => {
    if (
      !dirtyRef.current ||
      savingRef.current ||
      !connected ||
      state?.poll ||
      !draft ||
      validateDraft(draft)
    )
      return
    const generation = generationRef.current
    const timer = setTimeout(async () => {
      savingRef.current = true
      try {
        await send("save-draft", { draft })
        if (generation === generationRef.current) dirtyRef.current = false
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Не удалось сохранить черновик."
        )
      } finally {
        savingRef.current = false
      }
    }, 550)
    return () => clearTimeout(timer)
  }, [connected, draft, send, state?.poll])

  const changeDraft = (update: (current: Draft) => Draft) => {
    if (!draftRef.current || stateRef.current?.poll) return
    const next = update(draftRef.current)
    draftRef.current = next
    setDraft(next)
    dirtyRef.current = true
    generationRef.current++
    setSelectedPreset(null)
    setError("")
  }

  const run = async (
    type: string,
    data: Record<string, unknown> = {},
    takeDraft = false
  ): Promise<CommandResult | null> => {
    if (busy || !connected) return null
    setBusy(true)
    setError("")
    try {
      return await send(type, data, takeDraft)
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
  }

  const poll = state?.poll || null
  const canEdit = !poll && !!draft
  const canApplyPreset = poll?.status !== "running" && !!draft
  const twitchWarning =
    poll?.source === "twitch" && poll.status === "running"
      ? twitch.userId && poll.broadcasterId !== twitch.userId
        ? "Опрос привязан к другому аккаунту Twitch."
        : !["connected", "loading"].includes(twitch.phase)
          ? "Нет связи с Twitch. Голоса из чата сейчас не поступают."
          : twitch.lastGapAt && twitch.lastGapAt >= poll.startedAt
            ? "Был разрыв связи с Twitch. Часть голосов могла не поступить."
            : ""
      : ""

  const start = async () => {
    if (!draft) return
    const invalid = validateDraft(draft)
    if (invalid) return setError(invalid)
    dirtyRef.current = false
    if (!(await run("start", { draft }, true))) dirtyRef.current = true
  }
  const clear = async () => {
    if (poll) await run("clear", { pollId: poll.id }, true)
  }
  const setOutput = async (visible: boolean) => {
    if (poll) await run("visibility", { pollId: poll.id, visible })
    else changeDraft((value) => ({ ...value, showOverlay: visible }))
  }
  const applyPreset = async (preset: Preset) => {
    dirtyRef.current = false
    const result = await run("preset-apply", { presetId: preset.id }, true)
    if (result) setSelectedPreset(preset.id)
    else dirtyRef.current = true
    return !!result
  }
  const importSettings = async (settings: unknown) => {
    dirtyRef.current = false
    const result = await run("settings-import", { settings }, true)
    if (!result) {
      dirtyRef.current = true
      return false
    }
    setSelectedPreset(null)
    return true
  }
  const savePreset = async (name: string, presetDraft: Draft) => {
    const result =
      presetDialog?.mode === "edit"
        ? await run("preset-update", {
            presetId: presetDialog.preset.id,
            name: name.trim(),
            draft: presetDraft,
          })
        : await run("preset-create", { name: name.trim(), draft: presetDraft })
    if (!result) return false
    if (presetDialog?.mode === "create")
      setSelectedPreset(result.state.presets.at(-1)?.id || null)
    setPresetDialog(null)
    return true
  }
  const twitchCommand = async (type: "connect" | "disconnect") => {
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/twitch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Poll-Client": "panel",
        },
        body: JSON.stringify({ type }),
      })
      const result = (await response.json()) as TwitchState & { error?: string }
      if (!response.ok)
        throw new Error(result.error || "Не удалось подключить Twitch.")
      setTwitch(result)
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Не удалось подключить Twitch."
      )
    } finally {
      setBusy(false)
    }
  }
  const vote = async (option: PollOption) => {
    if (poll?.source === "test")
      await run("vote", {
        pollId: poll.id,
        viewerId: `demo:${crypto.randomUUID()}`,
        eventId: crypto.randomUUID(),
        message: option.word,
      })
  }
  const simulate = () => {
    if (!poll || poll.source !== "test") return
    let count = 0
    const pollId = poll.id
    const timer = setInterval(() => {
      const latest = stateRef.current?.poll
      if (
        !latest ||
        latest.id !== pollId ||
        latest.status !== "running" ||
        count++ >= 18
      )
        return clearInterval(timer)
      const option =
        latest.options[
          Math.random() < 0.45
            ? 0
            : Math.floor(Math.random() * latest.options.length)
        ]
      void send("vote", {
        pollId,
        viewerId: `demo:${crypto.randomUUID()}`,
        eventId: crypto.randomUUID(),
        message: option.word,
      })
    }, 420)
  }

  return {
    state,
    draft,
    twitch,
    connected,
    busy,
    error,
    selectedPreset,
    presetDialog,
    deletePreset,
    poll,
    canEdit,
    canApplyPreset,
    twitchWarning,
    changeDraft,
    run,
    start,
    clear,
    setOutput,
    applyPreset,
    importSettings,
    savePreset,
    twitchCommand,
    vote,
    simulate,
    setPresetDialog,
    setDeletePreset,
  }
}
