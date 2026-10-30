import type { ChatEmoteSpan } from "./chat-emotes"

export type ChatBadge = { setId: string; id: string }
export type ChatBadgeAsset = { url: string; title: string }

export type ChatMessage = {
  id: number
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

export type ChatNote = { id: string; text: string; createdAt: number }

export type ChatArchiveSummary = {
  count: number
  feedCount: number
  firstSeen: number | null
  storageBytes: number
  maxMessages: number
  maxBytes: number
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
