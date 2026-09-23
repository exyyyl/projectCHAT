import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

type SectionProps = ComponentPropsWithoutRef<"section">
type DivProps = ComponentPropsWithoutRef<"div">
type AsideProps = ComponentPropsWithoutRef<"aside">

export function PageScroll({ className, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        "h-full min-h-0 overflow-y-auto overscroll-contain",
        className
      )}
      {...props}
    />
  )
}

export function PageContainer({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl px-6 py-8 lg:px-8 lg:py-8",
        className
      )}
      {...props}
    />
  )
}

export function SplitWorkspace({ className, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        "grid h-full min-h-0 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(380px,.88fr)_minmax(440px,1.12fr)] lg:overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

export function WorkspacePane({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "min-w-0 px-6 py-8 lg:min-h-0 lg:overflow-y-auto lg:px-8",
        className
      )}
      {...props}
    />
  )
}

export function WorkspaceContent({ className, ...props }: DivProps) {
  return (
    <div className={cn("mx-auto w-full max-w-2xl", className)} {...props} />
  )
}

export function StudioWorkspace({ className, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        "grid h-full min-h-0 overflow-y-auto overscroll-contain xl:grid-cols-[minmax(0,1fr)_22rem] xl:overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

export function StudioStage({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col px-6 py-8 lg:px-8 xl:min-h-0",
        className
      )}
      {...props}
    />
  )
}

export function StudioRail({ className, ...props }: AsideProps) {
  return (
    <aside
      className={cn(
        "min-w-0 overflow-x-hidden bg-sidebar px-6 py-8 transition-colors xl:min-h-0 xl:overflow-y-auto",
        className
      )}
      {...props}
    />
  )
}

export function LibraryWorkspace({ className, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        "grid h-full min-h-0 grid-cols-[clamp(12.5rem,28%,17rem)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden data-[editing=true]:grid-cols-1",
        className
      )}
      {...props}
    />
  )
}

export function LibraryRail({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col bg-sidebar px-3 py-4 transition-colors",
        className
      )}
      {...props}
    />
  )
}

export function LibraryContent({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden",
        className
      )}
      {...props}
    />
  )
}
