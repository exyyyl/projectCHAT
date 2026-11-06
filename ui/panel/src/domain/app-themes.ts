export const appThemes = [
  { id: "lime", label: "Лайм" },
  { id: "violet", label: "Пичи" },
  { id: "ice", label: "Лёд" },
  { id: "mono", label: "Тёмная" },
  { id: "rose", label: "Роза" },
  { id: "amber", label: "Янтарь" },
  { id: "forest", label: "Хвоя" },
  { id: "sapphire", label: "Сапфир" },
  { id: "slate", label: "Сланец" },
] as const

export type AppTheme = (typeof appThemes)[number]["id"]
export function isAppTheme(value: unknown): value is AppTheme {
  return appThemes.some((theme) => theme.id === value)
}
