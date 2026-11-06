import type { ChatEmoteSpan } from "./chat-emotes"

export type ChatBadge = { setId: string; id: string }
export type ChatBadgeAsset = { url: string; title: string }

export type ChatMessage = {
  id: number
  deleted?: boolean
  kind: "message" | "activity"
  activityType: string
  viewerId: string
  viewerName: string
  viewerLogin: string
  roles: string[]
  badges: ChatBadge[]
  nameColor: string
  cheerBits: number
  text: string
  emotes?: ChatEmoteSpan[]
  sentAt: number
}

export type ChatNote = {
  id: string
  text: string
  createdAt: number
  updatedAt?: number
}
export type StreamerNote = ChatNote & { task: boolean; completed: boolean }

export type ChatArchiveSummary = {
  count: number
  deletedCount: number
  feedCount: number
  firstSeen: number | null
  storageBytes: number
  maxMessages: number
  maxBytes: number
}

export type ChatArchiveCleanup = {
  channelId: string
  scope: "deleted" | "all"
  throughId: number
  removed: number
  compacted?: boolean
  archive: ChatArchiveSummary
}

export type ChatArchiveRetention = {
  allThrough: number
  deletedThrough: number
}

// A late page or send acknowledgement must not restore cleared records.
export function retainChatMessages<T extends ChatMessage>(
  messages: T[],
  retention: ChatArchiveRetention
): T[] {
  return messages.filter(
    (message) =>
      message.id <= 0 ||
      (message.id > retention.allThrough &&
        (!message.deleted || message.id > retention.deletedThrough))
  )
}

export type ChatProfile = {
  viewerId: string
  viewerName: string
  viewerLogin: string
  roles: string[]
  nameColor: string
  messageCount: number
  firstSeen: number | null
  lastSeen: number | null
  messages: ChatMessage[]
  notes: ChatNote[]
}

export type RecentChat = {
  channelId: string
  messages: ChatMessage[]
  archive: ChatArchiveSummary
}

export type ChatParticipant = {
  viewerId: string
  viewerName: string
  viewerLogin: string
  nameColor: string
  messageCount: number
  lastSeen: number
}
export type ChatParticipantsSnapshot = {
  channelId: string
  since: number
  computedAt: number
  total: number
  participants: ChatParticipant[]
}
