import type { ChatMessage } from "./chat"

export type FeedMessage = ChatMessage & {
  localKey?: string
  delivery?: "sending" | "failed"
  deliveryError?: string
}

export function mergeChatFeed(
  current: FeedMessage[],
  incoming: ChatMessage[],
  options: { confirmedKey?: string; echo?: boolean; limit?: number } = {}
): FeedMessage[] {
  const { confirmedKey, echo = false, limit = 1000 } = options
  let result = [...current]
  for (const message of incoming) {
    const existing = result.find(
      (item) => item.id > 0 && item.id === message.id
    )
    const pending = result.find(
      (item) =>
        item.localKey &&
        (confirmedKey
          ? item.localKey === confirmedKey
          : echo &&
            !existing &&
            item.delivery &&
            message.kind === "message" &&
            item.viewerId === message.viewerId &&
            item.text === message.text &&
            Math.abs(item.sentAt - message.sentAt) < 120000)
    )
    const previous = pending || existing
    const merged: FeedMessage = {
      ...message,
      ...(previous?.localKey ? { localKey: previous.localKey } : {}),
      // A send acknowledgement may arrive before EventSub's styling. Keep what
      // is already on screen until Twitch supplies the enriched metadata.
      badges: message.badges?.length ? message.badges : previous?.badges || [],
      nameColor: message.nameColor || previous?.nameColor || "",
      emotes: message.emotes?.length
        ? message.emotes
        : previous?.text === message.text
          ? previous.emotes
          : message.emotes,
      deleted: Boolean(message.deleted || previous?.deleted),
    }
    result = result.filter((item) => item !== existing && item !== pending)
    result.push(merged)
  }
  const confirmed = result
    .filter((item) => item.id > 0)
    .sort((a, b) => a.id - b.id)
  const pending = result.filter((item) => item.id <= 0)
  return [...confirmed, ...pending].slice(-limit)
}

export function failedChatMessage(
  current: FeedMessage[],
  key: string,
  error: string
): FeedMessage[] {
  // EventSub can confirm delivery before an HTTP error or timeout arrives.
  return current.map((item) =>
    item.localKey === key && item.delivery
      ? { ...item, delivery: "failed", deliveryError: error }
      : item
  )
}

export function discardFailedChatMessage(
  current: FeedMessage[],
  key: string
): FeedMessage[] {
  return current.filter(
    (item) =>
      !(item.id <= 0 && item.delivery === "failed" && item.localKey === key)
  )
}

export function outgoingChatMessage(
  messages: FeedMessage[],
  author: { userId: string; displayName: string; login: string },
  text: string,
  key: string,
  now: number
): FeedMessage {
  const own = [...messages]
    .reverse()
    .filter(
      (item) =>
        item.viewerId === `twitch:${author.userId}` && item.kind === "message"
    )
  return {
    id: -now,
    localKey: key,
    delivery: "sending",
    kind: "message",
    activityType: "",
    viewerId: `twitch:${author.userId}`,
    viewerName: author.displayName || author.login,
    viewerLogin: author.login,
    roles: ["moderator"],
    badges: own.find((item) => item.badges.length)?.badges || [
      { setId: "broadcaster", id: "1" },
    ],
    nameColor: own.find((item) => item.nameColor)?.nameColor || "",
    cheerBits: 0,
    text,
    sentAt: now,
  }
}
