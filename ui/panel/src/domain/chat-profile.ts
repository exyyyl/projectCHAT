import type { ChatMessage } from "./chat"

export function profileMessageDays(messages: ChatMessage[]) {
  const groups: { day: number; messages: ChatMessage[] }[] = []
  for (const message of messages) {
    const date = new Date(message.sentAt)
    const day = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ).getTime()
    const last = groups.at(-1)
    if (last?.day === day) last.messages.push(message)
    else groups.push({ day, messages: [message] })
  }
  return groups
}

const roleLabels: Record<string, string> = {
  broadcaster: "Стример",
  moderator: "Модератор",
  vip: "VIP",
  subscriber: "Подписчик",
  founder: "Основатель",
}
export function viewerRoleLabels(roles: string[]) {
  return [
    ...new Set(
      roles
        .filter((role) => role !== "viewer")
        .map((role) => roleLabels[role] || role)
    ),
  ]
}
