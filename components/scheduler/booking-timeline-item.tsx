"use client"

import * as React from "react"
import { CheckCircle, Clock, Eye, Plane, User, UserCircle, X } from "lucide-react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Separator } from "@/components/ui/separator"
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
  statusBadgeVariant,
  statusPillClasses,
  statusIndicatorClasses,
}: {
  booking: {
    id: string
    primaryLabel: string
    purpose: string
    remarks: string | null
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
      aircraftId: string
      userId: string | null
      status: BookingStatus
      bookingType: string | null
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
  statusBadgeVariant: (status: BookingStatus) => React.ComponentProps<typeof Badge>["variant"]
  statusPillClasses: (status: BookingStatus) => string
  statusIndicatorClasses: (status: BookingStatus) => string
}) {
  const router = useRouter()

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

        <ContextMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <ContextMenuTrigger asChild>
                <button
                  type="button"
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
                    "group h-full w-full rounded-md px-2 text-left shadow-sm ring-1 ring-black/5 transition-all hover:brightness-[1.02] hover:shadow-md focus:ring-2 focus:ring-blue-500/40 focus:outline-none",
                    booking.bookingType === "maintenance" ? "bg-slate-300 text-slate-700" : statusPillClasses(booking.status),
                    canDragThisBooking ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                    isPreview
                      ? previewValid
                        ? "cursor-grabbing ring-2 ring-emerald-300/80 shadow-lg"
                        : "cursor-not-allowed opacity-70 ring-2 ring-destructive/70"
                      : ""
                  )}
                >
                  <div className="flex h-full flex-col justify-center">
                    <div className="truncate text-xs font-semibold leading-tight">{booking.primaryLabel}</div>
                    {isPreview && previewTimeLabel ? (
                      <div className="mt-0.5 truncate text-[10px] font-medium leading-tight opacity-90">
                        {previewTimeLabel}
                      </div>
                    ) : null}
                  </div>
                </button>
              </ContextMenuTrigger>
            </TooltipTrigger>
            <TooltipContent variant="card" side="top" sideOffset={8} className="max-w-[360px]">
              <div className="relative">
                <div
                  className={cn(
                    "absolute left-0 top-0 h-full w-1.5",
                    booking.bookingType === "maintenance" ? "bg-slate-400" : statusIndicatorClasses(booking.status)
                  )}
                  aria-hidden="true"
                />
                <div className="space-y-2 p-3 pl-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold leading-tight">{booking.primaryLabel}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground/90">{range}</span>
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant(booking.status)} className="capitalize">
                      {booking.status}
                    </Badge>
                  </div>

                  <Separator className="bg-border/60" />

                  <div className="grid gap-1.5 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span>Instructor</span>
                      </div>
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {booking.instructorLabel ?? "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plane className="h-3.5 w-3.5" />
                        <span>Aircraft</span>
                      </div>
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {booking.aircraftLabel ?? "-"}
                      </span>
                    </div>
                  </div>

                  {booking.canOpen ? (
                    <>
                      <Separator className="bg-border/60" />
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold text-muted-foreground">Description</div>
                          <div className="text-xs leading-snug text-foreground/90 break-words line-clamp-4">
                            {booking.purpose}
                          </div>
                        </div>
                        {booking.remarks ? (
                          <div className="space-y-1">
                            <div className="text-[11px] font-semibold text-muted-foreground">Remarks</div>
                            <div className="text-xs leading-snug text-foreground/80 break-words line-clamp-3">
                              {booking.remarks}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : null}

                  <div className="pt-0.5 text-[11px] text-muted-foreground">
                    {booking.canOpen
                      ? canDragThisBooking
                        ? "Click to open, or drag to move"
                        : "Click to open booking"
                      : "Busy slot"}
                  </div>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          <ContextMenuContent>
            <ContextMenuItem onClick={() => router.push(`/aircraft/${booking.aircraftId}`)}>
              <Eye className="h-4 w-4" />
              View Aircraft
            </ContextMenuItem>
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
      </div>
    </div>
  )
}
