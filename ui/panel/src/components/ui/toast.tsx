import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

type ToastTone = "default" | "success" | "warning" | "error"

type ToastInput = {
  message: string
  tone?: ToastTone
  duration?: number
}

type ToastItem = ToastInput & { id: number }

type ToastContextValue = {
  showToast: (input: string | ToastInput) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneClasses: Record<ToastTone, string> = {
  default: "border-border-strong",
  success: "border-brand/25",
  warning: "border-amber-300/25",
  error: "border-destructive/30",
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (input: string | ToastInput) => {
      const toast = typeof input === "string" ? { message: input } : input
      const id = ++nextId.current
      setToasts((current) => [...current.slice(-3), { ...toast, id }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), toast.duration ?? 4200)
      )
    },
    [dismiss]
  )

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer)
    },
    []
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed right-5 bottom-5 z-100 flex w-[min(23rem,calc(100vw-2.5rem))] flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          const tone = toast.tone ?? "default"
          return (
            <div
              key={toast.id}
              role={tone === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex animate-in items-start gap-3 rounded-xl border bg-popover/95 px-4 py-3 text-sm text-popover-foreground shadow-2xl shadow-black/30 backdrop-blur-xl fade-in slide-in-from-bottom-2",
                toneClasses[tone]
              )}
            >
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground",
                  tone === "success" && "bg-brand",
                  tone === "warning" && "bg-amber-300",
                  tone === "error" && "bg-destructive"
                )}
              />
              <span className="min-w-0 flex-1 leading-relaxed">
                {toast.message}
              </span>
              <button
                type="button"
                className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground"
                aria-label="Закрыть уведомление"
                onClick={() => dismiss(toast.id)}
              >
                <X className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context)
    throw new Error("useToast должен использоваться внутри ToastProvider")
  return context.showToast
}
