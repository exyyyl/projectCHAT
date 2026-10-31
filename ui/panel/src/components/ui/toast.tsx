import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { Check, Info, TriangleAlert, X, XCircle } from "lucide-react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

import { cn } from "@/lib/utils"
import { presentError } from "../../../../../public/error-messages.js"
import { recordClientError } from "@/domain/diagnostics"
import {
  createToastStore,
  type ToastTone,
  type ToastItem,
} from "@/domain/toasts"

type ToastContextValue = ReturnType<typeof createToastStore>
gsap.registerPlugin(useGSAP)

const ToastContext = createContext<ToastContextValue | null>(null)

const toneStyles: Record<
  ToastTone,
  { icon: typeof Info; iconClassName: string }
> = {
  default: {
    icon: Info,
    iconClassName: "bg-surface-raised text-foreground/75",
  },
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
  const [store] = useState(() => {
    const base = createToastStore()
    return {
      ...base,
      show(input: Parameters<typeof base.show>[0]) {
        const toast = typeof input === "string" ? { message: input } : input
        if (toast.tone !== "error") return base.show(input)
        recordClientError(toast.message)
        const notice = presentError(toast.message)
        base.show({
          ...toast,
          message: notice.title,
          description: notice.description || toast.description,
          duration: toast.duration ?? 6500,
        })
      },
    }
  })
  useEffect(() => () => store.dispose(), [store])
  useEffect(() => {
    const onError = (event: ErrorEvent) =>
      store.show({
        message:
          event.error instanceof Error
            ? event.error.stack || event.error.message
            : event.message,
        tone: "error",
      })
    const onRejection = (event: PromiseRejectionEvent) =>
      store.show({
        message:
          event.reason instanceof Error
            ? event.reason.stack || event.reason.message
            : String(event.reason),
        tone: "error",
      })
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [store])
  return <ToastContext.Provider value={store}>{children}</ToastContext.Provider>
}

export function ToastViewport({
  onOpenDiagnostics,
}: {
  onOpenDiagnostics?: () => void
}) {
  const store = useContext(ToastContext)!
  const toasts = useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    store.snapshot
  )
  return (
    <div
      className="app-notifications"
      aria-label="Уведомления"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastNotice
          key={toast.id}
          toast={toast}
          dismiss={store.dismiss}
          onExit={store.finishDismiss}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      ))}
    </div>
  )
}

function ToastNotice({
  toast,
  dismiss,
  onExit,
  onOpenDiagnostics,
}: {
  toast: ToastItem
  dismiss: (id: number) => void
  onExit: (id: number) => void
  onOpenDiagnostics?: () => void
}) {
  const element = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      gsap.set(element.current, { y: 40, opacity: 0 })
    },
    { scope: element }
  )
  useGSAP(
    () => {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
      gsap.to(element.current, {
        y: toast.leaving ? 40 : 0,
        opacity: toast.leaving ? 0 : 1,
        duration: reduced ? 0 : toast.leaving ? 0.36 : 0.6,
        ease: toast.leaving ? "power2.in" : "power3.out",
        overwrite: "auto",
        onComplete: () => {
          if (toast.leaving) onExit(toast.id)
        },
      })
    },
    { dependencies: [toast.leaving], scope: element }
  )
  useGSAP(
    () => {
      if (
        toast.count < 2 ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return
      gsap.to(element.current, {
        keyframes: [{ x: -3 }, { x: 3 }, { x: -2 }, { x: 2 }, { x: 0 }],
        duration: 0.22,
        ease: "power1.out",
      })
    },
    { dependencies: [toast.count], scope: element }
  )
  const tone = toast.tone ?? "default"
  const style = toneStyles[tone]
  const StatusIcon = style.icon
  return (
    <div
      ref={element}
      role={tone === "error" ? "alert" : "status"}
      aria-atomic="true"
      inert={toast.leaving}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl bg-popover px-3 py-2 text-sm text-foreground shadow-[0_6px_20px_rgb(0_0_0/0.28)]"
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md",
          style.iconClassName
        )}
      >
        <StatusIcon className="size-3.5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 leading-snug [overflow-wrap:anywhere]">
        <span
          className={
            tone === "error" ? "block font-medium" : "block text-foreground/90"
          }
        >
          {toast.message}
        </span>
        {toast.description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {toast.description}
          </p>
        )}
      </div>
      {toast.count > 1 && (
        <span
          className="rounded-md bg-surface-raised px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums"
          aria-label={`Повторов: ${toast.count}`}
        >
          ×{toast.count}
        </span>
      )}
      {tone === "error" && onOpenDiagnostics && (
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => {
            dismiss(toast.id)
            onOpenDiagnostics()
          }}
        >
          Журнал
        </button>
      )}
      <button
        type="button"
        className="pointer-events-auto flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/65 transition-colors hover:bg-surface-raised hover:text-foreground"
        aria-label="Закрыть уведомление"
        onClick={() => dismiss(toast.id)}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context)
    throw new Error("useToast должен использоваться внутри ToastProvider")
  return context.show
}
