"use client"

import * as React from "react"
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle,
  Eye,
  GripVertical,
  Plane,
  User,
  UserCircle,
  Users,
  Wrench,
  X,
} from "lucide-react"
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

  const STATUS_ACCENT: Record<BookingStatus, string> = {
    unconfirmed: "bg-slate-300",
    confirmed: "bg-emerald-500",
    briefing: "bg-amber-500",
    flying: "bg-indigo-500",
    complete: "bg-slate-400",
    cancelled: "bg-rose-500",
  }

  const STATUS_BADGE: Record<BookingStatus, string> = {
    unconfirmed: "border-slate-200 bg-slate-100 text-slate-700",
    confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    briefing: "border-amber-200 bg-amber-50 text-amber-800",
    flying: "border-indigo-200 bg-indigo-50 text-indigo-700",
    complete: "border-slate-200 bg-slate-100 text-slate-700",
    cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  }

  const durationLabel = React.useMemo(() => {
    const ms = itemEndAt.getTime() - itemStartAt.getTime()
    if (!Number.isFinite(ms) || ms <= 0) return null
    const totalMinutes = Math.round(ms / 60_000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours === 0) return `${minutes}m`
    if (minutes === 0) return `${hours}h`
    return `${hours}h ${minutes}m`
  }, [itemStartAt, itemEndAt])

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
              className="relative w-[260px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border/60 bg-background p-0 shadow-xl"
            >
              <div
                aria-hidden
                className={cn(
                  "absolute inset-x-0 top-0 h-1",
                  STATUS_ACCENT[booking.status] ?? "bg-slate-300"
                )}
              />
              
              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="truncate text-[14px] font-semibold text-foreground">
                      {booking.primaryLabel}
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <BookingTypeIcon className="h-3.5 w-3.5" />
                      <span className="truncate">{bookingTypeIndicator.label}</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                      STATUS_BADGE[booking.status] ?? "border-slate-200 bg-slate-100 text-slate-700"
                    )}
                  >
                    {booking.status}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-[15px] font-semibold tracking-tight text-foreground">
                    {range}
                  </span>
                  {durationLabel ? (
                    <span className="text-[12px] font-medium text-muted-foreground">
                      · {durationLabel}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2.5 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span>Instructor</span>
                    </div>
                    <span className="truncate font-medium text-foreground">
                      {booking.instructorLabel || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Plane className="h-3.5 w-3.5" />
                      <span>Aircraft</span>
                    </div>
                    <span className="truncate font-medium text-foreground">
                      {booking.aircraftLabel || "—"}
                    </span>
                  </div>
                </div>

                {booking.canOpen && (booking.purpose || booking.remarks) ? (
                  <div className="space-y-2.5 border-t border-border/60 pt-3 text-[12px]">
                    {booking.purpose ? (
                      <div className="space-y-1">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Description
                        </div>
                        <div className="line-clamp-2 leading-relaxed text-foreground/90">{booking.purpose}</div>
                      </div>
                    ) : null}
                    {booking.remarks ? (
                      <div className="space-y-1">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Remarks
                        </div>
                        <div className="line-clamp-2 leading-relaxed text-foreground/90">{booking.remarks}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between border-t border-border/60 bg-muted/50 px-4 py-2.5 text-[11px] text-muted-foreground">
                {booking.canOpen ? (
                  <>
                    <span className="flex items-center gap-1.5 font-medium text-foreground/70">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Click to open
                    </span>
                    {canDragThisBooking ? (
                      <span className="flex items-center gap-1.5">
                        <GripVertical className="h-3.5 w-3.5" />
                        Drag to move
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span>Busy slot</span>
                )}
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
