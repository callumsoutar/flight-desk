import Link from "next/link"
import { FileQuestion } from "lucide-react"

import { Button } from "@/components/ui/button"

export function RouteNotFoundState({
  heading = "Not found",
  message = "This page doesn\u2019t exist or you don\u2019t have access to it.",
  backHref,
  backLabel,
}: {
  heading?: string
  message?: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {backHref ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={backHref}>{backLabel ?? "Go back"}</Link>
        </Button>
      ) : null}
    </div>
  )
}
