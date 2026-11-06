import { useMemo, useSyncExternalStore } from "react"
import { createChatFeedStore } from "@/domain/chat-feed-store"
let store: ReturnType<typeof createChatFeedStore> | undefined
function sessionStore() {
  if (!store) {
    let storage: Storage | undefined
    try {
      storage = window.localStorage
    } catch {
      /* session memory remains usable */
    }
    store = createChatFeedStore(storage)
  }
  return store
}
export function useChatFeed(channelId: string) {
  const entry = useMemo(() => sessionStore().forChannel(channelId), [channelId])
  const snapshot = useSyncExternalStore(entry.subscribe, entry.read, entry.read)
  return [snapshot.messages, entry.update, snapshot.storageError] as const
}
