import { useEffect, useState } from "react"

const key = "projectchat-demo-mode"
const eventName = "projectchat-demo-mode-change"

const read = () => {
  const saved = localStorage.getItem(key)
  return saved === null ? import.meta.env.DEV : saved === "true"
}

export function useDemoMode() {
  const [enabled, setEnabledState] = useState(read)

  useEffect(() => {
    const sync = () => setEnabledState(read())
    window.addEventListener("storage", sync)
    window.addEventListener(eventName, sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener(eventName, sync)
    }
  }, [])

  const setEnabled = (value: boolean) => {
    localStorage.setItem(key, String(value))
    window.dispatchEvent(new Event(eventName))
  }

  return { enabled, setEnabled }
}
