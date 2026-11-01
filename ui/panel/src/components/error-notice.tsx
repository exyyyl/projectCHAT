import { CircleAlert, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-center text-xs text-foreground/80"
        onClick={revealErrorJournal}
      >
        Подробнее
        <ArrowUpRight className="size-3.5" />
      </Button>
    </div>
  )
}
