"use client"

import * as React from "react"
import {
  AlertTriangle,
  Loader2,
} from "lucide-react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useIsMobile } from "@/hooks/use-mobile"
import { useSchedulerBookingActions } from "@/hooks/use-scheduler-booking-actions"
import { schedulerPageQueryKey, useSchedulerPageQuery } from "@/hooks/use-scheduler-page-query"
import { ResourceTimelineGrid } from "@/components/scheduler/resource-timeline-grid"
import { PendingBookingMoveDialog } from "@/components/scheduler/pending-booking-move-dialog"
import { ResourceTimelineSection } from "@/components/scheduler/resource-timeline-section"
import { ResourceTimelineSidebar } from "@/components/scheduler/resource-timeline-sidebar"
import { ResourceTimelineToolbar } from "@/components/scheduler/resource-timeline-toolbar"
import { ResourceTimelineRow } from "@/components/scheduler/resource-timeline-row"
import { cn } from "@/lib/utils"
import { getBookingOpenPath } from "@/lib/bookings/navigation"
import {
  addDaysYyyyMmDd,
  dayOfWeekFromYyyyMmDd,
  getZonedYyyyMmDdAndHHmm,
  zonedDateTimeToUtc,
  zonedTodayYyyyMmDd,
} from "@/lib/utils/timezone"
import { useAuth } from "@/contexts/auth-context"
import type { CancelBookingPayload } from "@/components/bookings/cancel-booking-modal"
import type { SchedulerBookingDraft } from "@/components/scheduler/new-booking-modal"

const CancelBookingModal = dynamic(
  () => import("@/components/bookings/cancel-booking-modal").then((mod) => mod.CancelBookingModal),
  { ssr: false }
)
const ContactDetailsModal = dynamic(
  () => import("@/components/members/contact-details-modal").then((mod) => mod.ContactDetailsModal),
  { ssr: false }
)
const NewBookingModal = dynamic(
  () => import("@/components/scheduler/new-booking-modal").then((mod) => mod.NewBookingModal),
  { ssr: false }
)
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type { BookingWarningItem, BookingWarningSeverity } from "@/lib/types/booking-warnings"
import type { BookingStatus, BookingWithRelations } from "@/lib/types/bookings"
import type {
  SchedulerAircraftWarningSummary,
  SchedulerBusinessHours,
  SchedulerInstructor,
  SchedulerPageData,
} from "@/lib/types/scheduler"

type AircraftResource = {
  id: string
  registration: string
  type: string
  warningSummary: SchedulerAircraftWarningSummary | null
}

type InstructorResource = {
  id: string
  name: string
  endorsements: string[]
  displayName: string
}

type Resource =
  | { kind: "instructor"; data: InstructorResource }
  | { kind: "aircraft"; data: AircraftResource }

type SchedulerDragResource =
  | { kind: "instructor"; data: { id: string } }
  | { kind: "aircraft"; data: { id: string } }

type SchedulerBooking = {
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

type SchedulerBookingPointerDownPayload = {
  booking: SchedulerBooking
  sourceResource: SchedulerDragResource
  pointerId: number
  clientX: number
  clientY: number
  button: number
  pointerOffsetSlots: number
  durationSlots: number
}

type SchedulerBookingDragCandidate = {
  booking: SchedulerBooking
  sourceResource: SchedulerDragResource
  pointerId: number
  startClientX: number
  startClientY: number
  pointerOffsetSlots: number
  durationSlots: number
}

type SchedulerBookingDragPreview = {
  booking: SchedulerBooking
  dragKind: Resource["kind"]
  sourceResourceId: string
  targetResourceId: string
  startAt: Date
  endAt: Date
  valid: boolean
}

type PendingSchedulerBookingMove = {
  booking: SchedulerBooking
  dragKind: Resource["kind"]
  fromResourceId: string
  toResourceId: string
  fromResourceLabel: string
  toResourceLabel: string
  startBefore: Date
  endBefore: Date
  startAfter: Date
  endAfter: Date
}

type MinutesWindow = { startMin: number; endMin: number }
type TimelineConfig = { startMin: number; endMin: number; intervalMinutes: number }

const INTERVAL_MINUTES = 30
const ROW_HEIGHT = 42
const GROUP_HEIGHT = 32
const timeFormatterCache = new Map<string, Intl.DateTimeFormat>()
const time12FormatterCache = new Map<string, Intl.DateTimeFormat>()
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const WEEKDAY_FULL_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const MONTH_FULL_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function getTimeFormatter(timeZone: string) {
  const key = `${timeZone}:24h`
  const existing = timeFormatterCache.get(key)
  if (existing) return existing

  const formatter = new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  timeFormatterCache.set(key, formatter)
  return formatter
}

function getTime12Formatter(timeZone: string) {
  const key = `${timeZone}:12h`
  const existing = time12FormatterCache.get(key)
  if (existing) return existing

  const formatter = new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  time12FormatterCache.set(key, formatter)
  return formatter
}

function formatTimeLabel(d: Date, timeZone: string) {
  return getTimeFormatter(timeZone).format(d)
}

function formatTimeRangeLabel(start: Date, end: Date, timeZone: string) {
  return `${formatTimeLabel(start, timeZone)}-${formatTimeLabel(end, timeZone)}`
}

function formatOrdinalDay(day: number) {
  const mod10 = day % 10
  const mod100 = day % 100
  if (mod10 === 1 && mod100 !== 11) return `${day}st`
  if (mod10 === 2 && mod100 !== 12) return `${day}nd`
  if (mod10 === 3 && mod100 !== 13) return `${day}rd`
  return `${day}th`
}

function formatTimeLabel12hCompact(d: Date, timeZone: string) {
  return formatTimeLabel12h(d, timeZone).replace(/\s/g, "")
}

function formatFriendlyDateLabel(date: Date, timeZone: string) {
  const { yyyyMmDd } = getZonedYyyyMmDdAndHHmm(date, timeZone)
  const parsed = parseDateKeyParts(yyyyMmDd)
  if (!parsed) return yyyyMmDd

  const weekday = WEEKDAY_FULL_LABELS[dayOfWeekFromYyyyMmDd(yyyyMmDd)] ?? ""
  const month = MONTH_FULL_LABELS[parsed.month - 1] ?? ""
  return `${weekday} ${formatOrdinalDay(parsed.day)} ${month}`
}

function formatFriendlyDateTimeRangeLabel(start: Date, end: Date, timeZone: string) {
  const startDate = getZonedYyyyMmDdAndHHmm(start, timeZone).yyyyMmDd
  const endDate = getZonedYyyyMmDdAndHHmm(end, timeZone).yyyyMmDd
  const sameDay = startDate === endDate

  if (sameDay) {
    return `${formatFriendlyDateLabel(start, timeZone)} ${formatTimeLabel12hCompact(start, timeZone)} - ${formatTimeLabel12hCompact(end, timeZone)}`
  }

  return `${formatFriendlyDateLabel(start, timeZone)} ${formatTimeLabel12hCompact(start, timeZone)} - ${formatFriendlyDateLabel(end, timeZone)} ${formatTimeLabel12hCompact(end, timeZone)}`
}

function formatTimeRangeLabel12h(start: Date, end: Date, timeZone: string) {
  return `${formatTimeLabel12h(start, timeZone)} - ${formatTimeLabel12h(end, timeZone)}`
}

function formatTimeLabel12h(d: Date, timeZone: string) {
  return getTime12Formatter(timeZone).format(d).toLowerCase()
}

function parseDateKeyParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

function dateKeyToCalendarDate(dateKey: string) {
  const parsed = parseDateKeyParts(dateKey)
  if (!parsed) return undefined
  return new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0)
}

