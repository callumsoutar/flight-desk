"use client"

import * as React from "react"
import {
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  Plane,
  User,
  UserCircle,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { getBookingOpenPath } from "@/lib/bookings/navigation"
import { getBookingLayout } from "@/lib/scheduler/timeline"
import {
  addDaysYyyyMmDd,
  dayOfWeekFromYyyyMmDd,
  getZonedYyyyMmDdAndHHmm,
  zonedDateTimeToUtc,
  zonedTodayYyyyMmDd,
} from "@/lib/utils/timezone"
import { useAuth } from "@/contexts/auth-context"
import { CancelBookingModal } from "@/components/bookings/cancel-booking-modal"
import { NewBookingModal, type SchedulerBookingDraft } from "@/components/scheduler/new-booking-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type { BookingStatus, BookingWithRelations } from "@/lib/types/bookings"
import type { SchedulerBusinessHours, SchedulerInstructor, SchedulerPageData } from "@/lib/types/scheduler"

type AircraftResource = {
  id: string
  registration: string
  type: string
}

type InstructorResource = {
  id: string
  name: string
}

type Resource =
  | { kind: "instructor"; data: InstructorResource }
  | { kind: "aircraft"; data: AircraftResource }

type SchedulerBooking = {
  id: string
  startsAt: Date
  endsAt: Date
  primaryLabel: string
  instructorId: string | null
  aircraftId: string
  userId: string | null
  status: BookingStatus
  aircraftLabel?: string
  instructorLabel?: string
  canOpen: boolean
  canCancel: boolean
  canViewContact: boolean
  canConfirm: boolean
}

type SchedulerBookingPointerDownPayload = {
  booking: SchedulerBooking
  sourceResource: Resource
  pointerId: number
  clientX: number
  clientY: number
  button: number
  pointerOffsetSlots: number
  durationSlots: number
}

type SchedulerBookingDragCandidate = {
  booking: SchedulerBooking
  sourceResource: Resource
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
const ROW_HEIGHT = 34
const GROUP_HEIGHT = 28
const LEFT_COL_WIDTH = "w-[160px] sm:w-[240px] lg:w-[280px]"

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

function dateToKeyFromCalendar(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
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

function getResourceTitle(resource: Resource) {
  if (resource.kind === "instructor") return resource.data.name
  return `${resource.data.registration} (${resource.data.type})`
}

function statusBadgeVariant(status: BookingStatus) {
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

function statusPillClasses(status: BookingStatus) {
  switch (status) {
    case "flying":
      return "bg-amber-500 text-white"
    case "complete":
      return "bg-emerald-600 text-white"
    case "cancelled":
      return "bg-muted text-muted-foreground"
    case "briefing":
      return "bg-sky-600 text-white"
    case "confirmed":
      return "bg-indigo-600 text-white"
    case "unconfirmed":
      return "bg-slate-600 text-white"
    default:
      return "bg-indigo-600 text-white"
  }
}

function statusIndicatorClasses(status: BookingStatus) {
  switch (status) {
    case "flying":
      return "bg-amber-500"
    case "complete":
      return "bg-emerald-600"
    case "cancelled":
      return "bg-muted-foreground/40"
    case "briefing":
      return "bg-sky-600"
    case "confirmed":
      return "bg-indigo-600"
    case "unconfirmed":
      return "bg-slate-600"
    default:
      return "bg-indigo-600"
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
  return booking.aircraftId === resource.data.id
}

function getResourceId(resource: Resource) {
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
  if (!booking.start_time || !booking.end_time || !booking.aircraft_id) return null
  if (booking.status === "cancelled" || booking.cancelled_at) return null

  const startsAt = parseSupabaseUtcTimestamp(booking.start_time)
  const endsAt = parseSupabaseUtcTimestamp(booking.end_time)
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null

  const studentName =
    booking.student
      ? [booking.student.first_name, booking.student.last_name].filter(Boolean).join(" ").trim() || "Booked"
      : ""
  const primaryLabel = studentName || booking.purpose || "Unassigned"
  const aircraftLabel = booking.aircraft ? `${booking.aircraft.registration} (${booking.aircraft.type})` : undefined
  const instructorLabel = booking.instructor
    ? [booking.instructor.user?.first_name ?? booking.instructor.first_name, booking.instructor.user?.last_name ?? booking.instructor.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || undefined
    : undefined

  const isOwn = Boolean(viewer.userId) && booking.user_id === viewer.userId
  const canOpen = viewer.isStaff || isOwn
  const canCancel = (viewer.isStaff || isOwn) && booking.status !== "complete"
  const canViewContact = viewer.isStaff || isOwn
  const canConfirm = viewer.isStaff && booking.status === "unconfirmed"

  return {
    id: booking.id,
    startsAt,
    endsAt,
    primaryLabel,
    instructorId: booking.instructor_id,
    aircraftId: booking.aircraft_id,
    userId: booking.user_id,
    status: booking.status,
    aircraftLabel,
    instructorLabel,
    canOpen,
    canCancel,
    canViewContact,
    canConfirm,
  }
}

export function ResourceTimelineScheduler({ data }: { data: SchedulerPageData }) {
  const router = useRouter()
  const { role, user } = useAuth()

  const isStaff = role === "owner" || role === "admin" || role === "instructor"

  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(data.dateYyyyMmDd)
  const [newBookingModalOpen, setNewBookingModalOpen] = React.useState(false)
  const [newBookingDraft, setNewBookingDraft] = React.useState<SchedulerBookingDraft | null>(null)
  const [cancelModalOpen, setCancelModalOpen] = React.useState(false)
  const [selectedBookingForCancel, setSelectedBookingForCancel] = React.useState<SchedulerBooking | null>(null)
  const [dragPreview, setDragPreview] = React.useState<SchedulerBookingDragPreview | null>(null)
  const [pendingMove, setPendingMove] = React.useState<PendingSchedulerBookingMove | null>(null)
  const [isApplyingMove, setIsApplyingMove] = React.useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false)
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
    dragPreviewRef.current = dragPreview
  }, [dragPreview])

  React.useEffect(() => {
    setSelectedDateKey(data.dateYyyyMmDd)
  }, [data.dateYyyyMmDd])

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
  const slotMinWidthPx = 42
  const timelineMinWidth = slotCount > 0 ? slotCount * slotMinWidthPx : undefined

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
        .map((member) => ({
          id: member.id,
          name: getMemberDisplayName(member),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.instructors]
  )

  const aircraftResources = React.useMemo<AircraftResource[]>(
    () =>
      data.aircraft.map((aircraft: AircraftWithType) => ({
        id: aircraft.id,
        registration: aircraft.registration,
        type: aircraft.type,
      })),
    [data.aircraft]
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

  const formatResourceLabel = React.useCallback(
    (kind: Resource["kind"], resourceId: string) => {
      if (kind === "instructor") {
        return instructorResourceById.get(resourceId)?.name ?? "Instructor"
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
      if (!isStaff) return
      if (payload.button !== 0) return
      if (pendingMove || isApplyingMove || isUpdatingStatus) return

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
    [isApplyingMove, isStaff, isUpdatingStatus, pendingMove]
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

  const handleStatusUpdate = React.useCallback(
    async (variables: {
      bookingId: string
      status: BookingStatus
      cancellationReason?: string | null
    }) => {
      setIsUpdatingStatus(true)
      try {
        const res = await fetch(`/api/bookings/${variables.bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: variables.status,
            cancellation_reason:
              variables.status === "cancelled" ? (variables.cancellationReason ?? null) : undefined,
          }),
        })

        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(payload.error || "Failed to update booking")
        }

        await res.json()
        setCancelModalOpen(false)
        setSelectedBookingForCancel(null)
        toast.success(
          variables.status === "confirmed"
            ? "Booking confirmed"
            : variables.status === "cancelled"
              ? "Booking cancelled"
              : "Booking updated"
        )
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update booking")
      } finally {
        setIsUpdatingStatus(false)
      }
    },
    [router]
  )

  const handleApplyPendingMove = React.useCallback(async () => {
    if (!pendingMove) return

    const resourceChanged = pendingMove.fromResourceId !== pendingMove.toResourceId
    const timeChanged =
      pendingMove.startBefore.getTime() !== pendingMove.startAfter.getTime() ||
      pendingMove.endBefore.getTime() !== pendingMove.endAfter.getTime()
    if (!resourceChanged && !timeChanged) {
      setPendingMove(null)
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
      const response = await fetch(`/api/bookings/${pendingMove.booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error || "Failed to move booking")
      }

      await response.json()
      setPendingMove(null)
      toast.success("Booking moved")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move booking")
    } finally {
      setIsApplyingMove(false)
    }
  }, [pendingMove, router])

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
      const nextKey = addDaysYyyyMmDd(selectedDateKey, deltaDays)
      setSelectedDateKey(nextKey)
      pushDate(nextKey)
    },
    [pushDate, selectedDateKey]
  )

  const goToToday = React.useCallback(() => {
    const today = zonedTodayYyyyMmDd(data.timeZone)
    setSelectedDateKey(today)
    pushDate(today)
  }, [data.timeZone, pushDate])

  const handleDateSelect = React.useCallback(
    (value: Date | undefined) => {
      if (!value) return
      const dayKey = dateToKeyFromCalendar(value)
      setSelectedDateKey(dayKey)
      pushDate(dayKey)
    },
    [pushDate]
  )

  const handleBookingClick = React.useCallback(
    (booking: SchedulerBooking) => {
      if (suppressBookingOpenRef.current) {
        suppressBookingOpenRef.current = false
        return
      }
      if (!booking.canOpen) {
        toast.message("Busy slot", {
          description: "You can only open your own bookings.",
        })
        return
      }
      router.push(getBookingOpenPath(booking.id, booking.status))
    },
    [router]
  )

  const handleCancelBookingClick = React.useCallback((booking: SchedulerBooking) => {
    setSelectedBookingForCancel(booking)
    setCancelModalOpen(true)
  }, [])

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

  const handleCreatedBooking = React.useCallback(() => {
    router.refresh()
  }, [router])

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-10 flex-1 justify-start gap-2 px-3 font-semibold sm:flex-initial"
                aria-label="Select date"
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">
                  {selectedDateKey ? formatDateKeyLabel(selectedDateKey) : "Loading..."}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={selectedDate ?? undefined} onSelect={handleDateSelect} initialFocus />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="icon" onClick={() => navigateDate(1)} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button variant="ghost" onClick={goToToday} className="hidden sm:inline-flex">
            Today
          </Button>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <Button
            className="h-10 bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800"
            onClick={handleNewBooking}
            disabled={!selectedDateKey}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            New booking
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading scheduler data...</p>
          </div>
        ) : (
          <div className="flex">
            <div className={cn("shrink-0 border-r border-border/60 bg-muted/10", LEFT_COL_WIDTH)}>
              <div className="sticky top-0 z-30 flex h-10 items-center border-b bg-card/95 px-2 backdrop-blur sm:h-12 sm:px-4">
                <div className="text-xs font-semibold text-foreground/90 sm:text-sm">Resources</div>
              </div>

              <div
                className="flex items-center border-b border-border/60 bg-muted/20 px-2 text-[11px] font-semibold text-muted-foreground sm:px-4"
                style={{ height: GROUP_HEIGHT }}
              >
                Instructors
              </div>
              {instructorResources.map((inst) => (
                <div
                  key={inst.id}
                  className="flex cursor-pointer items-center border-b border-border/60 px-2 transition-colors hover:bg-muted/30 sm:px-4"
                  style={{ height: ROW_HEIGHT }}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    openCreateBookingModal({
                      resource: { kind: "instructor", data: inst },
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return
                    event.preventDefault()
                    openCreateBookingModal({
                      resource: { kind: "instructor", data: inst },
                    })
                  }}
                >
                  <div className="min-w-0 truncate text-[13px] font-semibold leading-tight sm:text-sm">
                    {inst.name}
                  </div>
                </div>
              ))}

              <div
                className="flex items-center border-b border-border/60 bg-muted/20 px-2 text-[11px] font-semibold text-muted-foreground sm:px-4"
                style={{ height: GROUP_HEIGHT }}
              >
                Aircraft
              </div>
              {aircraftResources.map((ac) => (
                <div
                  key={ac.id}
                  className="flex cursor-pointer items-center border-b border-border/60 px-2 transition-colors hover:bg-muted/30 sm:px-4"
                  style={{ height: ROW_HEIGHT }}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    openCreateBookingModal({
                      resource: { kind: "aircraft", data: ac },
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return
                    event.preventDefault()
                    openCreateBookingModal({
                      resource: { kind: "aircraft", data: ac },
                    })
                  }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold leading-tight sm:text-sm">
                      {ac.registration}{" "}
                      <span className="font-medium text-muted-foreground/90">({ac.type})</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="min-w-0 flex-1 overflow-x-auto">
              <div style={timelineMinWidth ? { minWidth: timelineMinWidth } : undefined}>
                <div className="sticky top-0 z-30 h-10 border-b border-border/60 bg-card/95 backdrop-blur sm:h-12">
                  <div
                    className="grid h-full"
                    style={{
                      gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))`,
                    }}
                  >
                    {slots.map((slot) => {
                      const minutes = getMinutesInTimeZone(slot, data.timeZone) % 60
                      const showLabel = minutes === 0
                      return (
                        <div
                          key={slot.toISOString()}
                          className={cn(
                            "last:border-r-0 flex items-center justify-center border-r border-border/60 px-0.5 text-[8px] text-muted-foreground sm:px-1 sm:text-[9px]"
                          )}
                        >
                          <div
                            className={cn(
                              "select-none whitespace-nowrap font-medium tabular-nums",
                              showLabel ? "" : "opacity-40"
                            )}
                          >
                            {formatTimeLabel(slot, data.timeZone)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="divide-y">
                  <div className="bg-muted/20" style={{ height: GROUP_HEIGHT }} aria-hidden="true">
                    <div
                      className="grid h-full"
                      style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
                    >
                      {slots.map((slot) => (
                        <div key={slot.toISOString()} className="last:border-r-0 border-r" />
                      ))}
                    </div>
                  </div>

                  {instructorResources.map((inst) => {
                    const resource: Resource = { kind: "instructor", data: inst }
                    const rowBookings = bookings.filter((booking) => bookingMatchesResource(booking, resource))
                    const windows = instructorAvailabilityById.get(inst.id) ?? []

                    return (
                      <TimelineRow
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
                        resourceTitle={getResourceTitle(resource)}
                        isSlotAvailable={(slot) => isMinutesWithinAnyWindow(getMinutesInTimeZone(slot, data.timeZone), windows)}
                        onEmptyClick={(clientX, container) => handleEmptySlotClick({ resource, clientX, container })}
                        onBookingPointerDown={handleBookingPointerDown}
                        canDragBookings={isStaff}
                        onBookingClick={handleBookingClick}
                        onStatusUpdate={(variables) => {
                          void handleStatusUpdate(variables)
                        }}
                        onCancelBooking={handleCancelBookingClick}
                      />
                    )
                  })}

                  <div className="bg-muted/20" style={{ height: GROUP_HEIGHT }} aria-hidden="true">
                    <div
                      className="grid h-full"
                      style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
                    >
                      {slots.map((slot) => (
                        <div key={slot.toISOString()} className="last:border-r-0 border-r" />
                      ))}
                    </div>
                  </div>

                  {aircraftResources.map((ac) => {
                    const resource: Resource = { kind: "aircraft", data: ac }
                    const rowBookings = bookings.filter((booking) => bookingMatchesResource(booking, resource))

                    return (
                      <TimelineRow
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
                        resourceTitle={getResourceTitle(resource)}
                        onEmptyClick={(clientX, container) => handleEmptySlotClick({ resource, clientX, container })}
                        onBookingPointerDown={handleBookingPointerDown}
                        canDragBookings={isStaff}
                        onBookingClick={handleBookingClick}
                        onStatusUpdate={(variables) => {
                          void handleStatusUpdate(variables)
                        }}
                        onCancelBooking={handleCancelBookingClick}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(pendingMove)}
        onOpenChange={(open) => {
          if (!open && !isApplyingMove) {
            setPendingMove(null)
          }
        }}
      >
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

                {pendingMoveHasResourceChange ? (
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

                {pendingMoveHasTimeChange ? (
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
                            {formatFriendlyDateTimeRangeLabel(
                              pendingMove.startBefore,
                              pendingMove.endBefore,
                              data.timeZone
                            )}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="min-w-[42px] pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            New
                          </span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                            {formatFriendlyDateTimeRangeLabel(
                              pendingMove.startAfter,
                              pendingMove.endAfter,
                              data.timeZone
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
            <Button
              variant="outline"
              disabled={isApplyingMove}
              onClick={() => {
                setPendingMove(null)
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-slate-900 font-semibold text-white hover:bg-slate-800"
              disabled={isApplyingMove || !pendingMove}
              onClick={() => {
                void handleApplyPendingMove()
              }}
            >
              {isApplyingMove ? "Applying..." : "Approve changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        onCreated={handleCreatedBooking}
      />

      <CancelBookingModal
        open={cancelModalOpen}
        onOpenChange={(open) => {
          setCancelModalOpen(open)
          if (!open) setSelectedBookingForCancel(null)
        }}
        pending={isUpdatingStatus}
        onConfirm={(reason) => {
          if (!selectedBookingForCancel) return
          void handleStatusUpdate({
            bookingId: selectedBookingForCancel.id,
            status: "cancelled",
            cancellationReason: reason,
          })
        }}
      />
    </div>
  )
}

function TimelineRow({
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
  onStatusUpdate,
  onCancelBooking,
  timeZone,
}: {
  rowResource: Resource
  height: number
  slotCount: number
  slots: Date[]
  timelineStart: Date
  timelineEnd: Date
  bookings: SchedulerBooking[]
  dragPreview: SchedulerBookingDragPreview | null
  dragInProgress: boolean
  resourceTitle?: string
  isSlotAvailable?: (slot: Date) => boolean
  onEmptyClick: (clientX: number, container: HTMLDivElement) => void
  onBookingPointerDown: (payload: SchedulerBookingPointerDownPayload) => void
  canDragBookings: boolean
  onBookingClick: (booking: SchedulerBooking) => void
  onStatusUpdate: (variables: {
    bookingId: string
    status: BookingStatus
    cancellationReason?: string | null
  }) => void
  onCancelBooking: (booking: SchedulerBooking) => void
  timeZone: string
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const router = useRouter()
  const [hoveredSlotIdx, setHoveredSlotIdx] = React.useState<number | null>(null)
  const hoveredSlot = hoveredSlotIdx === null ? null : (slots[hoveredSlotIdx] ?? null)
  const hoveredAvailable = hoveredSlot && isSlotAvailable ? isSlotAvailable(hoveredSlot) : true
  const hoveredTimeLabel = hoveredSlot ? formatTimeLabel12h(hoveredSlot, timeZone) : null
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
      <div
        ref={containerRef}
        className={cn(
          "absolute inset-0 cursor-default",
          activeDragPreview && rowResource.data.id === activeDragPreview.targetResourceId
            ? activeDragPreview.valid
              ? "bg-emerald-500/5"
              : "bg-destructive/5"
            : ""
        )}
        onMouseMove={(event) => {
          if (!containerRef.current) return
          const rect = containerRef.current.getBoundingClientRect()
          if (!rect.width) return
          const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
          const rawIdx = Math.floor((x / rect.width) * slotCount)
          const idx = Math.max(0, Math.min(rawIdx, slotCount - 1))
          setHoveredSlotIdx((prev) => (prev === idx ? prev : idx))
        }}
        onMouseLeave={() => setHoveredSlotIdx(null)}
        onClick={(event) => {
          if (dragInProgress) return
          if (!containerRef.current) return
          if (isSlotAvailable) {
            const rect = containerRef.current.getBoundingClientRect()
            if (!rect.width) return
            const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
            const rawIdx = Math.floor((x / rect.width) * slotCount)
            const idx = Math.max(0, Math.min(rawIdx, slotCount - 1))
            const slot = slots[idx]
            if (slot && !isSlotAvailable(slot)) return
          }
          onEmptyClick(event.clientX, containerRef.current)
        }}
        aria-label={resourceTitle ? `Timeline row for ${resourceTitle}` : "Timeline row"}
      >
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}>
          {slots.map((slot, idx) => {
            const isHour = getMinutesInTimeZone(slot, timeZone) % 60 === 0
            const available = isSlotAvailable ? isSlotAvailable(slot) : true
            return (
              <div
                key={slot.toISOString()}
                className={cn(
                  "last:border-r-0 border-r transition-colors",
                  available ? "cursor-pointer hover:bg-sky-500/10" : "cursor-not-allowed bg-muted/20",
                  available && idx % 2 === 1 ? "bg-muted/[0.03]" : "",
                  available && isHour ? "bg-muted/[0.05]" : ""
                )}
              />
            )
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 hidden sm:block">
        {!dragInProgress && hoveredSlot && hoveredTimeLabel ? (
          <div
            className="absolute z-10"
            style={{
              left: `${((hoveredSlotIdx ?? 0) + 0.5) * (100 / Math.max(1, slotCount))}%`,
              top: -6,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div
              className={cn(
                "relative rounded-md px-2 py-1 text-[11px] font-medium tabular-nums shadow-lg ring-1 backdrop-blur",
                "after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-[6px] after:border-transparent",
                hoveredAvailable
                  ? "bg-slate-900/90 text-white ring-white/10 after:border-t-slate-900/90"
                  : "bg-muted-foreground/90 text-white ring-white/10 after:border-t-muted-foreground/90"
              )}
            >
              {hoveredAvailable ? "Create booking from " : "Unavailable at "}
              <span className="font-semibold">{hoveredTimeLabel}</span>
            </div>
          </div>
        ) : null}
      </div>

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

          const label = booking.primaryLabel
          const range = formatTimeRangeLabel(item.startAt, item.endAt, timeZone)
          const previewTimeLabel = item.isPreview
            ? formatTimeRangeLabel12h(item.startAt, item.endAt, timeZone)
            : null

          return (
            <div
              key={booking.id}
              className="pointer-events-auto absolute inset-y-0"
              style={{
                left: `${layout.leftPct}%`,
                width: `max(${layout.widthPct}%, 2%)`,
              }}
            >
              <div className="relative h-full">
                {item.isPreview && previewTimeLabel ? (
                  <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[105%]">
                    <div
                      className={cn(
                        "rounded-md px-2 py-1 text-[10px] font-semibold whitespace-nowrap shadow-md ring-1 backdrop-blur",
                        item.previewValid
                          ? "bg-slate-900/90 text-white ring-white/20"
                          : "bg-destructive/90 text-white ring-white/20"
                      )}
                    >
                      {item.previewValid ? "New time " : "Unavailable "}
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
                            if (!canDragBookings || event.button !== 0) return
                            if (!containerRef.current) return

                            const rect = containerRef.current.getBoundingClientRect()
                            if (!rect.width || slotCount <= 0) return

                            const slotWidth = rect.width / slotCount
                            const bookingStartPx = (layout.leftPct / 100) * rect.width
                            const rawOffsetSlots = Math.floor(
                              (event.clientX - rect.left - bookingStartPx) / Math.max(1, slotWidth)
                            )
                            const durationMs = item.endAt.getTime() - item.startAt.getTime()
                            const durationSlots = Math.max(1, Math.ceil(durationMs / (INTERVAL_MINUTES * 60_000)))
                            const pointerOffsetSlots = clamp(
                              rawOffsetSlots,
                              0,
                              Math.max(0, durationSlots - 1)
                            )

                            onBookingPointerDown({
                              booking,
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
                            onBookingClick(booking)
                          }}
                          className={cn(
                            "group h-full w-full rounded-md px-2 text-left shadow-sm ring-1 ring-black/5 transition-all hover:brightness-[1.02] hover:shadow-md focus:ring-2 focus:ring-blue-500/40 focus:outline-none",
                            statusPillClasses(booking.status),
                            canDragBookings ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                            item.isPreview
                              ? item.previewValid
                                ? "cursor-grabbing ring-2 ring-emerald-300/80 shadow-lg"
                                : "cursor-not-allowed opacity-70 ring-2 ring-destructive/70"
                              : ""
                          )}
                        >
                          <div className="flex h-full flex-col justify-center">
                            <div className="truncate text-xs font-semibold leading-tight">{label}</div>
                            {item.isPreview && previewTimeLabel ? (
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
                          className={cn("absolute left-0 top-0 h-full w-1.5", statusIndicatorClasses(booking.status))}
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

                          <div className="pt-0.5 text-[11px] text-muted-foreground">
                            {booking.canOpen
                              ? canDragBookings
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
                      <ContextMenuItem onClick={() => router.push(`/members/${booking.userId}`)}>
                        <UserCircle className="h-4 w-4" />
                        View Contact Details
                      </ContextMenuItem>
                    ) : null}
                    {booking.canCancel || booking.canConfirm ? (
                      <>
                        <ContextMenuSeparator />
                        {booking.canCancel ? (
                          <ContextMenuItem onClick={() => onCancelBooking(booking)} variant="destructive">
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
        })}
      </div>
    </div>
  )
}
