import { useRef, type ReactNode } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

export function HoverSidebar({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!panel.current) return
    gsap.to(panel.current, {
      x: open ? 0 : -232,
      autoAlpha: open ? 1 : 0,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.24,
      ease: "power2.out",
      overwrite: "auto",
    })
  }, { dependencies: [open], scope: panel })

  return <div ref={panel} className="app-sidebar-hover" onMouseLeave={onClose} inert={!open} aria-hidden={!open} style={{ pointerEvents: open ? "auto" : "none" }}>{children}</div>
}
