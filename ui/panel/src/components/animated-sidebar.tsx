import { useRef, type ReactNode } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

gsap.registerPlugin(useGSAP)

export function AnimatedSidebar({
  collapsed,
  children,
}: {
  collapsed: boolean
  children: ReactNode
}) {
  const slot = useRef<HTMLDivElement>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const initialCollapsed = useRef(collapsed)

  useGSAP(
    () => {
      const element = slot.current!
      const body = element.parentElement!
      const sidebar = element.firstElementChild!
      timeline.current = gsap
        .timeline({ paused: true })
        .fromTo(
          element,
          { width: 220 },
          { width: 0, duration: 0.28, ease: "power2.inOut" },
          0
        )
        .fromTo(
          body,
          { paddingLeft: 0 },
          { paddingLeft: 8, duration: 0.28, ease: "power2.inOut" },
          0
        )
        .fromTo(
          sidebar,
          { x: 0, autoAlpha: 1 },
          { x: -12, autoAlpha: 0, duration: 0.2, ease: "power2.inOut" },
          0
        )
      timeline.current.progress(initialCollapsed.current ? 1 : 0).pause()

      const media = window.matchMedia("(prefers-reduced-motion: reduce)")
      const finish = () => {
        if (media.matches && timeline.current?.isActive()) {
          timeline.current.progress(timeline.current.reversed() ? 0 : 1).pause()
        }
      }
      media.addEventListener("change", finish)
      return () => media.removeEventListener("change", finish)
    },
    { scope: slot }
  )

  useGSAP(
    () => {
      const animation = timeline.current
      if (!animation) return
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        animation.progress(collapsed ? 1 : 0).pause()
      } else if (collapsed) {
        animation.play()
      } else {
        animation.reverse()
      }
    },
    { dependencies: [collapsed], scope: slot }
  )

  return (
    <div
      ref={slot}
      className="app-sidebar-slot"
      inert={collapsed}
      aria-hidden={collapsed}
    >
      {children}
    </div>
  )
}