function formatDateKeyLabel(dateKey: string) {
  const parsed = parseDateKeyParts(dateKey)
  if (!parsed) return dateKey
  const weekday = WEEKDAY_LABELS[dayOfWeekFromYyyyMmDd(dateKey)] ?? ""
  const month = MONTH_LABELS[parsed.month - 1] ?? ""
  return `${weekday}, ${String(parsed.day).padStart(2, "0")} ${month}`
}

function isMinuteWithinWindow(mins: number, window: MinutesWindow) {
  return mins >= window.startMin && mins < window.endMin
}

function isMinutesWithinAnyWindow(mins: number, windows: MinutesWindow[]) {
  return windows.some((window) => isMinuteWithinWindow(mins, window))
}

function parseTimeToMinutes(value: string) {
  const [hh, mm] = value.split(":")
  const h = Number(hh)
  const m = Number(mm)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null
  if (h < 0 || h > 24 || m < 0 || m > 59) return null
  if (h === 24 && m !== 0) return null
  return h * 60 + m
}

function minutesToTimeHHmm(mins: number) {
  const hours = Math.floor(mins / 60)
  const minutes = mins % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function buildTimelineConfig(businessHours: SchedulerBusinessHours): TimelineConfig {
  if (businessHours.isClosed || businessHours.is24Hours) {
    return { startMin: 0, endMin: 24 * 60, intervalMinutes: INTERVAL_MINUTES }
  }

  const openMin = parseTimeToMinutes(businessHours.openTime)
  const closeMin = parseTimeToMinutes(businessHours.closeTime)
  if (openMin === null || closeMin === null) {
    return { startMin: 7 * 60, endMin: 19 * 60, intervalMinutes: INTERVAL_MINUTES }
  }

  // If settings imply overnight/same-hour range, show full-day to avoid an invalid empty grid.
  if (closeMin <= openMin) {
    return { startMin: 0, endMin: 24 * 60, intervalMinutes: INTERVAL_MINUTES }
  }

  return {
    startMin: openMin,
    endMin: closeMin,
    intervalMinutes: INTERVAL_MINUTES,
  }
}

function getMinutesInTimeZone(date: Date, timeZone: string) {
  const { hhmm } = getZonedYyyyMmDdAndHHmm(date, timeZone)
  const minutes = parseTimeToMinutes(hhmm)
  return minutes ?? 0
}

function getMemberDisplayName(instructor: SchedulerInstructor) {
  const firstName = instructor.user?.first_name ?? instructor.first_name
  const lastName = instructor.user?.last_name ?? instructor.last_name
  const full = [firstName, lastName].filter(Boolean).join(" ").trim()
  return full || instructor.user?.email || "Unnamed instructor"
}

function getInstructorEndorsementLabels(instructor: SchedulerInstructor) {
  const endorsements = [
    instructor.tawa_removal ? "TAWA" : null,
    instructor.night_removal ? "Night" : null,
    instructor.aerobatics_removal ? "Aerobatics" : null,
    instructor.multi_removal ? "Multi" : null,
    instructor.ifr_removal ? "IFR" : null,
  ]

  return endorsements.filter((value): value is string => Boolean(value))
}

function formatInstructorDisplayName(name: string, endorsements: string[]) {
  if (endorsements.length === 0) return name
  return `${name} (${endorsements.join(", ")})`
}

const WARNING_SEVERITY_STYLES: Record<
  BookingWarningSeverity,
  {
    badgeClassName: string
    dotClassName: string
  }
> = {
  critical: {
    badgeClassName: "border-red-200 bg-red-50 text-red-700",
    dotClassName: "bg-red-500",
  },
  high: {
    badgeClassName: "border-orange-200 bg-orange-50 text-orange-700",
    dotClassName: "bg-orange-500",
  },
  medium: {
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    dotClassName: "bg-amber-500",
  },
  low: {
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    dotClassName: "bg-sky-500",
  },
}

function getAircraftWarningTone(summary: SchedulerAircraftWarningSummary) {
  if (summary.has_blockers) {
    return {
      iconClassName: "text-red-600",
      triggerClassName: "border-red-200 bg-red-50/90 text-red-700 hover:bg-red-100/90",
      headerClassName: "border-red-200/80 bg-red-50/70",
      eyebrow: "Needs attention",
    }
  }

  return {
    iconClassName: "text-amber-600",
    triggerClassName: "border-amber-200 bg-amber-50/90 text-amber-700 hover:bg-amber-100/90",
    headerClassName: "border-amber-200/80 bg-amber-50/70",
    eyebrow: "Warnings present",
  }
}

function getAircraftWarningSummaryLine(summary: SchedulerAircraftWarningSummary) {
  if (summary.has_blockers) {
    const noteCount = Math.max(0, summary.total_count - summary.blocking_count)
    return `${summary.blocking_count} critical${noteCount > 0 ? `, ${noteCount} note${noteCount === 1 ? "" : "s"}` : ""}`
  }

  return `${summary.total_count} issue${summary.total_count === 1 ? "" : "s"}`
}

function AircraftWarningTooltipItem({ warning }: { warning: BookingWarningItem }) {
  const styles = WARNING_SEVERITY_STYLES[warning.severity]

  return (
    <div className="space-y-1.5 py-2">
      <div className="flex items-start gap-2">
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", styles.dotClassName)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium leading-5 text-slate-900">{warning.title}</span>
            <span
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                styles.badgeClassName
              )}
            >
              {warning.severity}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{warning.detail}</p>
          {warning.countdown_label ? (
            <p className="text-[11px] font-medium text-slate-500">{warning.countdown_label}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function AircraftWarningTooltip({ summary }: { summary: SchedulerAircraftWarningSummary }) {
  const isMobile = useIsMobile()
  const tone = getAircraftWarningTone(summary)
  const visibleWarnings = summary.warnings.slice(0, 4)
  const remainingCount = Math.max(0, summary.warnings.length - visibleWarnings.length)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            tone.triggerClassName
          )}
          role="button"
          tabIndex={0}
          aria-label={`Aircraft warnings: ${getAircraftWarningSummaryLine(summary)}`}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation()
          }}
        >
          <AlertTriangle className={cn("h-3 w-3", tone.iconClassName)} />
        </span>
      </PopoverTrigger>
      <PopoverContent
        side={isMobile ? "bottom" : "right"}
        align={isMobile ? "center" : "start"}
        sideOffset={isMobile ? 16 : 10}
        className={cn(
          "overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-xl",
          isMobile ? "w-[min(360px,100vw-24px)] max-w-[100vw-24px]" : "w-[320px]"
        )}
      >
        <div className={cn("border-b px-4 py-3", tone.headerClassName)}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{tone.eyebrow}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">Aircraft warnings</p>
          <p className="mt-1 text-xs text-slate-600">{getAircraftWarningSummaryLine(summary)}</p>
        </div>

        <div className="divide-y divide-slate-100 px-4 py-2">
          {visibleWarnings.map((warning) => (
            <AircraftWarningTooltipItem key={warning.id} warning={warning} />
          ))}
          {remainingCount > 0 ? (
            <p className="py-2 text-xs text-slate-500">
              {remainingCount} more warning{remainingCount === 1 ? "" : "s"} on the aircraft record.
            </p>
          ) : null}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5">
          <p className="text-[11px] text-slate-500">Open the aircraft record for full maintenance and observation detail.</p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function getResourceTitle(resource: Resource) {
  if (resource.kind === "instructor") return resource.data.displayName
  return `${resource.data.registration} (${resource.data.type})`
}

