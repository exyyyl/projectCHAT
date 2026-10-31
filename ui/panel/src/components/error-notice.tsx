import { CircleAlert, ArrowDownRight } from "lucide-react"
import { presentError } from "../../../../public/error-messages.js"
import { revealErrorJournal } from "@/domain/diagnostics"

export function ErrorNotice({
  error,
  context = "",
}: {
  error: unknown
  context?: string
}) {
  const notice = presentError(error, context)
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg bg-destructive/6 px-3.5 py-3"
    >
      <CircleAlert
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug font-medium text-foreground">
          {notice.title}
        </p>
        {notice.description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {notice.description}
          </p>
        )}
      </div>
      <button
        type="button"
        className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        onClick={revealErrorJournal}
      >
        Журнал
        <ArrowDownRight className="size-3" />
      </button>
    </div>
  )
}
