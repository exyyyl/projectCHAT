import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"

const messageWidths = ["w-3/5", "w-4/5", "w-2/5", "w-3/4", "w-1/2"]

export function ChatLoadingSkeleton() {
  return (
    <SkeletonGroup label="Загрузка чата" className="space-y-5 py-4">
      {messageWidths.map((width, index) => (
        <div key={index} className="flex min-w-0 items-start gap-3">
          <Skeleton className="mt-2 hidden h-2.5 w-10 shrink-0 sm:block" />
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <Skeleton className={`h-3 ${index % 2 ? "w-24" : "w-16"}`} />
            <Skeleton className={`h-3 ${width}`} />
            {index === 1 && <Skeleton className="h-3 w-1/3" />}
          </div>
        </div>
      ))}
    </SkeletonGroup>
  )
}

export function ProfileLoadingSkeleton() {
  return (
    <SkeletonGroup
      label="Загрузка профиля"
      className="min-h-0 space-y-6 overflow-y-auto overscroll-contain p-5"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-13 shrink-0 rounded-full" />
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-9 w-36 rounded-lg" />
      <div className="flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-5">
        {messageWidths.slice(0, 4).map((width, index) => (
          <div key={index} className="space-y-2.5">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className={`h-3 ${width}`} />
            {index === 1 && <Skeleton className="h-3 w-1/3" />}
          </div>
        ))}
      </div>
    </SkeletonGroup>
  )
}

export function JournalLoadingSkeleton() {
  return (
    <SkeletonGroup
      label="Загрузка журнала"
      className="grid min-h-0 flex-1 grid-rows-1 sm:grid-cols-[240px_minmax(0,1fr)]"
    >
      <div className="space-y-1 overflow-hidden px-3 pb-3">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="space-y-3 px-3 py-4">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className={`h-3 ${index % 2 ? "w-4/5" : "w-full"}`} />
            <Skeleton className="h-2.5 w-16" />
          </div>
        ))}
      </div>
      <div className="mr-3 mb-3 hidden min-w-0 space-y-6 rounded-xl bg-background p-5 sm:block">
        <div className="space-y-3">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="grid grid-cols-2 gap-5">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="mb-4 h-3 w-32" />
          {messageWidths.map((width, index) => (
            <Skeleton key={index} className={`h-2.5 ${width}`} />
          ))}
        </div>
      </div>
    </SkeletonGroup>
  )
}

export function EmoteLoadingSkeleton() {
  return (
    <SkeletonGroup
      label="Загрузка смайликов"
      className="grid grid-cols-6 gap-3 p-2"
    >
      {Array.from({ length: 24 }, (_, index) => (
        <Skeleton key={index} className="aspect-square w-full rounded-lg" />
      ))}
    </SkeletonGroup>
  )
}

export function ContestLoadingSkeleton() {
  return (
    <SkeletonGroup
      label="Загрузка конкурса"
      className="grid h-full min-h-0 gap-4 overflow-hidden p-4 lg:grid-cols-2"
    >
      <div className="flex min-h-0 flex-col gap-6 overflow-hidden p-5">
        <Skeleton className="h-3 w-20 shrink-0" />
        <Skeleton className="h-6 w-4/5 shrink-0" />
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
        <div className="mt-auto flex justify-between">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="hidden min-h-0 overflow-hidden rounded-xl bg-surface-subtle p-5 lg:block"
      >
        <ChatLoadingSkeleton />
      </div>
    </SkeletonGroup>
  )
}

export function AppLoadingSkeleton({
  sidebarVisible,
}: {
  sidebarVisible: boolean
}) {
  return (
    <SkeletonGroup
      label="Загрузка Cue"
      className="flex min-h-0 flex-1 gap-2 p-2 pt-0"
    >
      {sidebarVisible && (
        <div className="flex w-[204px] shrink-0 flex-col gap-6 px-3 pt-7">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-4 shrink-0" />
              <Skeleton className={`h-3 ${index % 2 ? "w-24" : "w-20"}`} />
            </div>
          ))}
          <div className="mt-auto mb-3 flex items-center gap-3">
            <Skeleton className="size-7 shrink-0 rounded-lg" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-panel p-5 sm:p-8">
        <Skeleton className="mb-8 h-6 w-20" />
        <div className="grid gap-6 sm:grid-cols-[200px_minmax(0,1fr)]">
          <div className="hidden space-y-4 sm:block">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="space-y-4 rounded-xl bg-surface-subtle p-4"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>
          <div className="min-w-0" aria-hidden="true">
            <ChatLoadingSkeleton />
          </div>
        </div>
        <Skeleton className="mt-auto h-11 w-full shrink-0 rounded-xl" />
      </div>
    </SkeletonGroup>
  )
}
