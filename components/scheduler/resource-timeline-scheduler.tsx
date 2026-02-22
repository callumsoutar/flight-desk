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

type MinutesWindow = { startMin: number; endMin: number }
type TimelineConfig = { startMin: number; endMin: number; intervalMinutes: number }

const INTERVAL_MINUTES = 30
const ROW_HEIGHT = 34
const GROUP_HEIGHT = 28
const LEFT_COL_WIDTH = "w-[160px] sm:w-[240px] lg:w-[280px]"

const timeFormatterCache = new Map<string, Intl.DateTimeFormat>()
const time12FormatterCache = new Map<string, Intl.DateTimeFormat>()
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

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

function formatTimeLabel12h(d: Date, timeZone: string) {
  return getTime12Formatter(timeZone).format(d).toLowerCase()
}

function parseDateKeyParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
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
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false)
  const [isNavigating, startNavigation] = React.useTransition()
  const openModalTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (openModalTimerRef.current !== null) {
        window.clearTimeout(openModalTimerRef.current)
      }
    }
  }, [])

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

  const bookings = React.useMemo(() => {
    const viewer = { userId: user?.id ?? null, isStaff }
    return data.bookings
      .map((booking) => bookingToSchedulerBooking(booking, viewer))
      .filter((value): value is SchedulerBooking => value !== null)
  }, [data.bookings, isStaff, user?.id])

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
                        height={ROW_HEIGHT}
                        slotCount={slotCount}
                        slots={slots}
                        timelineStart={timelineStart}
                        timelineEnd={timelineEnd}
                        timeZone={data.timeZone}
                        bookings={rowBookings}
                        resourceTitle={getResourceTitle(resource)}
                        isSlotAvailable={(slot) => isMinutesWithinAnyWindow(getMinutesInTimeZone(slot, data.timeZone), windows)}
                        onEmptyClick={(clientX, container) => handleEmptySlotClick({ resource, clientX, container })}
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
                        height={ROW_HEIGHT}
                        slotCount={slotCount}
                        slots={slots}
                        timelineStart={timelineStart}
                        timelineEnd={timelineEnd}
                        timeZone={data.timeZone}
                        bookings={rowBookings}
                        resourceTitle={getResourceTitle(resource)}
                        onEmptyClick={(clientX, container) => handleEmptySlotClick({ resource, clientX, container })}
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
  height,
  slotCount,
  slots,
  timelineStart,
  timelineEnd,
  bookings,
  resourceTitle,
  isSlotAvailable,
  onEmptyClick,
  onBookingClick,
  onStatusUpdate,
  onCancelBooking,
  timeZone,
}: {
  height: number
  slotCount: number
  slots: Date[]
  timelineStart: Date
  timelineEnd: Date
  bookings: SchedulerBooking[]
  resourceTitle?: string
  isSlotAvailable?: (slot: Date) => boolean
  onEmptyClick: (clientX: number, container: HTMLDivElement) => void
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

  return (
    <div className="relative" style={{ height }}>
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-default"
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
        {hoveredSlot && hoveredTimeLabel ? (
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
        {bookings.map((booking) => {
          const layout = getBookingLayout({
            bookingStart: booking.startsAt,
            bookingEnd: booking.endsAt,
            timelineStart,
            timelineEnd,
          })
          if (!layout) return null

          const label = booking.primaryLabel
          const range = formatTimeRangeLabel(booking.startsAt, booking.endsAt, timeZone)

          return (
            <div
              key={booking.id}
              className="pointer-events-auto absolute inset-y-0"
              style={{
                left: `${layout.leftPct}%`,
                width: `max(${layout.widthPct}%, 2%)`,
              }}
            >
              <ContextMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ContextMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onBookingClick(booking)
                        }}
                        className={cn(
                          "group h-full w-full cursor-pointer rounded-md px-2 text-left shadow-sm ring-1 ring-black/5 transition-all hover:brightness-[1.02] hover:shadow-md focus:ring-2 focus:ring-blue-500/40 focus:outline-none",
                          statusPillClasses(booking.status)
                        )}
                      >
                        <div className="flex h-full flex-col justify-center">
                          <div className="truncate text-xs font-semibold leading-tight">{label}</div>
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
                          {booking.canOpen ? "Click to open booking" : "Busy slot"}
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
          )
        })}
      </div>
    </div>
  )
}
