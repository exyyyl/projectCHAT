export type ModerationAction = "delete" | "timeout" | "ban"
export const timeoutSteps = [
  { duration: 60, label: "1 мин" },
  { duration: 300, label: "5 мин" },
  { duration: 600, label: "10 мин" },
  { duration: 3600, label: "1 час" },
  { duration: 86400, label: "1 день" },
  { duration: 604800, label: "7 дней" },
  { duration: 1209600, label: "14 дней" },
] as const

// Scale the travel to the message width so every duration remains reachable on touch screens.
// The final ban has its own travel segment and is never selected by a short flick.
export function swipeModeration(
  distance: number,
  width: number
): {
  action: ModerationAction
  duration?: number
  label: string
  ready: boolean
} {
  const threshold = Math.min(80, width * 0.24)
  if (distance < 0)
    return { action: "delete", label: "Удалить", ready: -distance >= threshold }
  const end = Math.max(threshold + 80, Math.min(480, width * 0.85))
  const progress = Math.max(
    0,
    Math.min(1, (distance - threshold) / (end - threshold))
  )
  const index = Math.floor(progress * timeoutSteps.length)
  if (index >= timeoutSteps.length)
    return { action: "ban", label: "Бан навсегда", ready: true }
  return {
    action: "timeout",
    ...timeoutSteps[index],
    ready: distance >= threshold,
  }
}

export type ModerationPermissions = {
  canDelete: boolean
  canTimeout: boolean
  isSelf: boolean
}

export function moderationRejection(
  action: ModerationAction,
  permissions: ModerationPermissions
): string | null {
  if (action !== "delete" && permissions.isSelf) return "Себя отстранить нельзя"
  if (action === "delete" ? !permissions.canDelete : !permissions.canTimeout)
    return action === "delete"
      ? "Нет прав на удаление сообщений"
      : "Нет прав на отстранение из чата"
  return null
}

export function releaseModerationSwipe(
  distance: number,
  width: number,
  permissions: ModerationPermissions
) {
  const choice = swipeModeration(distance, width)
  const rejection = moderationRejection(choice.action, permissions)
  return {
    choice,
    rejection,
    hint: rejection || (choice.ready ? null : "Потяните дальше"),
  }
}
