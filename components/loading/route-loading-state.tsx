import { Loader2 } from "lucide-react"

export function RouteLoadingState({
  message = "Loading...",
}: {
  message?: string
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-lg border bg-card/60 px-6 py-16 text-center">
      <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
