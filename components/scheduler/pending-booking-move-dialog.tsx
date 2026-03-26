"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm booking move</DialogTitle>
          <DialogDescription>
            Review the pending scheduler changes before applying them.
          </DialogDescription>
        </DialogHeader>

        {pendingMove ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
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

        <DialogFooter>
          <Button variant="outline" disabled={isApplyingMove} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="bg-slate-900 font-semibold text-white hover:bg-slate-800"
            disabled={isApplyingMove || !pendingMove}
            onClick={onApprove}
          >
            {isApplyingMove ? "Applying..." : "Approve changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
