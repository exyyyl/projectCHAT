import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Check, Info, TriangleAlert, X, XCircle } from "lucide-react"

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

const toneStyles: Record<
  ToastTone,
  { icon: typeof Info; iconClassName: string }
> = {
  default: { icon: Info, iconClassName: "bg-white/7 text-foreground/75" },
  success: { icon: Check, iconClassName: "bg-brand/12 text-brand" },
  warning: {
    icon: TriangleAlert,
    iconClassName: "bg-amber-300/12 text-amber-200",
  },
  error: {
    icon: XCircle,
    iconClassName: "bg-destructive/12 text-destructive",
  },
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
        className="pointer-events-none fixed top-4 right-4 z-100 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          const tone = toast.tone ?? "default"
          const style = toneStyles[tone]
          const StatusIcon = style.icon
          return (
            <div
              key={toast.id}
              role={tone === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex animate-in items-center gap-3 rounded-xl bg-[#1b1f25]/96 p-2.5 pr-2 text-sm text-popover-foreground shadow-[0_12px_36px_rgb(0_0_0/0.38)] ring-1 ring-white/9 backdrop-blur-xl fade-in slide-in-from-top-2 zoom-in-95 duration-200 motion-reduce:animate-none"
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  style.iconClassName
                )}
              >
                <StatusIcon className="size-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 leading-snug text-foreground/90">
                {toast.message}
              </span>
              <button
                type="button"
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/65 transition-colors hover:bg-white/6 hover:text-foreground"
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