function statusBadgeVariant(status: BookingStatus, isStaff: boolean) {
  if (!isStaff && (status === "flying" || status === "complete")) {
    return "outline"
  }
  switch (status) {
    case "flying":
      return "secondary"
    case "complete":
      return "default"
    case "cancelled":
      return "outline"
    case "briefing":
      return "secondary"
    case "confirmed":
      return "outline"
    case "unconfirmed":
      return "outline"
    default:
      return "outline"
  }
}

function statusPillClasses(status: BookingStatus, isStaff: boolean) {
  if (!isStaff && (status === "flying" || status === "complete")) {
    return "border-slate-300 bg-slate-100"
  }
  switch (status) {
    case "flying":
      return "border-amber-200 bg-amber-50"
    case "complete":
      return "border-emerald-200 bg-emerald-50"
    case "cancelled":
      return "border-slate-200 bg-slate-100"
    case "briefing":
      return "border-sky-200 bg-sky-50"
    case "confirmed":
      return "border-indigo-200 bg-indigo-50"
    case "unconfirmed":
      return "border-slate-300 bg-slate-100"
    default:
      return "border-indigo-200 bg-indigo-50"
  }
}

function buildTimeSlots(start: Date, end: Date, intervalMinutes: number) {
  const slots: Date[] = []
  for (let t = new Date(start); t < end; t = new Date(t.getTime() + intervalMinutes * 60_000)) {
    slots.push(t)
  }
  return slots
}

function bookingMatchesResource(booking: SchedulerBooking, resource: Resource) {
  if (resource.kind === "instructor") return booking.instructorId === resource.data.id
  return booking.aircraftId != null && booking.aircraftId === resource.data.id
}

function getResourceId(resource: SchedulerDragResource) {
  return resource.data.id
}

function parseSupabaseUtcTimestamp(ts: string) {
  const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(ts)
  return new Date(hasTimezone ? ts : `${ts}Z`)
}

