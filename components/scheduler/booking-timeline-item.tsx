"use client"

import * as React from "react"
import { BookOpen, CheckCircle, Clock, Eye, Plane, User, UserCircle, Users, Wrench, X } from "lucide-react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { BookingStatus } from "@/lib/types/bookings"
import { cn } from "@/lib/utils"

export function BookingTimelineItem({
  booking,
  layout,
  isPreview,
  previewValid,
  previewTimeLabel,
  range,
  canDragThisBooking,
  slotCount,
  rowResource,
  containerRef,
  itemStartAt,
  itemEndAt,
  onBookingPointerDown,
  onBookingClick,
  onViewContactDetails,
  onStatusUpdate,
  onCancelBooking,
  canViewAircraftProfile,
  statusBadgeVariant,
  statusPillClasses,
}: {
  booking: {
    id: string
    primaryLabel: string
    purpose: string
    remarks: string | null
    aircraftId: string | null
    aircraftLabel?: string
    instructorLabel?: string
    userId: string | null
    status: BookingStatus
    bookingType: string | null
    instructionType: string | null
    canOpen: boolean
    canCancel: boolean
    canViewContact: boolean
    canConfirm: boolean
  }
  layout: { leftPct: number; widthPct: number }
  isPreview: boolean
  previewValid: boolean
  previewTimeLabel: string | null
  range: string
  canDragThisBooking: boolean
  slotCount: number
  rowResource: { kind: "instructor" | "aircraft"; data: { id: string } }
  containerRef: React.RefObject<HTMLDivElement | null>
  itemStartAt: Date
  itemEndAt: Date
  onBookingPointerDown: (payload: {
    booking: {
      id: string
      startsAt: Date
      endsAt: Date
      primaryLabel: string
      purpose: string
      remarks: string | null
      instructorId: string | null
      aircraftId: string | null
      userId: string | null
      status: BookingStatus
      bookingType: string | null
      instructionType: string | null
      aircraftLabel?: string
      instructorLabel?: string
      canOpen: boolean
      canCancel: boolean
      canViewContact: boolean
      canConfirm: boolean
    }
    sourceResource: { kind: "instructor" | "aircraft"; data: { id: string } }
    pointerId: number
    clientX: number
    clientY: number
    button: number
    pointerOffsetSlots: number
    durationSlots: number
  }) => void
  onBookingClick: () => void
  onViewContactDetails?: (memberId: string) => void
  onStatusUpdate: (variables: { bookingId: string; status: BookingStatus }) => void
  onCancelBooking: () => void
  canViewAircraftProfile: boolean
  statusBadgeVariant: (status: BookingStatus) => React.ComponentProps<typeof Badge>["variant"]
  statusPillClasses: (status: BookingStatus) => string
}) {
  const router = useRouter()
  const interactive = booking.canOpen || canDragThisBooking

  const canViewAircraft = canViewAircraftProfile && Boolean(booking.aircraftId)

  const hasContextMenuItems =
    canViewAircraft ||
    (Boolean(booking.userId) && booking.canViewContact) ||
    booking.canCancel ||
    booking.canConfirm

  const bookingTypeIndicator = (() => {
    if (booking.bookingType === "maintenance") {
      return { icon: Wrench, label: "Maintenance booking" }
    }
    if (booking.bookingType === "groundwork") {
      return { icon: BookOpen, label: "Groundwork booking" }
    }
    if (booking.instructionType === "solo") {
      return { icon: User, label: "Solo flight" }
    }
    if (booking.instructionType === "dual" || booking.instructionType === "trial") {
      return { icon: Users, label: "Dual flight" }
    }
    return { icon: Plane, label: "Flight booking" }
  })()

  const BookingTypeIcon = bookingTypeIndicator.icon

  return (
    <div
      className="pointer-events-auto absolute inset-y-0"
      style={{
        left: `${layout.leftPct}%`,
        width: `max(${layout.widthPct}%, 2%)`,
      }}
    >
      <div className="relative h-full">
        {isPreview && previewTimeLabel ? (
          <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[105%]">
            <div
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-semibold whitespace-nowrap shadow-md ring-1 backdrop-blur",
                previewValid ? "bg-slate-900/90 text-white ring-white/20" : "bg-destructive/90 text-white ring-white/20"
              )}
            >
              {previewValid ? "New time " : "Unavailable "}
              {previewTimeLabel}
            </div>
          </div>
        ) : null}

        {(() => {
          const slotButton = (
            <button
              type="button"
              tabIndex={interactive ? 0 : -1}
              onPointerDown={(event) => {
                if (!canDragThisBooking || event.button !== 0) return
                if (!containerRef.current) return

                const rect = containerRef.current.getBoundingClientRect()
                if (!rect.width || slotCount <= 0) return

                const slotWidth = rect.width / slotCount
                const bookingStartPx = (layout.leftPct / 100) * rect.width
                const rawOffsetSlots = Math.floor(
                  (event.clientX - rect.left - bookingStartPx) / Math.max(1, slotWidth)
                )
                const durationMs = itemEndAt.getTime() - itemStartAt.getTime()
                const durationSlots = Math.max(1, Math.ceil(durationMs / (30 * 60_000)))
                const pointerOffsetSlots = Math.max(0, Math.min(rawOffsetSlots, Math.max(0, durationSlots - 1)))

                onBookingPointerDown({
                  booking: {
                    ...booking,
                    startsAt: itemStartAt,
                    endsAt: itemEndAt,
                    instructorId: rowResource.kind === "instructor" ? rowResource.data.id : null,
                  },
                  sourceResource: rowResource,
                  pointerId: event.pointerId,
                  clientX: event.clientX,
                  clientY: event.clientY,
                  button: event.button,
                  pointerOffsetSlots,
                  durationSlots,
                })
              }}
              onClick={(event) => {
                event.stopPropagation()
                onBookingClick()
              }}
              className={cn(
                "group relative h-full w-full overflow-hidden rounded-md border px-2.5 py-1.5 text-left shadow-sm transition-all",
                interactive ? "focus:ring-2 focus:ring-sky-500/35 focus:outline-none" : "focus:outline-none",
                booking.canOpen || canDragThisBooking ? "hover:shadow-md" : "hover:shadow-sm",
                booking.bookingType === "maintenance"
                  ? "border-slate-300 bg-slate-100"
                  : statusPillClasses(booking.status),
                canDragThisBooking
                  ? "cursor-grab active:cursor-grabbing"
                  : booking.canOpen
                    ? "cursor-pointer"
                    : "cursor-default",
                isPreview
                  ? previewValid
                    ? "cursor-grabbing border-emerald-300 ring-2 ring-emerald-300/70 shadow-lg"
                    : "cursor-not-allowed border-destructive/70 opacity-70 ring-2 ring-destructive/60"
                  : ""
              )}
            >
              <span
                className="pointer-events-none absolute right-1.5 top-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-sm bg-white text-slate-600 shadow-sm ring-1 ring-black/5"
                aria-label={bookingTypeIndicator.label}
                title={bookingTypeIndicator.label}
              >
                <BookingTypeIcon className="h-2.5 w-2.5" />
              </span>
              <div className="flex h-full min-w-0 flex-col justify-center">
                <div className="truncate pr-5 text-[11px] font-semibold leading-[1.15] text-slate-900 sm:text-xs">
                  {booking.primaryLabel}
                </div>
                <div className="mt-0.5 truncate pr-5 text-[10px] font-medium leading-[1.1] text-slate-600">
                  {isPreview && previewTimeLabel ? previewTimeLabel : range}
                </div>
              </div>
            </button>
          )

          if (!interactive) {
            return slotButton
          }

          const tooltipContent = (
            <TooltipContent
              variant="card"
              side="top"
              sideOffset={8}
              className="max-w-[360px] rounded-md border border-border/70 bg-background p-0 shadow-lg"
            >
              <div className="space-y-3 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-border/70 bg-white text-slate-600",
                          booking.bookingType === "maintenance" ? "text-slate-500" : ""
                        )}
                        aria-label={bookingTypeIndicator.label}
                        title={bookingTypeIndicator.label}
                      >
                        <BookingTypeIcon className="h-3 w-3" />
                      </span>
                      <div className="truncate text-sm font-semibold leading-tight text-foreground">
                        {booking.primaryLabel}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="font-medium">{range}</span>
                    </div>
                  </div>
                  <Badge
                    variant={statusBadgeVariant(booking.status)}
                    className="rounded-sm border-border/70 px-2 py-0.5 capitalize shadow-none"
                  >
                    {booking.status}
                  </Badge>
                </div>

                <div className="grid gap-2 rounded-sm border border-border/70 bg-slate-50/70 p-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <User className="h-3.5 w-3.5" />
                      <span>Instructor</span>
                    </div>
                    <span className="min-w-0 truncate font-medium text-slate-900">
                      {booking.instructorLabel ?? "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Plane className="h-3.5 w-3.5" />
                      <span>Aircraft</span>
                    </div>
                    <span className="min-w-0 truncate font-medium text-slate-900">
                      {booking.aircraftLabel ?? "-"}
                    </span>
                  </div>
                </div>

                {booking.canOpen ? (
                  <div className="space-y-2 border-t border-border/70 pt-3">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Description
                      </div>
                      <div className="text-xs leading-relaxed text-slate-700 break-words line-clamp-4">
                        {booking.purpose}
                      </div>
                    </div>
                    {booking.remarks ? (
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Remarks
                        </div>
                        <div className="text-xs leading-relaxed text-slate-600 break-words line-clamp-3">
                          {booking.remarks}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="border-t border-border/70 pt-2 text-[11px] text-slate-500">
                  {booking.canOpen
                    ? canDragThisBooking
                      ? "Click to open or drag to move"
                      : "Click to open booking"
                    : "Busy slot"}
                </div>
              </div>
            </TooltipContent>
          )

          const triggerWithContext = hasContextMenuItems ? (
            <ContextMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ContextMenuTrigger asChild>{slotButton}</ContextMenuTrigger>
                </TooltipTrigger>
                {tooltipContent}
              </Tooltip>

              <ContextMenuContent>
                {canViewAircraft ? (
                  <ContextMenuItem
                    onClick={() => {
                      if (!booking.aircraftId) return
                      router.push(`/aircraft/${booking.aircraftId}`)
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    View Aircraft
                  </ContextMenuItem>
                ) : null}
                {booking.userId && booking.canViewContact ? (
                  <ContextMenuItem
                    onClick={() => {
                      const memberId = booking.userId
                      if (!memberId) return
                      if (onViewContactDetails) {
                        onViewContactDetails(memberId)
                        return
                      }
                      router.push(`/members/${memberId}`)
                    }}
                  >
                    <UserCircle className="h-4 w-4" />
                    View Contact Details
                  </ContextMenuItem>
                ) : null}
                {booking.canCancel || booking.canConfirm ? (
                  <>
                    <ContextMenuSeparator />
                    {booking.canCancel ? (
                      <ContextMenuItem onClick={onCancelBooking} variant="destructive">
                        <X className="h-4 w-4" />
                        Cancel Booking
                      </ContextMenuItem>
                    ) : null}
                    {booking.canConfirm ? (
                      <ContextMenuItem
                        onClick={() => onStatusUpdate({ bookingId: booking.id, status: "confirmed" })}
                        className="text-green-600 focus:text-green-600 [&_svg]:text-green-600"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Confirm Booking
                      </ContextMenuItem>
                    ) : null}
                  </>
                ) : null}
              </ContextMenuContent>
            </ContextMenu>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>{slotButton}</TooltipTrigger>
              {tooltipContent}
            </Tooltip>
          )

          return triggerWithContext
        })()}
      </div>
    </div>
  )
}
