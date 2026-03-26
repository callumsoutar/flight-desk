"use client"

import * as React from "react"

import { BookingTimelineItem } from "@/components/scheduler/booking-timeline-item"
import { ResourceTimelineRowSurface } from "@/components/scheduler/resource-timeline-row-surface"
import { getBookingLayout } from "@/lib/scheduler/timeline"
import type { BookingStatus } from "@/lib/types/bookings"

type TimelineRowResource =
  | {
      kind: "instructor"
      data: {
        id: string
      }
    }
  | {
      kind: "aircraft"
      data: {
        id: string
      }
    }

type TimelineRowBooking = {
  id: string
  startsAt: Date
  endsAt: Date
  primaryLabel: string
  purpose: string
  remarks: string | null
  instructorId: string | null
  aircraftId: string
  aircraftLabel?: string
  instructorLabel?: string
  userId: string | null
  status: BookingStatus
  bookingType: string | null
  canOpen: boolean
  canCancel: boolean
  canViewContact: boolean
  canConfirm: boolean
}

type TimelineRowDragPreview = {
  booking: TimelineRowBooking
  dragKind: TimelineRowResource["kind"]
  sourceResourceId: string
  targetResourceId: string
  startAt: Date
  endAt: Date
  valid: boolean
}

type TimelineRowBookingPointerDownPayload = {
  booking: TimelineRowBooking
  sourceResource: TimelineRowResource
  pointerId: number
  clientX: number
  clientY: number
  button: number
  pointerOffsetSlots: number
  durationSlots: number
}

export function ResourceTimelineRow({
  rowResource,
  height,
  slotCount,
  slots,
  timelineStart,
  timelineEnd,
  bookings,
  dragPreview,
  dragInProgress,
  resourceTitle,
  isSlotAvailable,
  onEmptyClick,
  onBookingPointerDown,
  canDragBookings,
  onBookingClick,
  onViewContactDetails,
  onStatusUpdate,
  onCancelBooking,
  timeZone,
  formatTimeRangeLabel,
  formatTimeRangeLabel12h,
  statusBadgeVariant,
  statusPillClasses,
  statusIndicatorClasses,
  formatTimeLabel12h,
  getMinutesInTimeZone,
}: {
  rowResource: TimelineRowResource
  height: number
  slotCount: number
  slots: Date[]
  timelineStart: Date
  timelineEnd: Date
  bookings: TimelineRowBooking[]
  dragPreview: TimelineRowDragPreview | null
  dragInProgress: boolean
  resourceTitle?: string
  isSlotAvailable?: (slot: Date) => boolean
  onEmptyClick: (clientX: number, container: HTMLDivElement) => void
  onBookingPointerDown: (payload: TimelineRowBookingPointerDownPayload) => void
  canDragBookings: boolean
  onBookingClick: (booking: TimelineRowBooking) => void
  onViewContactDetails?: (memberId: string) => void
  onStatusUpdate: (variables: {
    bookingId: string
    status: BookingStatus
    cancellationCategoryId?: string
    cancellationReason?: string | null
    cancelledNotes?: string | null
  }) => void
  onCancelBooking: (booking: TimelineRowBooking) => void
  timeZone: string
  formatTimeRangeLabel: (start: Date, end: Date, timeZone: string) => string
  formatTimeRangeLabel12h: (start: Date, end: Date, timeZone: string) => string
  statusBadgeVariant: (
    status: BookingStatus
  ) => "link" | "default" | "destructive" | "outline" | "secondary" | "ghost" | null | undefined
  statusPillClasses: (status: BookingStatus) => string
  statusIndicatorClasses: (status: BookingStatus) => string
  formatTimeLabel12h: (value: Date, timeZone: string) => string
  getMinutesInTimeZone: (value: Date, timeZone: string) => number
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [hoveredSlotIdx, setHoveredSlotIdx] = React.useState<number | null>(null)
  const activeDragPreview =
    dragPreview && dragPreview.dragKind === rowResource.kind ? dragPreview : null
  const renderedBookings = React.useMemo(() => {
    const base = bookings
      .filter((booking) => !(activeDragPreview && booking.id === activeDragPreview.booking.id))
      .map((booking) => ({
        booking,
        startAt: booking.startsAt,
        endAt: booking.endsAt,
        isPreview: false,
        previewValid: true,
      }))

    if (activeDragPreview && rowResource.data.id === activeDragPreview.targetResourceId) {
      base.push({
        booking: activeDragPreview.booking,
        startAt: activeDragPreview.startAt,
        endAt: activeDragPreview.endAt,
        isPreview: true,
        previewValid: activeDragPreview.valid,
      })
    }

    base.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    return base
  }, [activeDragPreview, bookings, rowResource.data.id])

  return (
    <div
      className="relative"
      style={{ height }}
      data-scheduler-row="true"
      data-resource-kind={rowResource.kind}
      data-resource-id={rowResource.data.id}
    >
      <ResourceTimelineRowSurface
        containerRef={containerRef}
        slotCount={slotCount}
        slots={slots}
        timeZone={timeZone}
        dragInProgress={dragInProgress}
        isActiveDragTarget={Boolean(activeDragPreview && rowResource.data.id === activeDragPreview.targetResourceId)}
        activeDragPreviewValid={activeDragPreview?.valid ?? false}
        resourceTitle={resourceTitle}
        isSlotAvailable={isSlotAvailable}
        onEmptyClick={onEmptyClick}
        hoveredSlotIdx={hoveredSlotIdx}
        onHoveredSlotIdxChange={setHoveredSlotIdx}
        formatTimeLabel12h={formatTimeLabel12h}
        getMinutesInTimeZone={getMinutesInTimeZone}
      />

      <div className="pointer-events-none absolute inset-0">
        {renderedBookings.map((item) => {
          const booking = item.booking
          const layout = getBookingLayout({
            bookingStart: item.startAt,
            bookingEnd: item.endAt,
            timelineStart,
            timelineEnd,
          })
          if (!layout) return null

          const canDragThisBooking = canDragBookings && booking.status !== "complete"
          const range = formatTimeRangeLabel(item.startAt, item.endAt, timeZone)
          const previewTimeLabel = item.isPreview
            ? formatTimeRangeLabel12h(item.startAt, item.endAt, timeZone)
            : null

          return (
            <BookingTimelineItem
              key={booking.id}
              booking={booking}
              layout={layout}
              isPreview={item.isPreview}
              previewValid={item.previewValid}
              previewTimeLabel={previewTimeLabel}
              range={range}
              canDragThisBooking={canDragThisBooking}
              slotCount={slotCount}
              rowResource={rowResource}
              containerRef={containerRef}
              itemStartAt={item.startAt}
              itemEndAt={item.endAt}
              onBookingPointerDown={onBookingPointerDown}
              onBookingClick={() => onBookingClick(booking)}
              onViewContactDetails={onViewContactDetails}
              onStatusUpdate={onStatusUpdate}
              onCancelBooking={() => onCancelBooking(booking)}
              statusBadgeVariant={statusBadgeVariant}
              statusPillClasses={statusPillClasses}
              statusIndicatorClasses={statusIndicatorClasses}
            />
          )
        })}
      </div>
    </div>
  )
}
