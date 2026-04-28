import type { MemberFlightHistoryEntry } from "@/lib/types/flight-history"
import { formatDate } from "@/lib/utils/date-format"

export type MemberFlightHistorySummaryRow = {
  id: string
  dateLabel: string
  aircraftLabel: string
  instructorLabel: string
  description: string
  flightTimeLabel: string
  isSolo: boolean
}

export type MemberFlightHistorySummaryStats = {
  totalFlights: number
  totalFlightHours: number
  avgHoursPerFlight: number
}

export type MemberFlightHistorySummaryData = {
  rows: MemberFlightHistorySummaryRow[]
  stats: MemberFlightHistorySummaryStats
}

const datePartsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function getDatePartsFormatter(timeZone: string) {
  const key = `date-only:${timeZone}`
  const existing = datePartsFormatterCache.get(key)
  if (existing) return existing

  const formatter = new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  datePartsFormatterCache.set(key, formatter)
  return formatter
}

function toSafeNumber(value: string | number | null | undefined) {
  if (value == null) return 0
  const next = typeof value === "string" ? Number(value) : value
  return Number.isFinite(next) ? next : 0
}

function sanitizeFilenameSegment(value: string) {
  const trimmed = value.trim().replace(/\s+/g, "-")
  const safe = trimmed.replace(/[^a-zA-Z0-9_-]/g, "")
  return safe || "member"
}

export function getFlightDateKey(
  value: string | Date | null | undefined,
  timeZone: string
): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const parts = getDatePartsFormatter(timeZone).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
}

export function formatDateOnlyLabel(dateValue: string, timeZone: string) {
  return formatDate(`${dateValue}T00:00:00.000Z`, timeZone, "medium") || dateValue
}

export function getInstructorName(flight: MemberFlightHistoryEntry): string {
  const firstName = flight.instructor?.user?.first_name ?? flight.instructor?.first_name ?? ""
  const lastName = flight.instructor?.user?.last_name ?? flight.instructor?.last_name ?? ""
  const fullName = `${firstName} ${lastName}`.trim()
  return fullName || "Instructor"
}

export function getFlightHours(flight: MemberFlightHistoryEntry): number {
  return toSafeNumber(flight.billing_hours)
}

export function getFlightHoursDisplay(flight: MemberFlightHistoryEntry): string {
  const value = flight.billing_hours
  if (value == null) return "-"
  const raw = String(value)
  return raw.includes(".") ? raw : `${raw}.0`
}

export function getAircraftLabel(flight: MemberFlightHistoryEntry): string {
  return (
    flight.aircraft?.registration ||
    (flight.aircraft?.id ? `Aircraft ${flight.aircraft.id.slice(0, 8)}` : "Aircraft")
  )
}

export function getFlightDescription(flight: MemberFlightHistoryEntry): string {
  return flight.lesson?.name || flight.flight_type?.name || flight.purpose || "Flight"
}

export function filterMemberFlightHistoryEntries(
  flights: MemberFlightHistoryEntry[],
  fromDate: string,
  toDate: string,
  timeZone: string
) {
  return flights.filter((flight) => {
    const dateKey = getFlightDateKey(flight.end_time, timeZone)
    if (!dateKey) return false
    return dateKey >= fromDate && dateKey <= toDate
  })
}

export function buildMemberFlightHistorySummaryData(
  flights: MemberFlightHistoryEntry[],
  timeZone: string
): MemberFlightHistorySummaryData {
  const rows = flights.map((flight) => {
    const isSolo = !flight.instructor

    return {
      id: flight.id,
      dateLabel: flight.end_time ? formatDate(flight.end_time, timeZone) || "—" : "—",
      aircraftLabel: getAircraftLabel(flight),
      instructorLabel: isSolo ? "Solo" : getInstructorName(flight),
      description: getFlightDescription(flight),
      flightTimeLabel: `${getFlightHoursDisplay(flight)}h`,
      isSolo,
    }
  })

  const totalFlightHours = flights.reduce((total, flight) => total + getFlightHours(flight), 0)
  const avgHoursPerFlight = flights.length > 0 ? totalFlightHours / flights.length : 0

  return {
    rows,
    stats: {
      totalFlights: flights.length,
      totalFlightHours,
      avgHoursPerFlight,
    },
  }
}

export function buildMemberFlightHistoryDateRangeLabel(
  fromDate: string,
  toDate: string,
  timeZone: string
) {
  return `${formatDateOnlyLabel(fromDate, timeZone)} to ${formatDateOnlyLabel(toDate, timeZone)}`
}

export function buildMemberFlightHistoryPdfFilename(
  memberName: string,
  fromDate: string,
  toDate: string
) {
  const safeMemberName = sanitizeFilenameSegment(memberName)
  return `flight-history-${safeMemberName}-${fromDate}-to-${toDate}.pdf`
}