function bookingToSchedulerBooking(
  booking: BookingWithRelations,
  viewer: { userId: string | null; isStaff: boolean }
): SchedulerBooking | null {
  if (!booking.start_time || !booking.end_time) return null
  if (booking.status === "cancelled" || booking.cancelled_at) return null

  const startsAt = parseSupabaseUtcTimestamp(booking.start_time)
  const endsAt = parseSupabaseUtcTimestamp(booking.end_time)
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null

  const isOwn = Boolean(viewer.userId) && booking.user_id === viewer.userId
  const redactPeerDetails = !viewer.isStaff && !isOwn

  const aircraftLabel = booking.aircraft ? `${booking.aircraft.registration} (${booking.aircraft.type})` : undefined
  const instructorLabel = booking.instructor
    ? [booking.instructor.user?.first_name ?? booking.instructor.first_name, booking.instructor.user?.last_name ?? booking.instructor.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || undefined
    : undefined

  const studentName =
    booking.student
      ? [booking.student.first_name, booking.student.last_name].filter(Boolean).join(" ").trim() || ""
      : ""
  const isTrialFlight = booking.flight_type?.instruction_type === "trial"

  let primaryLabel: string
  let purpose: string
  let remarks: string | null

  if (redactPeerDetails) {
    if (booking.booking_type === "maintenance") {
      primaryLabel = "Maintenance"
    } else if (booking.booking_type === "groundwork") {
      primaryLabel = "Ground"
    } else if (booking.booking_type === "other") {
      primaryLabel = "Booking"
    } else {
      primaryLabel = studentName
        ? `${studentName}${isTrialFlight ? " (trial flight)" : ""}`
        : "Unassigned"
    }
    purpose = ""
    remarks = null
  } else {
    primaryLabel = studentName
      ? `${studentName}${isTrialFlight ? " (trial flight)" : ""}`
      : booking.purpose || "Unassigned"
    purpose = booking.purpose ?? ""
    remarks = booking.remarks
  }

  const canOpen = viewer.isStaff || isOwn
  const canCancel = (viewer.isStaff || isOwn) && booking.status !== "complete"
  /** Contact details in the scheduler menu are staff-only; members use other flows to see their profile. */
  const canViewContact = viewer.isStaff && Boolean(booking.user_id)
  const canConfirm = viewer.isStaff && booking.status === "unconfirmed"

  return {
    id: booking.id,
    startsAt,
    endsAt,
    primaryLabel,
    purpose,
    remarks,
    instructorId: booking.instructor_id,
    aircraftId: booking.aircraft_id,
    userId: booking.user_id,
    status: booking.status,
    bookingType: booking.booking_type ?? null,
    instructionType: booking.flight_type?.instruction_type ?? null,
    aircraftLabel,
    instructorLabel,
    canOpen,
    canCancel,
    canViewContact,
    canConfirm,
  }
}

export function ResourceTimelineScheduler({ data: initialData }: { data: SchedulerPageData }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { role, user } = useAuth()

  const isStaff = role === "owner" || role === "admin" || role === "instructor"
  const isMobile = useIsMobile()

  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(initialData.dateYyyyMmDd)
  const { data: schedulerData } = useSchedulerPageQuery({
    dateYyyyMmDd: selectedDateKey,
    initialData,
  })
  const data = schedulerData ?? initialData
  const [newBookingModalOpen, setNewBookingModalOpen] = React.useState(false)
  const [newBookingDraft, setNewBookingDraft] = React.useState<SchedulerBookingDraft | null>(null)
  const [cancelModalOpen, setCancelModalOpen] = React.useState(false)
  const [selectedBookingForCancel, setSelectedBookingForCancel] = React.useState<BookingWithRelations | null>(null)
  const [contactModalOpen, setContactModalOpen] = React.useState(false)
  const [contactMemberId, setContactMemberId] = React.useState<string | null>(null)
  const [dragPreview, setDragPreview] = React.useState<SchedulerBookingDragPreview | null>(null)
  const [pendingMove, setPendingMove] = React.useState<PendingSchedulerBookingMove | null>(null)
  const [nowTimestamp, setNowTimestamp] = React.useState(() => Date.now())
  const [isNavigating, startNavigation] = React.useTransition()
  const openModalTimerRef = React.useRef<number | null>(null)
  const dragCandidateRef = React.useRef<SchedulerBookingDragCandidate | null>(null)
  const dragPreviewRef = React.useRef<SchedulerBookingDragPreview | null>(null)
  const didDragRef = React.useRef(false)
  const suppressBookingOpenRef = React.useRef(false)
  const suppressBookingOpenTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (openModalTimerRef.current !== null) {
        window.clearTimeout(openModalTimerRef.current)
      }
      if (suppressBookingOpenTimerRef.current !== null) {
        window.clearTimeout(suppressBookingOpenTimerRef.current)
      }
      document.body.style.removeProperty("user-select")
      document.body.style.removeProperty("cursor")
    }
  }, [])

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTimestamp(Date.now())
    }, 30_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  React.useEffect(() => {
    dragPreviewRef.current = dragPreview
  }, [dragPreview])

  const handleSchedulerChanged = React.useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: schedulerPageQueryKey(selectedDateKey),
    })
  }, [queryClient, selectedDateKey])

  const {
    isApplyingMove,
    isUpdatingStatus,
    handleStatusUpdate,
    handleApplyPendingMove,
  } = useSchedulerBookingActions({
    pendingMove,
    onPendingMoveChange: setPendingMove,
    onCancelBookingClosed: () => {
      setCancelModalOpen(false)
      setSelectedBookingForCancel(null)
    },
    onChanged: handleSchedulerChanged,
  })

  const openContactDetails = React.useCallback((memberId: string) => {
    setContactMemberId(memberId)
    setContactModalOpen(true)
  }, [])

  React.useEffect(() => {
    setSelectedDateKey(initialData.dateYyyyMmDd)
  }, [initialData.dateYyyyMmDd])

  const timelineConfig = React.useMemo(
    () => buildTimelineConfig(data.businessHours),
    [data.businessHours]
  )

  const { timelineStart, timelineEnd } = React.useMemo(() => {
    const startTimeHHmm = minutesToTimeHHmm(timelineConfig.startMin)
    const endDateKey =
      timelineConfig.endMin >= 24 * 60 ? addDaysYyyyMmDd(selectedDateKey, 1) : selectedDateKey
    const endTimeHHmm = minutesToTimeHHmm(timelineConfig.endMin % (24 * 60))

    return {
      timelineStart: zonedDateTimeToUtc({
        dateYyyyMmDd: selectedDateKey,
        timeHHmm: startTimeHHmm,
        timeZone: data.timeZone,
      }),
      timelineEnd: zonedDateTimeToUtc({
        dateYyyyMmDd: endDateKey,
        timeHHmm: endTimeHHmm,
        timeZone: data.timeZone,
      }),
    }
  }, [data.timeZone, selectedDateKey, timelineConfig.endMin, timelineConfig.startMin])

  const slots = React.useMemo(
    () => buildTimeSlots(timelineStart, timelineEnd, timelineConfig.intervalMinutes),
    [timelineConfig.intervalMinutes, timelineEnd, timelineStart]
  )
  const slotCount = slots.length
  const slotMinWidthPx = 48
  const timelineMinWidth = slotCount > 0 ? slotCount * slotMinWidthPx : undefined
  const currentTimeLineLeftPct = React.useMemo(() => {
    const todayDateKey = zonedTodayYyyyMmDd(data.timeZone)
    if (selectedDateKey !== todayDateKey) return null

    const nowMinutes = getMinutesInTimeZone(new Date(nowTimestamp), data.timeZone)
    if (nowMinutes < timelineConfig.startMin || nowMinutes > timelineConfig.endMin) return null

    const timelineDurationMinutes = Math.max(1, timelineConfig.endMin - timelineConfig.startMin)
    const minutesIntoTimeline = nowMinutes - timelineConfig.startMin
    return clamp((minutesIntoTimeline / timelineDurationMinutes) * 100, 0, 100)
  }, [
    data.timeZone,
    nowTimestamp,
    selectedDateKey,
    timelineConfig.endMin,
    timelineConfig.startMin,
  ])

  const instructorAvailabilityById = React.useMemo(() => {
    const map = new Map<string, MinutesWindow[]>()
    for (const instructor of data.instructors) {
      const windows: MinutesWindow[] = []
      for (const rule of instructor.roster_rules) {
        const startMin = parseTimeToMinutes(rule.start_time)
        const endMin = parseTimeToMinutes(rule.end_time)
        if (startMin === null || endMin === null) continue
        windows.push({ startMin, endMin })
      }
      map.set(instructor.id, windows)
    }
    return map
  }, [data.instructors])

  const instructorResources = React.useMemo<InstructorResource[]>(
    () =>
      data.instructors
        .map((member) => {
          const name = getMemberDisplayName(member)
          const endorsements = getInstructorEndorsementLabels(member)

          return {
            id: member.id,
            name,
            endorsements,
            displayName: formatInstructorDisplayName(name, endorsements),
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.instructors]
  )

  const aircraftResources = React.useMemo<AircraftResource[]>(
    () =>
      data.aircraft.map((aircraft: AircraftWithType) => ({
        id: aircraft.id,
        registration: aircraft.registration,
        type: aircraft.type,
        warningSummary: data.aircraftWarningsById[aircraft.id] ?? null,
      })),
    [data.aircraft, data.aircraftWarningsById]
  )

  const instructorResourceById = React.useMemo(() => {
    const map = new Map<string, InstructorResource>()
    for (const resource of instructorResources) {
      map.set(resource.id, resource)
    }
    return map
  }, [instructorResources])

  const aircraftResourceById = React.useMemo(() => {
    const map = new Map<string, AircraftResource>()
    for (const resource of aircraftResources) {
      map.set(resource.id, resource)
    }
    return map
  }, [aircraftResources])

  const bookings = React.useMemo(() => {
    const viewer = { userId: user?.id ?? null, isStaff }
    return data.bookings
      .map((booking) => bookingToSchedulerBooking(booking, viewer))
      .filter((value): value is SchedulerBooking => value !== null)
  }, [data.bookings, isStaff, user?.id])
  const bookingsById = React.useMemo(() => {
    const map = new Map<string, BookingWithRelations>()
    for (const booking of data.bookings) {
      map.set(booking.id, booking)
    }
    return map
  }, [data.bookings])

  const formatResourceLabel = React.useCallback(
    (kind: Resource["kind"], resourceId: string) => {
      if (kind === "instructor") {
        return instructorResourceById.get(resourceId)?.displayName ?? "Instructor"
      }

      const aircraft = aircraftResourceById.get(resourceId)
      if (!aircraft) return "Aircraft"
      return `${aircraft.registration} (${aircraft.type})`
    },
    [aircraftResourceById, instructorResourceById]
  )

  const resolveResourceFromRowElement = React.useCallback(
    (element: Element | null): Resource | null => {
      if (!(element instanceof HTMLElement)) return null
      const row = element.closest<HTMLElement>("[data-scheduler-row='true']")
      if (!row) return null

      const kind = row.dataset.resourceKind
      const resourceId = row.dataset.resourceId
      if (!kind || !resourceId) return null

      if (kind === "instructor") {
        const data = instructorResourceById.get(resourceId)
        if (!data) return null
        return { kind: "instructor", data }
      }

      if (kind === "aircraft") {
        const data = aircraftResourceById.get(resourceId)
        if (!data) return null
        return { kind: "aircraft", data }
      }

      return null
    },
    [aircraftResourceById, instructorResourceById]
  )

  const isInstructorRangeAvailable = React.useCallback(
    (instructorId: string, start: Date, end: Date) => {
      const windows = instructorAvailabilityById.get(instructorId) ?? []
      if (windows.length === 0) return false

      const intervalMs = INTERVAL_MINUTES * 60_000
      for (let t = start.getTime(); t < end.getTime(); t += intervalMs) {
        const minute = getMinutesInTimeZone(new Date(t), data.timeZone)
        if (!isMinutesWithinAnyWindow(minute, windows)) return false
      }

      return true
    },
    [data.timeZone, instructorAvailabilityById]
  )

  const buildDragPreview = React.useCallback(
    (
      candidate: SchedulerBookingDragCandidate,
      clientX: number,
      clientY: number
    ): SchedulerBookingDragPreview => {
      const sourceResourceId = getResourceId(candidate.sourceResource)
      const fallback: SchedulerBookingDragPreview = {
        booking: candidate.booking,
        dragKind: candidate.sourceResource.kind,
        sourceResourceId,
        targetResourceId: sourceResourceId,
        startAt: candidate.booking.startsAt,
        endAt: candidate.booking.endsAt,
        valid: false,
      }

      if (slotCount <= 0) return fallback

      const hoveredElement = document.elementFromPoint(clientX, clientY)
      const targetResource = resolveResourceFromRowElement(hoveredElement)
      if (!targetResource) return fallback
      if (targetResource.kind !== candidate.sourceResource.kind) return fallback

      const rowElement = hoveredElement?.closest<HTMLElement>("[data-scheduler-row='true']") ?? null
      if (!rowElement) return fallback

      const rect = rowElement.getBoundingClientRect()
      if (!rect.width) return fallback

      const relativeX = clamp(clientX - rect.left, 0, rect.width)
      const hoveredIdx = clamp(Math.floor((relativeX / rect.width) * slotCount), 0, slotCount - 1)
      const maxStartIdx = Math.max(0, slotCount - Math.max(1, candidate.durationSlots))
      const startIdx = clamp(hoveredIdx - candidate.pointerOffsetSlots, 0, maxStartIdx)
      let startAt = slots[startIdx] ?? timelineStart
      const durationMs = candidate.booking.endsAt.getTime() - candidate.booking.startsAt.getTime()
      let endAt = new Date(startAt.getTime() + durationMs)

      if (endAt > timelineEnd) {
        endAt = new Date(timelineEnd)
        startAt = new Date(endAt.getTime() - durationMs)
      }
      if (startAt < timelineStart) {
        startAt = new Date(timelineStart)
        endAt = new Date(startAt.getTime() + durationMs)
      }

      let valid = true
      if (targetResource.kind === "instructor") {
        valid = isInstructorRangeAvailable(targetResource.data.id, startAt, endAt)
      }

      return {
        booking: candidate.booking,
        dragKind: candidate.sourceResource.kind,
        sourceResourceId,
        targetResourceId: targetResource.data.id,
        startAt,
        endAt,
        valid,
      }
    },
    [isInstructorRangeAvailable, resolveResourceFromRowElement, slotCount, slots, timelineEnd, timelineStart]
  )

  const handleBookingPointerDown = React.useCallback(
    (payload: SchedulerBookingPointerDownPayload) => {
      if (isMobile) return
      if (!isStaff) return
      if (payload.button !== 0) return
      if (pendingMove || isApplyingMove || isUpdatingStatus) return
      if (payload.booking.status === "complete") return

      dragCandidateRef.current = {
        booking: payload.booking,
        sourceResource: payload.sourceResource,
        pointerId: payload.pointerId,
        startClientX: payload.clientX,
        startClientY: payload.clientY,
        pointerOffsetSlots: payload.pointerOffsetSlots,
        durationSlots: payload.durationSlots,
      }
      didDragRef.current = false
      dragPreviewRef.current = null
      setDragPreview(null)
    },
    [isApplyingMove, isMobile, isStaff, isUpdatingStatus, pendingMove]
  )

  React.useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const candidate = dragCandidateRef.current
      if (!candidate || event.pointerId !== candidate.pointerId) return

      const distance = Math.hypot(event.clientX - candidate.startClientX, event.clientY - candidate.startClientY)
      if (!didDragRef.current && distance < 4) return

      if (!didDragRef.current) {
        didDragRef.current = true
        document.body.style.userSelect = "none"
        document.body.style.cursor = "grabbing"
      }

      const nextPreview = buildDragPreview(candidate, event.clientX, event.clientY)
      dragPreviewRef.current = nextPreview
      setDragPreview(nextPreview)
    }

    const handlePointerRelease = (event: PointerEvent) => {
      const candidate = dragCandidateRef.current
      if (!candidate || event.pointerId !== candidate.pointerId) return

      const didDrag = didDragRef.current
      const preview = dragPreviewRef.current

      dragCandidateRef.current = null
      didDragRef.current = false
      dragPreviewRef.current = null
      setDragPreview(null)

      document.body.style.removeProperty("user-select")
      document.body.style.removeProperty("cursor")

      if (!didDrag) return

      suppressBookingOpenRef.current = true
      if (suppressBookingOpenTimerRef.current !== null) {
        window.clearTimeout(suppressBookingOpenTimerRef.current)
      }
      suppressBookingOpenTimerRef.current = window.setTimeout(() => {
        suppressBookingOpenRef.current = false
        suppressBookingOpenTimerRef.current = null
      }, 0)

      if (!preview || !preview.valid) return

      const resourceChanged = preview.sourceResourceId !== preview.targetResourceId
      const timeChanged =
        preview.startAt.getTime() !== candidate.booking.startsAt.getTime() ||
        preview.endAt.getTime() !== candidate.booking.endsAt.getTime()
      if (!resourceChanged && !timeChanged) return

      setPendingMove({
        booking: candidate.booking,
        dragKind: preview.dragKind,
        fromResourceId: preview.sourceResourceId,
        toResourceId: preview.targetResourceId,
        fromResourceLabel: formatResourceLabel(preview.dragKind, preview.sourceResourceId),
        toResourceLabel: formatResourceLabel(preview.dragKind, preview.targetResourceId),
        startBefore: candidate.booking.startsAt,
        endBefore: candidate.booking.endsAt,
        startAfter: preview.startAt,
        endAfter: preview.endAt,
      })
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerRelease)
    window.addEventListener("pointercancel", handlePointerRelease)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerRelease)
      window.removeEventListener("pointercancel", handlePointerRelease)
    }
  }, [buildDragPreview, formatResourceLabel])

  const selectedDate = React.useMemo(
    () => dateKeyToCalendarDate(selectedDateKey),
    [selectedDateKey]
  )

  const pushDate = React.useCallback(
    (dateKey: string) => {
      startNavigation(() => {
        router.push(`/scheduler?date=${encodeURIComponent(dateKey)}`)
      })
    },
    [router]
  )

  const navigateDate = React.useCallback(
    (deltaDays: number) => {
      if (deltaDays < 0 && !isStaff) {
        const todayKey = zonedTodayYyyyMmDd(data.timeZone)
        const nextKey = addDaysYyyyMmDd(selectedDateKey, deltaDays)
        if (nextKey < todayKey) return
      }
      const nextKey = addDaysYyyyMmDd(selectedDateKey, deltaDays)
      setSelectedDateKey(nextKey)
      pushDate(nextKey)
    },
    [data.timeZone, isStaff, pushDate, selectedDateKey]
  )

  const goToToday = React.useCallback(() => {
    const today = zonedTodayYyyyMmDd(data.timeZone)
    setSelectedDateKey(today)
    pushDate(today)
  }, [data.timeZone, pushDate])

  const handleDateSelect = React.useCallback(
    (value: Date | undefined) => {
      if (!value) return
      const dayKey = getZonedYyyyMmDdAndHHmm(value, data.timeZone).yyyyMmDd
      if (!isStaff) {
        const todayKey = zonedTodayYyyyMmDd(data.timeZone)
        if (dayKey < todayKey) return
      }
      setSelectedDateKey(dayKey)
      pushDate(dayKey)
    },
    [data.timeZone, isStaff, pushDate]
  )

  React.useEffect(() => {
    if (isStaff) return
    if (!selectedDateKey) return
    const todayKey = zonedTodayYyyyMmDd(data.timeZone)
    if (selectedDateKey < todayKey) {
      setSelectedDateKey(todayKey)
      pushDate(todayKey)
    }
  }, [data.timeZone, isStaff, pushDate, selectedDateKey])

  const toolbarDisablePreviousDay = React.useMemo(() => {
    if (isStaff) return false
    const todayKey = zonedTodayYyyyMmDd(data.timeZone)
    return addDaysYyyyMmDd(selectedDateKey, -1) < todayKey
  }, [data.timeZone, isStaff, selectedDateKey])

  const calendarDisabledPastDays = React.useCallback(
    (date: Date) => {
      if (isStaff) return false
      const dayKey = getZonedYyyyMmDdAndHHmm(date, data.timeZone).yyyyMmDd
      return dayKey < zonedTodayYyyyMmDd(data.timeZone)
    },
    [data.timeZone, isStaff]
  )

  const statusBadgeVariantForViewer = React.useCallback(
    (status: BookingStatus) => statusBadgeVariant(status, isStaff),
    [isStaff]
  )
  const statusPillClassesForViewer = React.useCallback(
    (status: BookingStatus) => statusPillClasses(status, isStaff),
    [isStaff]
  )
  const handleBookingClick = React.useCallback(
    (booking: SchedulerBooking) => {
      if (suppressBookingOpenRef.current) {
        suppressBookingOpenRef.current = false
        return
      }
      if (!booking.canOpen) {
        return
      }
      router.push(getBookingOpenPath(booking.id, booking.status))
    },
    [router]
  )

  const handleCancelBookingClick = React.useCallback(
    (booking: SchedulerBooking) => {
      const bookingForModal = bookingsById.get(booking.id) ?? null
      if (!bookingForModal) {
        toast.error("Failed to load booking details")
        return
      }
      setSelectedBookingForCancel(bookingForModal)
      setCancelModalOpen(true)
    },
    [bookingsById]
  )

  const openCreateBookingModal = React.useCallback(
    ({ when, resource }: { when?: Date; resource?: Resource } = {}) => {
      if (!selectedDateKey) return

      let dateYyyyMmDd = selectedDateKey
      let startTimeHHmm = minutesToTimeHHmm(timelineConfig.startMin % (24 * 60))
      let endTimeHHmm = minutesToTimeHHmm((timelineConfig.startMin + 60) % (24 * 60))

      if (when) {
        const startParts = getZonedYyyyMmDdAndHHmm(when, data.timeZone)
        const endParts = getZonedYyyyMmDdAndHHmm(new Date(when.getTime() + 60 * 60_000), data.timeZone)
        dateYyyyMmDd = startParts.yyyyMmDd
        startTimeHHmm = startParts.hhmm
        endTimeHHmm = endParts.hhmm
      }

      setNewBookingDraft({
        dateYyyyMmDd,
        startTimeHHmm,
        endTimeHHmm,
        preselectedInstructorId: resource?.kind === "instructor" ? resource.data.id : null,
        preselectedAircraftId: resource?.kind === "aircraft" ? resource.data.id : null,
      })

      if (openModalTimerRef.current !== null) {
        window.clearTimeout(openModalTimerRef.current)
      }
      // Safari can dismiss controlled dialogs if opened within the same click cycle.
      openModalTimerRef.current = window.setTimeout(() => {
        setNewBookingModalOpen(true)
        openModalTimerRef.current = null
      }, 0)
    },
    [data.timeZone, selectedDateKey, timelineConfig.startMin]
  )

  const handleNewBooking = React.useCallback(() => {
    openCreateBookingModal()
  }, [openCreateBookingModal])

  const handleEmptySlotClick = React.useCallback(
    ({
      resource,
      clientX,
      container,
    }: {
      resource: Resource
      clientX: number
      container: HTMLDivElement
    }) => {
      if (suppressBookingOpenRef.current) return
      if (!selectedDateKey) return
      const rect = container.getBoundingClientRect()
      if (!rect.width || slotCount === 0) return

      const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
      const rawIdx = Math.floor((x / rect.width) * slotCount)
      const idx = Math.max(0, Math.min(rawIdx, slotCount - 1))
      const when = slots[idx] ?? timelineStart

      if (resource.kind === "instructor") {
        const windows = instructorAvailabilityById.get(resource.data.id) ?? []
        const mins = getMinutesInTimeZone(when, data.timeZone)
        if (!isMinutesWithinAnyWindow(mins, windows)) {
          return
        }
      }

      openCreateBookingModal({ when, resource })
    },
    [
      data.timeZone,
      instructorAvailabilityById,
      openCreateBookingModal,
      selectedDateKey,
      slotCount,
      slots,
      timelineStart,
    ]
  )

  const dragInProgress = dragPreview !== null
  const pendingMoveHasResourceChange = Boolean(
    pendingMove && pendingMove.fromResourceId !== pendingMove.toResourceId
  )
  const pendingMoveHasTimeChange = Boolean(
    pendingMove &&
      (pendingMove.startBefore.getTime() !== pendingMove.startAfter.getTime() ||
        pendingMove.endBefore.getTime() !== pendingMove.endAfter.getTime())
  )
  const isLoading = !selectedDateKey || isNavigating
  const timelineHeaderCells = React.useMemo(
    () =>
      slots.map((slot) => {
        return (
          <div
            key={slot.toISOString()}
            className={cn(
              "flex items-center justify-center border-r border-border/60 px-0.5 text-[9px] text-slate-500 last:border-r-0 sm:px-1 sm:text-[10px]"
            )}
          >
            <div className="select-none whitespace-nowrap px-1 py-1 font-medium tabular-nums text-slate-500">
              {formatTimeLabel(slot, data.timeZone)}
            </div>
          </div>
        )
      }),
    [data.timeZone, slots]
  )
  const instructorTimelineRows = React.useMemo(
    () =>
      (
        <ResourceTimelineSection
          items={instructorResources}
          renderRow={(inst, index) => {
            const resource: Resource = { kind: "instructor", data: inst }
            const rowBookings = bookings.filter((booking) => bookingMatchesResource(booking, resource))
            const windows = instructorAvailabilityById.get(inst.id) ?? []

            return (
              <ResourceTimelineRow
                key={inst.id}
                rowResource={resource}
                height={ROW_HEIGHT}
                slotCount={slotCount}
                slots={slots}
                timelineStart={timelineStart}
                timelineEnd={timelineEnd}
                timeZone={data.timeZone}
                bookings={rowBookings}
                dragPreview={dragPreview}
                dragInProgress={dragInProgress}
                isStriped={index % 2 === 1}
                resourceTitle={getResourceTitle(resource)}
                isSlotAvailable={(slot) =>
                  isMinutesWithinAnyWindow(getMinutesInTimeZone(slot, data.timeZone), windows)
                }
                onEmptyClick={(clientX, container) => handleEmptySlotClick({ resource, clientX, container })}
                onBookingPointerDown={handleBookingPointerDown}
                canDragBookings={isStaff && !isMobile}
                canViewAircraftProfile={isStaff}
                onBookingClick={handleBookingClick}
                onViewContactDetails={openContactDetails}
                onStatusUpdate={(variables) => {
                  void handleStatusUpdate(variables)
                }}
                onCancelBooking={handleCancelBookingClick}
                formatTimeRangeLabel={formatTimeRangeLabel}
                formatTimeRangeLabel12h={formatTimeRangeLabel12h}
                statusBadgeVariant={statusBadgeVariantForViewer}
                statusPillClasses={statusPillClassesForViewer}
                formatTimeLabel12h={formatTimeLabel12h}
              />
            )
          }}
        />
      ),
    [
      bookings,
      data.timeZone,
      dragInProgress,
      dragPreview,
      handleBookingClick,
      handleBookingPointerDown,
      handleCancelBookingClick,
      handleEmptySlotClick,
      handleStatusUpdate,
      instructorAvailabilityById,
      instructorResources,
      isMobile,
      isStaff,
      openContactDetails,
      statusBadgeVariantForViewer,
      statusPillClassesForViewer,
      slotCount,
      slots,
      timelineEnd,
      timelineStart,
    ]
  )
  const aircraftTimelineRows = React.useMemo(
    () =>
      (
        <ResourceTimelineSection
          items={aircraftResources}
          renderRow={(ac, index) => {
            const resource: Resource = { kind: "aircraft", data: ac }
            const rowBookings = bookings.filter((booking) => bookingMatchesResource(booking, resource))

            return (
              <ResourceTimelineRow
                key={ac.id}
                rowResource={resource}
                height={ROW_HEIGHT}
                slotCount={slotCount}
                slots={slots}
                timelineStart={timelineStart}
                timelineEnd={timelineEnd}
                timeZone={data.timeZone}
                bookings={rowBookings}
                dragPreview={dragPreview}
                dragInProgress={dragInProgress}
                isStriped={index % 2 === 1}
                resourceTitle={getResourceTitle(resource)}
                onEmptyClick={(clientX, container) => handleEmptySlotClick({ resource, clientX, container })}
                onBookingPointerDown={handleBookingPointerDown}
                canDragBookings={isStaff && !isMobile}
                canViewAircraftProfile={isStaff}
                onBookingClick={handleBookingClick}
                onViewContactDetails={openContactDetails}
                onStatusUpdate={(variables) => {
                  void handleStatusUpdate(variables)
                }}
                onCancelBooking={handleCancelBookingClick}
                formatTimeRangeLabel={formatTimeRangeLabel}
                formatTimeRangeLabel12h={formatTimeRangeLabel12h}
                statusBadgeVariant={statusBadgeVariantForViewer}
                statusPillClasses={statusPillClassesForViewer}
                formatTimeLabel12h={formatTimeLabel12h}
              />
            )
          }}
        />
      ),
    [
      aircraftResources,
      bookings,
      data.timeZone,
      dragInProgress,
      dragPreview,
      handleBookingClick,
      handleBookingPointerDown,
      handleCancelBookingClick,
      handleEmptySlotClick,
      handleStatusUpdate,
      isMobile,
      isStaff,
      openContactDetails,
      statusBadgeVariantForViewer,
      statusPillClassesForViewer,
      slotCount,
      slots,
      timelineEnd,
      timelineStart,
    ]
  )

  return (
    <div className="space-y-4">
      <ResourceTimelineToolbar
        selectedDateLabel={selectedDateKey ? formatDateKeyLabel(selectedDateKey) : "Loading..."}
        selectedDate={selectedDate ?? undefined}
        onSelectDate={handleDateSelect}
        onPreviousDay={() => navigateDate(-1)}
        onNextDay={() => navigateDate(1)}
        onToday={goToToday}
        onNewBooking={handleNewBooking}
        disableNewBooking={!selectedDateKey}
        disablePreviousDay={toolbarDisablePreviousDay}
        calendarDisabled={isStaff ? undefined : calendarDisabledPastDays}
      />

      <div className="overflow-hidden rounded-md border border-border/70 bg-background shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading scheduler data...</p>
          </div>
        ) : (
          <div className="flex bg-background">
            <ResourceTimelineSidebar
              rowHeight={ROW_HEIGHT}
              groupHeight={GROUP_HEIGHT}
              instructorResources={instructorResources}
              aircraftResources={aircraftResources}
              onSelectInstructor={(instructorId) => {
                const inst = instructorResourceById.get(instructorId)
                if (!inst) return
                openCreateBookingModal({
                  resource: { kind: "instructor", data: inst },
                })
              }}
              onSelectAircraft={(aircraftId) => {
                const ac = aircraftResourceById.get(aircraftId)
                if (!ac) return
                openCreateBookingModal({
                  resource: { kind: "aircraft", data: ac },
                })
              }}
              renderAircraftWarning={(summary) => <AircraftWarningTooltip summary={summary} />}
            />
            <ResourceTimelineGrid
              timelineMinWidth={timelineMinWidth}
              currentTimeLineLeftPct={currentTimeLineLeftPct}
              headerCells={timelineHeaderCells}
              instructorRows={instructorTimelineRows}
              aircraftRows={aircraftTimelineRows}
              groupHeight={GROUP_HEIGHT}
              slotCount={slotCount}
              slots={slots}
            />
          </div>
        )}
      </div>

      <PendingBookingMoveDialog
        open={Boolean(pendingMove)}
        pendingMove={pendingMove}
        hasResourceChange={pendingMoveHasResourceChange}
        hasTimeChange={pendingMoveHasTimeChange}
        isApplyingMove={isApplyingMove}
        timeZone={data.timeZone}
        onOpenChange={(open) => {
          if (!open && !isApplyingMove) {
            setPendingMove(null)
          }
        }}
        onCancel={() => {
          setPendingMove(null)
        }}
        onApprove={() => {
          void handleApplyPendingMove()
        }}
        formatDateTimeRange={formatFriendlyDateTimeRangeLabel}
      />

      <NewBookingModal
        open={newBookingModalOpen}
        onOpenChange={(open) => {
          setNewBookingModalOpen(open)
          if (!open) setNewBookingDraft(null)
        }}
        draft={newBookingDraft}
        timeZone={data.timeZone}
        isStaff={isStaff}
        currentUserId={user?.id ?? null}
        onCreated={handleSchedulerChanged}
        instructorRosterWindows={instructorAvailabilityById}
      />

      <CancelBookingModal
        open={cancelModalOpen}
        onOpenChange={(open) => {
          setCancelModalOpen(open)
          if (!open) setSelectedBookingForCancel(null)
        }}
        booking={selectedBookingForCancel}
        pending={isUpdatingStatus}
        onConfirm={(payload: CancelBookingPayload) => {
          if (!selectedBookingForCancel) return
          void handleStatusUpdate({
            bookingId: selectedBookingForCancel.id,
            status: "cancelled",
            cancellationCategoryId: payload.cancellationCategoryId,
            cancellationReason: payload.cancellationReason,
            cancelledNotes: payload.cancelledNotes,
          })
        }}
      />

      <ContactDetailsModal
        open={contactModalOpen}
        onOpenChange={(open) => {
          setContactModalOpen(open)
          if (!open) setContactMemberId(null)
        }}
        memberId={contactMemberId}
      />
    </div>
  )
}
