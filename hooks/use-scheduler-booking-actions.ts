"use client"

import * as React from "react"
import { toast } from "sonner"

import { patchBookingMutation } from "@/hooks/use-booking-query"
import type { BookingStatus } from "@/lib/types/bookings"

type SchedulerPendingMoveBase = {
  booking: { id: string }
  dragKind: "instructor" | "aircraft"
  fromResourceId: string
  toResourceId: string
  fromResourceLabel?: string
  toResourceLabel?: string
  startBefore: Date
  endBefore: Date
  startAfter: Date
  endAfter: Date
}

type BookingStatusUpdateArgs = {
  bookingId: string
  status: BookingStatus
  cancellationCategoryId?: string
  cancellationReason?: string | null
  cancelledNotes?: string | null
}

export function useSchedulerBookingActions<TPendingMove extends SchedulerPendingMoveBase>({
  pendingMove,
  onPendingMoveChange,
  onCancelBookingClosed,
  onChanged,
}: {
  pendingMove: TPendingMove | null
  onPendingMoveChange: React.Dispatch<React.SetStateAction<TPendingMove | null>>
  onCancelBookingClosed: () => void
  onChanged: () => void
}) {
  const [isApplyingMove, setIsApplyingMove] = React.useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false)

  const handleStatusUpdate = React.useCallback(
    async (variables: BookingStatusUpdateArgs) => {
      setIsUpdatingStatus(true)
      try {
        await patchBookingMutation(variables.bookingId, {
          status: variables.status,
          cancellation_category_id:
            variables.status === "cancelled" ? (variables.cancellationCategoryId ?? null) : undefined,
          cancellation_reason:
            variables.status === "cancelled" ? (variables.cancellationReason ?? null) : undefined,
          cancelled_notes: variables.status === "cancelled" ? (variables.cancelledNotes ?? null) : undefined,
        })
        onCancelBookingClosed()
        toast.success(
          variables.status === "confirmed"
            ? "Booking confirmed"
            : variables.status === "cancelled"
              ? "Booking cancelled"
              : "Booking updated"
        )
        onChanged()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update booking")
      } finally {
        setIsUpdatingStatus(false)
      }
    },
    [onCancelBookingClosed, onChanged]
  )

  const handleApplyPendingMove = React.useCallback(async () => {
    if (!pendingMove) return

    const resourceChanged = pendingMove.fromResourceId !== pendingMove.toResourceId
    const timeChanged =
      pendingMove.startBefore.getTime() !== pendingMove.startAfter.getTime() ||
      pendingMove.endBefore.getTime() !== pendingMove.endAfter.getTime()

    if (!resourceChanged && !timeChanged) {
      onPendingMoveChange(null)
      return
    }

    const body: {
      instructor_id?: string | null
      aircraft_id?: string | null
      start_time?: string
      end_time?: string
    } = {}

    if (resourceChanged) {
      if (pendingMove.dragKind === "instructor") {
        body.instructor_id = pendingMove.toResourceId
      } else {
        body.aircraft_id = pendingMove.toResourceId
      }
    }

    if (timeChanged) {
      body.start_time = pendingMove.startAfter.toISOString()
      body.end_time = pendingMove.endAfter.toISOString()
    }

    setIsApplyingMove(true)
    try {
      await patchBookingMutation(pendingMove.booking.id, body)
      onPendingMoveChange(null)
      toast.success("Booking moved")
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move booking")
    } finally {
      setIsApplyingMove(false)
    }
  }, [onChanged, onPendingMoveChange, pendingMove])

  return {
    isApplyingMove,
    isUpdatingStatus,
    handleStatusUpdate,
    handleApplyPendingMove,
  }
}
