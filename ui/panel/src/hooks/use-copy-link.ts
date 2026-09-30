import { useEffect, useRef, useState } from "react"
import { useToast } from "@/components/ui/toast"

export function useCopyLink(url: string) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mounted = useRef(false)
  const showToast = useToast()
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(timer.current)
    }
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      if (!mounted.current) return
      clearTimeout(timer.current)
      setCopied(true)
      timer.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      if (mounted.current)
        showToast({ message: "Не удалось скопировать ссылку", tone: "error" })
    }
  }

  return { copied, copy }
}
