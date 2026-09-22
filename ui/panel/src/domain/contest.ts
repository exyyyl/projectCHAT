export type ContestAudienceRole = "viewer" | "subscriber" | "vip" | "moderator"

export type ContestParticipant = {
  id: string
  name: string
  login: string
  messageId: string
  message: string
  joinedAt: number
  roles: ContestAudienceRole[]
  eligible: boolean
  excludedReason: "" | "manual" | "repeat"
}

export type WinnerMessage = { id: string; text: string; at: number }

export type Contest = {
  id: string
  status: "collecting" | "ready" | "winner" | "finished"
  mode: "keyword" | "active"
  keyword: string
  antiSpam: boolean
  allowedRoles: ContestAudienceRole[]
  duration: number
  source: "twitch" | "test"
  broadcasterId: string
  startedAt: number
  deadline: number
  participants: ContestParticipant[]
  winner: ContestParticipant | null
  winnerMessages: WinnerMessage[]
  winnerHistory: string[]
}

export type ContestState = {
  revision: number
  serverNow: number
  contest: Contest | null
}

export type ContestSetup = {
  mode: "keyword" | "active"
  keyword: string
  antiSpam: boolean
  allowedRoles: ContestAudienceRole[]
  duration: number
  source: "twitch" | "test"
}
