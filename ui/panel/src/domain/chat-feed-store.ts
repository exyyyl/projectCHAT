import { outgoingChatMessage, type FeedMessage } from "./chat-delivery.ts"

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">
type Update = FeedMessage[] | ((messages: FeedMessage[]) => FeedMessage[])
type Snapshot = { messages: FeedMessage[]; storageError: boolean }
const keyFor = (channelId: string) => `cue-chat-outbox:${channelId}`

export function createChatFeedStore(storage?: StorageLike) {
  const channels = new Map<string, ReturnType<typeof createEntry>>()
  function createEntry(channelId: string) {
    const listeners = new Set<() => void>()
    let raw = "",
      storageError = !storage
    const restored: FeedMessage[] = []
    try {
      raw = storage?.getItem(keyFor(channelId)) || ""
      const saved = raw ? JSON.parse(raw) : null
      if (saved?.schema === 1 && Array.isArray(saved.items)) {
        const seen = new Set<string>()
        for (const item of saved.items.slice(-1000)) {
          if (
            typeof item?.localKey !== "string" ||
            !item.localKey ||
            item.localKey.length > 100 ||
            seen.has(item.localKey) ||
            typeof item.text !== "string" ||
            !item.text.trim() ||
            item.text.length > 500 ||
            !Number.isSafeInteger(item.sentAt) ||
            item.sentAt < 1 ||
            !["sending", "failed"].includes(item.delivery)
          )
            continue
          seen.add(item.localKey)
          const message = outgoingChatMessage(
            [],
            {
              userId: channelId,
              displayName:
                typeof item.viewerName === "string"
                  ? item.viewerName.slice(0, 50)
                  : "",
              login:
                typeof item.viewerLogin === "string"
                  ? item.viewerLogin.slice(0, 50)
                  : "",
            },
            item.text,
            item.localKey,
            item.sentAt
          )
          restored.push({
            ...message,
            delivery: "failed",
            deliveryError:
              item.delivery === "sending"
                ? "Отправка не подтверждена. Проверьте чат перед повтором."
                : typeof item.deliveryError === "string"
                  ? item.deliveryError.slice(0, 2000)
                  : "Не удалось отправить сообщение.",
            nameColor:
              typeof item.nameColor === "string" &&
              /^#[a-f0-9]{6}$/i.test(item.nameColor)
                ? item.nameColor
                : "",
            badges: Array.isArray(item.badges)
              ? item.badges
                  .slice(0, 20)
                  .filter(
                    (badge: { setId?: unknown; id?: unknown }) =>
                      typeof badge?.setId === "string" &&
                      /^[\w-]{1,64}$/.test(badge.setId) &&
                      typeof badge.id === "string" &&
                      /^[\w-]{1,64}$/.test(badge.id)
                  )
              : message.badges,
          })
        }
      }
    } catch {
      storageError = true
    }
    let snapshot: Snapshot = { messages: restored, storageError }
    let lastAttempt = raw
    const entry = {
      read: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      observed: () => listeners.size > 0,
      inFlight: () =>
        snapshot.messages.some((message) => message.delivery === "sending"),
      update: (change: Update) => {
        const messages =
          typeof change === "function" ? change(snapshot.messages) : change
        if (messages === snapshot.messages) return
        const items = messages
          .filter(
            (message) => message.id <= 0 && message.delivery && message.localKey
          )
          .map(
            ({
              localKey,
              delivery,
              deliveryError,
              text,
              sentAt,
              viewerName,
              viewerLogin,
              nameColor,
              badges,
            }) => ({
              localKey,
              delivery,
              deliveryError,
              text,
              sentAt,
              viewerName,
              viewerLogin,
              nameColor,
              badges,
            })
          )
        const serialized = items.length
          ? JSON.stringify({ schema: 1, items })
          : ""
        let failed = snapshot.storageError
        if (storage && serialized !== lastAttempt) {
          lastAttempt = serialized
          try {
            if (serialized) storage.setItem(keyFor(channelId), serialized)
            else storage.removeItem(keyFor(channelId))
            raw = serialized
            failed = false
          } catch {
            failed = true
          }
        }
        snapshot = { messages, storageError: failed }
        for (const listener of listeners) listener()
      },
    }
    return entry
  }
  return {
    forChannel(channelId: string) {
      let entry = channels.get(channelId)
      if (!entry) {
        // Only the outbox is durable; bound cached confirmed feeds across accounts.
        if (channels.size >= 4)
          for (const [id, cached] of channels)
            if (!cached.observed() && !cached.inFlight()) {
              channels.delete(id)
              break
            }
        entry = createEntry(channelId)
        channels.set(channelId, entry)
      }
      return entry
    },
  }
}
