"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  IconAlertTriangle,
  IconCalendar,
  IconCalendarStats,
  IconChevronRight,
  IconClock,
  IconDotsVertical,
  IconFlag,
  IconInfoCircle,
  IconPencil,
  IconPlane,
  IconSchool,
  IconTool,
  IconUser,
  IconX,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTimezone } from "@/contexts/timezone-context"
import { cancelBookingMutation } from "@/hooks/use-booking-query"
import { cn } from "@/lib/utils"
import { formatDate, formatTime } from "@/lib/utils/date-format"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type {
  MaintenanceVisitWithUser,
  UpcomingBookingEntry,
} from "@/lib/types/aircraft-detail"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type { AircraftComponentsRow } from "@/lib/types/tables"
import type { CancelBookingPayload } from "@/components/bookings/cancel-booking-modal"

const CancelBookingModal = dynamic(
  () =>
    import("@/components/bookings/cancel-booking-modal").then(
      (mod) => mod.CancelBookingModal
    ),
  { ssr: false }
)

type Props = {
  aircraft: AircraftWithType
  upcomingBookings: UpcomingBookingEntry[]
  upcomingMaintenance: MaintenanceVisitWithUser[]
  components: AircraftComponentsRow[]
}

type UserLite = {
  first_name: string | null
  last_name: string | null
  email?: string | null
}

type RangePreset = "7" | "30" | "90" | "all"

// Estimated ratio of airborne flight hours to wall-clock booking duration.
// Real-world flight training rarely uses the full booking window — typical
// circuit and training sorties spend roughly half the booked time airborne
// once you factor in pre-flight, taxi, briefing, debriefing, etc.
const BOOKING_TO_FLIGHT_RATIO = 0.5
const RATIO_PERCENT_LABEL = `${Math.round(BOOKING_TO_FLIGHT_RATIO * 100)}%`

