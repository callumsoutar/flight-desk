"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

export function CancelBookingModal({
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string | null) => void
  pending: boolean
}) {
  const [reason, setReason] = React.useState("")

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Cancel booking</DrawerTitle>
          <DrawerDescription>
            This updates the booking status to cancelled.
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-3 px-4 pb-4">
          <textarea
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Cancellation reason (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={pending}
              onClick={() => onConfirm(reason.trim() || null)}
            >
              {pending ? "Cancelling..." : "Cancel Booking"}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1" disabled={pending}>
                Close
              </Button>
            </DrawerClose>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

