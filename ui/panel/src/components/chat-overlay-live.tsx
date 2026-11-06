import { useEffect, useState } from "react"
import { chatOverlayDefaults } from "../../../../public/chat-overlay-model.js"
import type { ChatOverlaySettings } from "../../../../public/chat-overlay-model.js"
import { connectEvents } from "../../../../public/shared.js"
import type { ChatBadgeAsset, ChatMessage } from "@/domain/chat"
import { retainChatMessages, type ChatArchiveCleanup } from "@/domain/chat"
import type { ChatEmoteCatalog } from "@/domain/chat-emotes"
import { ChatOverlayView } from "./chat-overlay-view"

type Snapshot = {
  channelId: string
  settings: ChatOverlaySettings
  messages: ChatMessage[]
  serverNow: number
}
export function ChatOverlayLive({ preview = false }: { preview?: boolean }) {
  const [state, setState] = useState<Snapshot>({
    channelId: "",
    settings: { ...chatOverlayDefaults },
    messages: [],
    serverNow: 0,
  })
  const [offset, setOffset] = useState(0)
  const [assets, setAssets] = useState<{
    channelId: string
    catalog: ChatEmoteCatalog | null
    badges: Record<string, ChatBadgeAsset>
  }>({ channelId: "", catalog: null, badges: {} })
  useEffect(() => {
    const merge = (message: ChatMessage) =>
      setState((current) => ({
        ...current,
        messages: [
          ...current.messages.filter((item) => item.id !== message.id),
          message,
        ]
          .sort((a, b) => a.id - b.id)
          .slice(-100),
      }))
    const connection = connectEvents("/api/chat/overlay/events", {
      snapshot: (snapshot: Snapshot) => {
        setState(snapshot)
        setOffset(snapshot.serverNow - Date.now())
      },
      settings: (settings: ChatOverlaySettings) =>
        setState((current) => ({ ...current, settings })),
      message: merge,
      update: merge,
      cleanup: (change: ChatArchiveCleanup) =>
        setState((current) =>
          current.channelId !== change.channelId
            ? current
            : {
                ...current,
                messages: retainChatMessages(current.messages, {
                  allThrough: change.scope === "all" ? change.throughId : 0,
                  deletedThrough:
                    change.scope === "deleted" ? change.throughId : 0,
                }),
              }
        ),
    })
    return () => connection.close()
  }, [])
  useEffect(() => {
    if (!state.channelId) return
    const channelId = state.channelId
    const controller = new AbortController()
    const load = () => {
      void Promise.allSettled(
        ["/api/chat/emotes", "/api/chat/badges"].map(async (url) => {
          const response = await fetch(url, { signal: controller.signal })
          if (!response.ok) throw new Error("assets unavailable")
          return response.json()
        })
      ).then(([emotes, badges]) => {
        if (controller.signal.aborted) return
        setAssets({
          channelId,
          catalog:
            emotes.status === "fulfilled" &&
            emotes.value.channelId === channelId
              ? emotes.value
              : null,
          badges: badges.status === "fulfilled" ? badges.value.badges : {},
        })
      })
    }
    load()
    const timer = setInterval(load, 300_000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [state.channelId])
  return (
    <ChatOverlayView
      preview={preview}
      key={state.channelId}
      messages={state.messages}
      settings={state.settings}
      offset={offset}
      emotes={
        assets.channelId === state.channelId
          ? assets.catalog?.emotes
          : undefined
      }
      badges={assets.channelId === state.channelId ? assets.badges : undefined}
    />
  )
}
