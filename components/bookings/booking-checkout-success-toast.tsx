"use client"

import { Check, X } from "lucide-react"

import { Button } from "@/components/ui/button"

export function BookingCheckoutSuccessToast({
  onClose,
}: {
  onClose: () => void
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-[var(--radius)] border border-border bg-background shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500" aria-hidden="true" />

      <div className="flex items-start gap-3 px-4 py-3 pl-5">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
          <Check className="h-4.5 w-4.5" strokeWidth={3} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-5 text-foreground">
            Flight checked out
          </div>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
            The booking is now flying and ready for check-in.
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="h-7 w-7 shrink-0 rounded-full text-muted-foreground/70 hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </Button>
      </div>
    </div>
  )
}
