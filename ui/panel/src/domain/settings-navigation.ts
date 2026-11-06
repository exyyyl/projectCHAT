export type SettingsSection =
  | "general"
  | "appearance"
  | "updates"
  | "data"
  | "plugins"
  | "diagnostics"
  | "about"

export const settingsTitles: Record<SettingsSection, string> = {
  general: "Общие",
  appearance: "Оформление",
  updates: "Обновления",
  data: "Данные",
  plugins: "Плагины",
  diagnostics: "Журнал",
  about: "О Cue",
}