const RANGE_OPTIONS: Array<{ id: RangePreset; label: string; days: number | null }> = [
  { id: "7", label: "Next 7 days", days: 7 },
  { id: "30", label: "Next 30 days", days: 30 },
  { id: "90", label: "Next 90 days", days: 90 },
  { id: "all", label: "All upcoming", days: null },
]

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function diffDays(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function getUserName(user: UserLite | null | undefined): string {
  if (!user) return "—"
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ")
  return name || user.email || "—"
}

function getInstructorName(booking: UpcomingBookingEntry): string {
  const instructor = booking.instructor
  if (!instructor) return "—"
  const firstName = instructor.user?.first_name ?? instructor.first_name
  const lastName = instructor.user?.last_name ?? instructor.last_name
  const fullName = [firstName, lastName].filter(Boolean).join(" ")
  return fullName || instructor.user?.email || "—"
}

function getPlannedHours(booking: UpcomingBookingEntry): number {
  if (!booking.start_time || !booking.end_time) return 0
  const start = new Date(booking.start_time).getTime()
  const end = new Date(booking.end_time).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0
  return (end - start) / (1000 * 60 * 60)
}

function getForecastFlightHours(
  booking: UpcomingBookingEntry,
  plannedHours: number
): number {
  // Maintenance windows don't add flight hours; ground-based bookings don't
  // accrue TTIS either. Everything else is estimated at the configured ratio.
  if (
    booking.booking_type === "maintenance" ||
    booking.booking_type === "groundwork" ||
    booking.booking_type === "other"
  ) {
    return 0
  }
  return plannedHours * BOOKING_TO_FLIGHT_RATIO
}

function getDescription(booking: UpcomingBookingEntry): string {
  if (booking.booking_type === "maintenance") return "Maintenance"
  if (booking.booking_type === "groundwork") {
    return booking.lesson?.name || booking.purpose || "Groundwork"
  }
  return (
    booking.lesson?.name ||
    booking.flight_type?.name ||
    booking.purpose ||
    (booking.booking_type === "other" ? "Other" : "Flight")
  )
}

function statusBadge(status: UpcomingBookingEntry["status"]) {
  switch (status) {
    case "unconfirmed":
      return { label: "Unconfirmed", classes: "border-amber-200 bg-amber-50 text-amber-800" }
    case "confirmed":
      return { label: "Confirmed", classes: "border-emerald-200 bg-emerald-50 text-emerald-800" }
    case "briefing":
      return { label: "Briefing", classes: "border-sky-200 bg-sky-50 text-sky-800" }
    case "flying":
      return { label: "Flying", classes: "border-indigo-200 bg-indigo-50 text-indigo-800" }
    default:
      return { label: status, classes: "border-slate-200 bg-slate-50 text-slate-700" }
  }
}

function bookingTypeBadge(type: UpcomingBookingEntry["booking_type"]) {
  switch (type) {
    case "maintenance":
      return { label: "Maintenance", classes: "border-rose-200 bg-rose-50 text-rose-800" }
    case "groundwork":
      return { label: "Groundwork", classes: "border-violet-200 bg-violet-50 text-violet-800" }
    case "other":
      return { label: "Other", classes: "border-slate-200 bg-slate-50 text-slate-700" }
    default:
      return null
  }
}

function relativeDayLabel(date: Date, today: Date): string {
  const delta = diffDays(date, today)
  if (delta === 0) return "Today"
  if (delta === 1) return "Tomorrow"
  if (delta > 1 && delta < 7) {
    return new Intl.DateTimeFormat("en-NZ", { weekday: "long" }).format(date)
  }
  return ""
}

type ConflictKind = "maintenance_overlap" | "exceeds_due_hours"

type EnrichedBooking = UpcomingBookingEntry & {
  plannedHours: number
  forecastFlightHours: number
  cumulativeTtis: number | null
  conflicts: Array<{ kind: ConflictKind; message: string }>
}

function getMaintenanceWindow(visit: MaintenanceVisitWithUser): {
  start: Date | null
  end: Date | null
} {
  const startSource = visit.scheduled_for ?? visit.visit_date
  const endSource = visit.scheduled_end ?? visit.scheduled_for ?? visit.visit_date
  const start = startSource ? new Date(startSource) : null
  const end = endSource ? new Date(endSource) : null
  return {
    start: start && !Number.isNaN(start.getTime()) ? start : null,
    end: end && !Number.isNaN(end.getTime()) ? end : null,
  }
}

function getNextDueHours(
  components: AircraftComponentsRow[],
  currentTtis: number
): { value: number; component: AircraftComponentsRow } | null {
  let best: { value: number; component: AircraftComponentsRow } | null = null
  for (const c of components) {
    if (c.current_due_hours == null) continue
    const due = Number(c.current_due_hours)
    if (!Number.isFinite(due)) continue
    if (due <= currentTtis) continue
    if (!best || due < best.value) {
      best = { value: due, component: c }
    }
  }
  return best
}

function toCancelModalBooking(
  booking: UpcomingBookingEntry,
  aircraft: AircraftWithType
): BookingWithRelations {
  // CancelBookingModal only reads a small subset of fields; cast through
  // unknown so we don't have to fabricate every column on BookingRow.
  return {
    ...booking,
    aircraft: {
      id: aircraft.id,
      registration: aircraft.registration,
      type: aircraft.type,
    },
  } as unknown as BookingWithRelations
}

export function AircraftUpcomingBookingsTab({
  aircraft,
  upcomingBookings,
  upcomingMaintenance,
  components,
}: Props) {
  const router = useRouter()
  const { timeZone } = useTimezone()
  const [range, setRange] = React.useState<RangePreset>("30")
  const [cancelTarget, setCancelTarget] = React.useState<EnrichedBooking | null>(
    null
  )
  const [isCancelling, setIsCancelling] = React.useState(false)

  const handleNavigateToBooking = React.useCallback(
    (id: string) => {
      router.push(`/bookings/${id}`)
    },
    [router]
  )

  const handleEditBooking = React.useCallback(
    (booking: EnrichedBooking) => {
      router.push(`/bookings/${booking.id}`)
    },
    [router]
  )

  const handleOpenCancel = React.useCallback((booking: EnrichedBooking) => {
    setCancelTarget(booking)
  }, [])

  const handleConfirmCancel = React.useCallback(
    async (payload: CancelBookingPayload) => {
      if (!cancelTarget) return
      setIsCancelling(true)
      try {
        await cancelBookingMutation({
          bookingId: cancelTarget.id,
          cancellationCategoryId: payload.cancellationCategoryId,
          cancellationReason: payload.cancellationReason,
          cancelledNotes: payload.cancelledNotes,
        })
        toast.success("Booking cancelled")
        setCancelTarget(null)
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to cancel booking"
        )
      } finally {
        setIsCancelling(false)
      }
    },
    [cancelTarget, router]
  )

  const now = React.useMemo(() => new Date(), [])
  const today = React.useMemo(() => startOfDay(now), [now])
  const rangeEnd = React.useMemo(() => {
    const option = RANGE_OPTIONS.find((o) => o.id === range)
    if (!option || option.days == null) return null
    return endOfDay(addDays(today, option.days - 1))
  }, [range, today])

  const filteredMaintenance = React.useMemo(() => {
    return upcomingMaintenance.filter((visit) => {
      const { start, end } = getMaintenanceWindow(visit)
      const reference = end ?? start
      if (!reference) return false
      if (reference < now) return false
      if (rangeEnd && (start ?? reference) > rangeEnd) return false
      return true
    })
  }, [upcomingMaintenance, now, rangeEnd])

  const enrichedBookings = React.useMemo<EnrichedBooking[]>(() => {
    const currentTtis = aircraft.total_time_in_service ?? 0
    const dueInfo = getNextDueHours(components, currentTtis)

    let cumulative = currentTtis

    const sorted = [...upcomingBookings]
      .filter((b) => {
        if (!b.start_time) return false
        const start = new Date(b.start_time)
        if (Number.isNaN(start.getTime())) return false
        if (rangeEnd && start > rangeEnd) return false
        return true
      })
      .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime())

    return sorted.map((booking) => {
      const plannedHours = getPlannedHours(booking)
      const forecastFlightHours = getForecastFlightHours(booking, plannedHours)
      const conflicts: EnrichedBooking["conflicts"] = []

      if (booking.start_time && booking.end_time) {
        const bStart = new Date(booking.start_time).getTime()
        const bEnd = new Date(booking.end_time).getTime()
        for (const visit of upcomingMaintenance) {
          const { start: vStart, end: vEnd } = getMaintenanceWindow(visit)
          if (!vStart) continue
          const vStartMs = vStart.getTime()
          const vEndMs = (vEnd ?? vStart).getTime()
          if (bStart < vEndMs && bEnd > vStartMs) {
            conflicts.push({
              kind: "maintenance_overlap",
              message: `Overlaps maintenance: ${visit.description || visit.visit_type}`,
            })
            break
          }
        }
      }

      // Forecast threshold: only airborne flight hours accrue TTIS.
      cumulative += forecastFlightHours

      if (
        dueInfo &&
        booking.booking_type !== "groundwork" &&
        booking.booking_type !== "other" &&
        cumulative > dueInfo.value
      ) {
        conflicts.push({
          kind: "exceeds_due_hours",
          message: `Forecast TTIS reaches ${cumulative.toFixed(1)}h after this booking — exceeds ${
            dueInfo.component.name
          } due at ${dueInfo.value.toFixed(1)}h`,
        })
      }

      return {
        ...booking,
        plannedHours,
        forecastFlightHours,
        cumulativeTtis: cumulative,
        conflicts,
      }
    })
  }, [aircraft.total_time_in_service, components, upcomingBookings, upcomingMaintenance, rangeEnd])

  const totalForecastHours = React.useMemo(
    () => enrichedBookings.reduce((sum, b) => sum + b.forecastFlightHours, 0),
    [enrichedBookings]
  )
  const conflictCount = React.useMemo(
    () => enrichedBookings.filter((b) => b.conflicts.length > 0).length,
    [enrichedBookings]
  )
  const nextBooking = enrichedBookings[0] ?? null

  const groupedByDay = React.useMemo(() => {
    const groups = new Map<
      string,
      { date: Date; label: string; secondaryLabel: string; bookings: EnrichedBooking[] }
    >()
    for (const booking of enrichedBookings) {
      if (!booking.start_time) continue
      const date = new Date(booking.start_time)
      const day = startOfDay(date)
      const key = day.toISOString()
      const existing = groups.get(key)
      if (existing) {
        existing.bookings.push(booking)
        continue
      }
      const relative = relativeDayLabel(day, today)
      const formatted = formatDate(day, timeZone, "long") || formatDate(day, timeZone)
      groups.set(key, {
        date: day,
        label: relative || formatted,
        secondaryLabel: relative ? formatted : "",
        bookings: [booking],
      })
    }
    return Array.from(groups.values())
  }, [enrichedBookings, today, timeZone])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Upcoming Bookings</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Forecast utilisation and surface conflicts before maintenance windows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.id}
                variant={range === option.id ? "default" : "outline"}
                size="sm"
                onClick={() => setRange(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<IconCalendar className="h-5 w-5 text-indigo-600" />}
            label="Bookings"
            value={enrichedBookings.length.toString()}
          />
          <StatCard
            icon={<IconClock className="h-5 w-5 text-blue-600" />}
            label="Forecast hours"
            value={`${totalForecastHours.toFixed(1)}h`}
            info={
              <div className="space-y-1.5">
                <p className="font-semibold">Estimated airborne hours</p>
                <p>
                  We estimate flight hours at {RATIO_PERCENT_LABEL} of booked
                  duration. Training bookings rarely fly the full window once
                  pre-flight, taxi, briefing and debrief are accounted for.
                </p>
              </div>
            }
          />
          <StatCard
            icon={<IconCalendarStats className="h-5 w-5 text-emerald-600" />}
            label="Next booking"
            value={
              nextBooking?.start_time
                ? formatDate(nextBooking.start_time, timeZone, "short") || "—"
                : "—"
            }
            sub={
              nextBooking
                ? `${formatTime(nextBooking.start_time, timeZone)} · ${getUserName(nextBooking.student)}`
                : "No bookings in range"
            }
          />
          <StatCard
            icon={
              <IconAlertTriangle
                className={cn(
                  "h-5 w-5",
                  conflictCount > 0 ? "text-rose-600" : "text-slate-400"
                )}
              />
            }
            label="Conflicts"
            value={conflictCount.toString()}
            valueClassName={conflictCount > 0 ? "text-rose-700" : undefined}
          />
        </div>

        {filteredMaintenance.length > 0 ? (
          <MaintenanceConflictBanner
            visits={filteredMaintenance}
            bookings={enrichedBookings}
            timeZone={timeZone}
          />
        ) : null}

        <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  When
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  Member
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  Instructor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  Purpose
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  Duration
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  Flags
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedByDay.length === 0 ? (
                <tr>
                  <td colSpan={8} className="h-24 text-center font-medium text-slate-500">
                    No upcoming bookings in this range.
                  </td>
                </tr>
              ) : (
                groupedByDay.map((group) => (
                  <React.Fragment key={group.date.toISOString()}>
                    <tr className="bg-slate-50/70">
                      <td
                        colSpan={8}
                        className="px-4 py-2 text-xs font-semibold tracking-wide text-slate-700 uppercase"
                      >
                        <div className="flex items-baseline gap-2">
                          <span>{group.label}</span>
                          {group.secondaryLabel ? (
                            <span className="text-[11px] font-medium normal-case text-slate-500">
                              {group.secondaryLabel}
                            </span>
                          ) : null}
                          <span className="ml-auto text-[11px] font-medium normal-case text-slate-500">
                            {group.bookings.length} booking
                            {group.bookings.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.bookings.map((booking) => (
                      <BookingRow
                        key={booking.id}
                        booking={booking}
                        timeZone={timeZone}
                        onOpen={handleNavigateToBooking}
                        onEdit={handleEditBooking}
                        onCancel={handleOpenCancel}
                      />
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <CancelBookingModal
          open={cancelTarget !== null}
          onOpenChange={(open) => {
            if (!open && !isCancelling) setCancelTarget(null)
          }}
          booking={cancelTarget ? toCancelModalBooking(cancelTarget, aircraft) : null}
          pending={isCancelling}
          onConfirm={(payload) => {
            void handleConfirmCancel(payload)
          }}
        />

        <div className="space-y-4 md:hidden">
          {groupedByDay.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center">
              <div className="mb-4 font-medium text-slate-500">
                No upcoming bookings in this range
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/scheduler">
                  <IconCalendar className="mr-2 h-4 w-4" />
                  Open Scheduler
                </Link>
              </Button>
            </div>
          ) : (
            groupedByDay.map((group) => (
              <div key={group.date.toISOString()} className="space-y-2">
                <div className="flex items-baseline gap-2 px-1">
                  <span className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                    {group.label}
                  </span>
                  {group.secondaryLabel ? (
                    <span className="text-[11px] text-slate-500">{group.secondaryLabel}</span>
                  ) : null}
                </div>
                {group.bookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    timeZone={timeZone}
                    onEdit={handleEditBooking}
                    onCancel={handleOpenCancel}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
  valueClassName,
  info,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  valueClassName?: string
  info?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {label}
          </span>
          {info ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`About ${label}`}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  <IconInfoCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                {info}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        {icon}
      </div>
      <div className={cn("text-2xl font-semibold tracking-tight text-slate-900", valueClassName)}>
        {value}
      </div>
      {sub ? <div className="truncate text-xs text-slate-500">{sub}</div> : null}
    </div>
  )
}

function MaintenanceConflictBanner({
  visits,
  bookings,
  timeZone,
}: {
  visits: MaintenanceVisitWithUser[]
  bookings: EnrichedBooking[]
  timeZone: string
}) {
  const annotated = visits.map((visit) => {
    const { start, end } = getMaintenanceWindow(visit)
    const overlapping = bookings.filter((b) => {
      if (!b.start_time || !b.end_time || !start) return false
      const bStart = new Date(b.start_time).getTime()
      const bEnd = new Date(b.end_time).getTime()
      const vStart = start.getTime()
      const vEnd = (end ?? start).getTime()
      return bStart < vEnd && bEnd > vStart
    })
    return { visit, start, end, overlapping }
  })

  const totalAffected = annotated.reduce((sum, v) => sum + v.overlapping.length, 0)

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
          <IconTool className="h-4 w-4 text-amber-700" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {visits.length} maintenance window{visits.length === 1 ? "" : "s"} scheduled in this range
            </p>
            <p className="text-xs text-amber-800">
              {totalAffected === 0
                ? "No bookings overlap — all clear."
                : `${totalAffected} booking${totalAffected === 1 ? "" : "s"} overlap and may need to be rescheduled.`}
            </p>
          </div>
          <ul className="space-y-1.5 text-xs text-amber-900">
            {annotated.map(({ visit, start, end, overlapping }) => (
              <li
                key={visit.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-amber-200/70 bg-white/60 px-3 py-2"
              >
                <span className="font-semibold">{visit.description || visit.visit_type}</span>
                <span className="text-amber-800">
                  {start ? formatDate(start, timeZone, "short") : "TBC"}
                  {end && start && end.getTime() !== start.getTime()
                    ? ` – ${formatDate(end, timeZone, "short")}`
                    : ""}
                </span>
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    overlapping.length > 0
                      ? "bg-rose-100 text-rose-800"
                      : "bg-emerald-100 text-emerald-800"
                  )}
                >
                  {overlapping.length} affected
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function BookingRow({
  booking,
  timeZone,
  onOpen,
  onEdit,
  onCancel,
}: {
  booking: EnrichedBooking
  timeZone: string
  onOpen: (id: string) => void
  onEdit: (booking: EnrichedBooking) => void
  onCancel: (booking: EnrichedBooking) => void
}) {
  const status = statusBadge(booking.status)
  const typeBadge = bookingTypeBadge(booking.booking_type)
  const isMaintenance = booking.booking_type === "maintenance"
  const isSolo = !booking.instructor && !isMaintenance
  const description = getDescription(booking)

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onOpen(booking.id)
    }
  }

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={() => onOpen(booking.id)}
      onKeyDown={handleRowKeyDown}
      className={cn(
        "group cursor-pointer transition-colors hover:bg-slate-50/80 focus-visible:bg-slate-50 focus-visible:outline-none",
        isMaintenance && "bg-rose-50/40"
      )}
    >
      <td className="px-4 py-3.5 align-middle">
        <div className="flex flex-col">
          <span className="font-mono text-sm font-semibold text-slate-900">
            {formatTime(booking.start_time, timeZone)}
          </span>
          {booking.end_time ? (
            <span className="text-xs text-slate-500">
              ends {formatTime(booking.end_time, timeZone)}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3.5 align-middle">
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className={cn("w-fit px-2 py-0.5 text-xs font-medium", status.classes)}>
            {status.label}
          </Badge>
          {typeBadge ? (
            <Badge
              variant="outline"
              className={cn("w-fit px-2 py-0.5 text-[11px] font-medium", typeBadge.classes)}
            >
              {typeBadge.label}
            </Badge>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3.5 align-middle">
        {isMaintenance ? (
          <span className="text-sm text-slate-500">—</span>
        ) : (
          <div className="flex items-center gap-2">
            <IconUser className="h-4 w-4 text-slate-500" />
            <span className="font-semibold text-slate-900">{getUserName(booking.student)}</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3.5 align-middle">
        {isMaintenance ? (
          <span className="text-sm text-slate-500">—</span>
        ) : isSolo ? (
          <Badge
            variant="outline"
            className="border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
          >
            Solo
          </Badge>
        ) : (
          <div className="flex items-center gap-2">
            <IconSchool className="h-4 w-4 text-slate-500" />
            <span className="font-medium text-slate-700">{getInstructorName(booking)}</span>
          </div>
        )}
      </td>
      <td className="max-w-[220px] px-4 py-3.5 align-middle">
        <span className="block truncate text-sm text-slate-700" title={description}>
          {description}
        </span>
      </td>
      <td className="px-4 py-3.5 text-right align-middle">
        <span className="font-mono font-semibold text-slate-900">
          {booking.plannedHours > 0 ? `${booking.plannedHours.toFixed(1)}h` : "—"}
        </span>
      </td>
      <td className="px-4 py-3.5 text-center align-middle">
        <ConflictIndicators conflicts={booking.conflicts} />
      </td>
      <td
        className="px-4 py-3.5 text-center align-middle"
        onClick={(event) => event.stopPropagation()}
      >
        <BookingRowMenu
          booking={booking}
          isMaintenance={isMaintenance}
          onEdit={onEdit}
          onCancel={onCancel}
        />
      </td>
    </tr>
  )
}

function BookingRowMenu({
  booking,
  isMaintenance,
  onEdit,
  onCancel,
}: {
  booking: EnrichedBooking
  isMaintenance: boolean
  onEdit: (booking: EnrichedBooking) => void
  onCancel: (booking: EnrichedBooking) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Booking actions"
          onClick={(event) => event.stopPropagation()}
        >
          <IconDotsVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            onEdit(booking)
          }}
        >
          <IconPencil className="mr-2 h-4 w-4" />
          Edit booking
        </DropdownMenuItem>
        {!isMaintenance ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => {
                event.preventDefault()
                onCancel(booking)
              }}
            >
              <IconX className="mr-2 h-4 w-4" />
              Cancel booking
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ConflictIndicators({ conflicts }: { conflicts: EnrichedBooking["conflicts"] }) {
  if (conflicts.length === 0) {
    return <span className="text-xs text-slate-400">—</span>
  }
  return (
    <div className="flex items-center justify-center gap-1.5">
      {conflicts.map((conflict, idx) => {
        const isOverlap = conflict.kind === "maintenance_overlap"
        const Icon = isOverlap ? IconTool : IconFlag
        return (
          <Tooltip key={`${conflict.kind}-${idx}`}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full",
                  isOverlap ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {conflict.message}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

function BookingCard({
  booking,
  timeZone,
  onEdit,
  onCancel,
}: {
  booking: EnrichedBooking
  timeZone: string
  onEdit: (booking: EnrichedBooking) => void
  onCancel: (booking: EnrichedBooking) => void
}) {
  const status = statusBadge(booking.status)
  const typeBadge = bookingTypeBadge(booking.booking_type)
  const isMaintenance = booking.booking_type === "maintenance"
  const isSolo = !booking.instructor && !isMaintenance
  const description = getDescription(booking)
  const hasConflicts = booking.conflicts.length > 0

  return (
    <Link
      href={`/bookings/${booking.id}`}
      className={cn(
        "relative block overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50",
        isMaintenance && "bg-rose-50/40"
      )}
    >
      <div
        className="absolute top-3 right-3 z-10"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <BookingRowMenu
          booking={booking}
          isMaintenance={isMaintenance}
          onEdit={onEdit}
          onCancel={onCancel}
        />
      </div>
      <div
        className={cn(
          "absolute top-0 bottom-0 left-0 w-1 rounded-l-lg",
          isMaintenance ? "bg-rose-500" : "bg-indigo-600"
        )}
      />
      <div className="space-y-3 pl-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              {isMaintenance ? (
                <IconTool className="h-4 w-4 text-rose-600" />
              ) : (
                <IconUser className="h-4 w-4 text-slate-500" />
              )}
              <h4 className="truncate font-semibold text-slate-900">
                {isMaintenance ? "Maintenance" : getUserName(booking.student)}
              </h4>
            </div>
            <p className="truncate text-xs text-slate-600">{description}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge
              variant="outline"
              className={cn("px-2 py-0.5 text-xs font-medium", status.classes)}
            >
              {status.label}
            </Badge>
            {typeBadge ? (
              <Badge
                variant="outline"
                className={cn("px-2 py-0.5 text-[11px] font-medium", typeBadge.classes)}
              >
                {typeBadge.label}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-semibold tracking-wide text-slate-500 uppercase">When</div>
            <div className="font-mono text-sm font-semibold text-slate-900">
              {formatTime(booking.start_time, timeZone)}
              {booking.end_time ? `-${formatTime(booking.end_time, timeZone)}` : ""}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="font-semibold tracking-wide text-slate-500 uppercase">Duration</div>
            <div className="font-mono text-sm font-semibold text-slate-900">
              {booking.plannedHours > 0 ? `${booking.plannedHours.toFixed(1)}h` : "—"}
            </div>
          </div>
          {!isMaintenance ? (
            <div className="col-span-2 space-y-0.5">
              <div className="font-semibold tracking-wide text-slate-500 uppercase">
                Instructor
              </div>
              <div className="text-sm text-slate-700">
                {isSolo ? (
                  <Badge
                    variant="outline"
                    className="border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                  >
                    Solo
                  </Badge>
                ) : (
                  getInstructorName(booking)
                )}
              </div>
            </div>
          ) : null}
        </div>

        {hasConflicts ? (
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
            {booking.conflicts.map((c, idx) => {
              const isOverlap = c.kind === "maintenance_overlap"
              return (
                <span
                  key={`${c.kind}-${idx}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    isOverlap
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  )}
                >
                  {isOverlap ? <IconTool className="h-3 w-3" /> : <IconFlag className="h-3 w-3" />}
                  {c.message}
                </span>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="absolute right-4 bottom-4">
        <IconChevronRight className="h-4 w-4 text-slate-400" />
      </div>
      <span className="sr-only">
        <IconPlane className="h-4 w-4" />
      </span>
    </Link>
  )
}
