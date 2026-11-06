import { useLayoutEffect, useRef, type ReactNode } from "react"
import { gsap } from "gsap"

/** Fade the existing pane without remounting its content. */
export function SectionTransition({
  transitionKey,
  active = true,
  variant = "page",
  className,
  children,
}: {
  transitionKey: string
  active?: boolean
  variant?: "page" | "settings"
  className?: string
  children: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  const previous = useRef(transitionKey)

  useLayoutEffect(() => {
    const changed = previous.current !== transitionKey
    previous.current = transitionKey
    const node = root.current
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (!node || !changed || !active || media.matches) return

    const context = gsap.context(() => {
      gsap.fromTo(
        node,
        { opacity: 0 },
        {
          opacity: 1,
          duration: variant === "page" ? 0.3 : 0.26,
          ease: "power1.out",
          clearProps: "opacity",
        }
      )
    }, node)
    const reduce = () => {
      if (media.matches) context.revert()
    }
    media.addEventListener("change", reduce)
    return () => {
      media.removeEventListener("change", reduce)
      context.revert()
    }
  }, [transitionKey, active, variant])

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  )
}
