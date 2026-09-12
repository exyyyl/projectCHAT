/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

export type AppTheme = "lime" | "violet" | "ice"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: AppTheme
  storageKey?: string
}

type ThemeProviderState = {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
}

const THEMES: AppTheme[] = ["lime", "violet", "ice"]
const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

function isTheme(value: string | null): value is AppTheme {
  return value !== null && THEMES.includes(value as AppTheme)
}

function applyTheme(theme: AppTheme) {
  const root = document.documentElement
  root.classList.add("dark")
  for (const value of THEMES) root.classList.remove(`theme-${value}`)
  root.classList.add(`theme-${theme}`)
}

export function ThemeProvider({
  children,
  defaultTheme = "lime",
  storageKey = "projectchat-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<AppTheme>(() => {
    const storedTheme = localStorage.getItem(storageKey)
    return isTheme(storedTheme) ? storedTheme : defaultTheme
  })

  const setTheme = React.useCallback(
    (nextTheme: AppTheme) => {
      localStorage.setItem(storageKey, nextTheme)
      applyTheme(nextTheme)
      setThemeState(nextTheme)
    },
    [storageKey]
  )

  React.useLayoutEffect(() => applyTheme(theme), [theme])

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== storageKey) return
      const nextTheme = isTheme(event.newValue) ? event.newValue : defaultTheme
      applyTheme(nextTheme)
      setThemeState(nextTheme)
    }
    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [defaultTheme, storageKey])

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme() {
  const context = React.useContext(ThemeProviderContext)
  if (!context) throw new Error("useTheme must be used within ThemeProvider")
  return context
}
