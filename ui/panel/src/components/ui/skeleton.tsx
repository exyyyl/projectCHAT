import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={cn("skeleton block rounded-md", className)}
    />
  )
}

export function SkeletonGroup({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
