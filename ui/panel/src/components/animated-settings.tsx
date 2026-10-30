import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { gsap } from "gsap"

/** Keep controls mounted during closing; ordinary field edits never replay the
 * transition. Tray height is measured once per tab; the sample has its own stable origin. */
export function AnimatedSettings<K extends string>({
  active,
  children,
}: {
  active: K | null
  children: (key: K) => ReactNode
}) {
  const [last, setLast] = useState(active)
  if (active && active !== last) setLast(active)
  const shell = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const height = useRef(0)
  const animation = useRef<gsap.core.Tween | null>(null)
  useLayoutEffect(() => {
    const outer = shell.current,
      inner = content.current
    if (!outer || !inner) return
    const from = animation.current?.isActive()
      ? outer.getBoundingClientRect().height
      : height.current
    animation.current?.kill()
    gsap.killTweensOf(inner)
    const to = active ? inner.getBoundingClientRect().height : 0
    height.current = to
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    gsap.set(outer, { height: from, overflow: "hidden", visibility: "visible" })
    animation.current = gsap.to(outer, {
      height: to,
      duration: reduced ? 0 : 0.26,
      ease: "power2.inOut",
      onComplete: () =>
        gsap.set(outer, {
          height: active ? "auto" : 0,
          overflow: active ? "visible" : "hidden",
          visibility: active ? "visible" : "hidden",
        }),
    })
    gsap.fromTo(
      inner,
      { autoAlpha: active ? 0.55 : 1, y: active ? 4 : 0 },
      {
        autoAlpha: active ? 1 : 0,
        y: active ? 0 : 2,
        duration: reduced ? 0 : 0.18,
        ease: "power2.out",
      }
    )
  }, [active])
  useLayoutEffect(() => {
    const inner = content.current
    return () => {
      animation.current?.kill()
      if (inner) gsap.killTweensOf(inner)
    }
  }, [])
  return (
    <div
      ref={shell}
      className="animated-settings"
      aria-hidden={!active}
      inert={!active}
      style={{ height: 0, overflow: "hidden" }}
    >
      <div ref={content}>{last && children(last)}</div>
    </div>
  )
}
