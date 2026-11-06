/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { appThemes, isAppTheme, type AppTheme } from "@/domain/app-themes"

export type { AppTheme } from "@/domain/app-themes"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: AppTheme
  storageKey?: string
}

type ThemeProviderState = {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
}

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

function applyTheme(theme: AppTheme) {
  const root = document.documentElement
  root.classList.add("dark")
  for (const { id } of appThemes) root.classList.remove(`theme-${id}`)
  root.classList.add(`theme-${theme}`)
}

export function ThemeProvider({
  children,
  defaultTheme = "lime",
  storageKey = "projectchat-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<AppTheme>(() => {
    try {
      const storedTheme = localStorage.getItem(storageKey)
      return isAppTheme(storedTheme) ? storedTheme : defaultTheme
    } catch {
      return defaultTheme
    }
  })

  const setTheme = React.useCallback(
    (nextTheme: AppTheme) => {
      try {
        localStorage.setItem(storageKey, nextTheme)
      } catch {
        // Theme selection remains available without persistent storage.
      }
      applyTheme(nextTheme)
      setThemeState(nextTheme)
    },
    [storageKey]
  )

  React.useLayoutEffect(() => {
    applyTheme(theme)
    void window.streamPollsDesktop?.setWindowTheme(theme).catch(() => {
      // An older desktop shell may not know a newly added panel theme yet.
    })
  }, [theme])

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== storageKey) return
      const nextTheme = isAppTheme(event.newValue)
        ? event.newValue
        : defaultTheme
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
