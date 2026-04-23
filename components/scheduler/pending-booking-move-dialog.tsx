"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type PendingBookingMoveDialogProps = {
  open: boolean
  pendingMove: {
    booking: { primaryLabel: string }
    dragKind: "instructor" | "aircraft"
    fromResourceLabel: string
    toResourceLabel: string
    startBefore: Date
    endBefore: Date
    startAfter: Date
    endAfter: Date
  } | null
  hasResourceChange: boolean
  hasTimeChange: boolean
  isApplyingMove: boolean
  timeZone: string
  onOpenChange: (open: boolean) => void
  onCancel: () => void
  onApprove: () => void
  formatDateTimeRange: (start: Date, end: Date, timeZone: string) => string
}

export function PendingBookingMoveDialog({
  open,
  pendingMove,
  hasResourceChange,
  hasTimeChange,
  isApplyingMove,
  timeZone,
  onOpenChange,
  onCancel,
  onApprove,
  formatDateTimeRange,
}: PendingBookingMoveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg gap-0 p-0"
        showCloseButton={!isApplyingMove}
        aria-busy={isApplyingMove}
        onPointerDownOutside={(e) => {
          if (isApplyingMove) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (isApplyingMove) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (isApplyingMove) e.preventDefault()
        }}
      >
        {isApplyingMove ? (
          <div
            className="pointer-events-none h-0.5 w-full shrink-0 overflow-hidden bg-muted/90"
            aria-hidden
          >
            <div
              className="h-full w-1/3 rounded-none bg-primary will-change-transform"
              style={{
                animation: "pending-booking-move-indeterminate 1.1s ease-in-out infinite",
              }}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-4 p-6">
          <DialogHeader>
            <DialogTitle>Confirm scheduler change</DialogTitle>
            <DialogDescription>
              {isApplyingMove ? (
                "Applying changes to the schedule. This may take a moment…"
              ) : (
                "Review the pending scheduler changes before applying them."
              )}
            </DialogDescription>
          </DialogHeader>

          {pendingMove ? (
          <div
            className={cn(
              "rounded-lg border border-border/60 bg-muted/20 p-3 transition-opacity",
              isApplyingMove && "pointer-events-none opacity-60"
            )}
          >
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Booking</span>
                <span className="min-w-0 truncate font-medium">{pendingMove.booking.primaryLabel}</span>
              </div>

              {hasResourceChange ? (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground capitalize">
                    {pendingMove.dragKind}
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/70 px-2.5 py-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="min-w-[42px] text-[11px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">
                          Old
                        </span>
                        <span className="min-w-0 truncate font-medium text-rose-600 line-through decoration-rose-500/80 dark:text-rose-300">
                          {pendingMove.fromResourceLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="min-w-[42px] text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                          New
                        </span>
                        <span className="min-w-0 truncate font-semibold text-emerald-700 dark:text-emerald-300">
                          {pendingMove.toResourceLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {hasTimeChange ? (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Time
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/70 px-2.5 py-2">
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="min-w-[42px] pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">
                          Old
                        </span>
                        <span className="font-medium text-rose-600 line-through decoration-rose-500/80 dark:text-rose-300">
                          {formatDateTimeRange(
                            pendingMove.startBefore,
                            pendingMove.endBefore,
                            timeZone
                          )}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="min-w-[42px] pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                          New
                        </span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                          {formatDateTimeRange(
                            pendingMove.startAfter,
                            pendingMove.endAfter,
                            timeZone
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          ) : null}

          <DialogFooter className="sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isApplyingMove}
              onClick={onCancel}
              className="cursor-pointer transition-colors disabled:cursor-not-allowed"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-w-[10.5rem] cursor-pointer bg-slate-900 font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed"
              disabled={isApplyingMove || !pendingMove}
              onClick={onApprove}
            >
              {isApplyingMove ? (
                <>
                  <Loader2
                    className="h-4 w-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                  Applying…
                </>
              ) : (
                "Approve changes"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
