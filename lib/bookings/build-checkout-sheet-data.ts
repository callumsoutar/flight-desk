import type { BookingWarningItem } from "@/lib/types/booking-warnings"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type { AircraftRow } from "@/lib/types/tables"

import type { CheckoutSheetData, NoticeType, SystemNotice } from "@/components/bookings/checkout-sheet"

type AircraftLite = Pick<AircraftRow, "registration" | "type" | "model" | "manufacturer">

function formatMember(user: {
  first_name: string | null
  last_name: string | null
  email: string | null
}) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "—"
}

function formatInstructorFromBooking(booking: BookingWithRelations): string {
  const inst =
    booking.status === "flying" && booking.checked_out_instructor ? booking.checked_out_instructor : booking.instructor

  if (!inst) return "—"

  const nameFromUser =
    inst.user ?
      [inst.user.first_name, inst.user.last_name].filter(Boolean).join(" ") || inst.user.email
    : ""

  const nameDirect = [inst.first_name, inst.last_name].filter(Boolean).join(" ")
  return nameFromUser || nameDirect || "—"
}

export function formatAircraftLabel(aircraft: AircraftLite | null): string {
  if (!aircraft) return "—"
  const label = [aircraft.manufacturer, aircraft.model].filter(Boolean).join(" ").trim()
  if (label.length) return label
  if (aircraft.type) return aircraft.type
  return aircraft.registration || "—"
}

export function resolveCheckoutAircraft(booking: BookingWithRelations): AircraftLite | null {
  return booking.checked_out_aircraft ?? booking.aircraft
}

function buildFlightDescription(booking: BookingWithRelations): string {
  const parts: string[] = []

  if (booking.flight_type?.name) parts.push(booking.flight_type.name)
  if (booking.lesson?.name) parts.push(booking.lesson.name)

  const purpose = booking.purpose?.trim()
  if (purpose) parts.push(purpose)

  const unique = [...new Set(parts)]
  return unique.length ? unique.join(" — ") : "Flight"
}

function warningSeverityToNoticeType(severity: BookingWarningItem["severity"]): NoticeType {
  if (severity === "critical") return "critical"
  if (severity === "high") return "warning"
  return "info"
}

function flattenWarnings(bookingWarnings: { groups: { warnings: BookingWarningItem[] }[] }): SystemNotice[] {
  const items = bookingWarnings.groups.flatMap((g) => g.warnings)
  return items.map((w) => ({
    type: warningSeverityToNoticeType(w.severity),
    message: w.detail.trim().length ? `${w.title}: ${w.detail}` : w.title,
  }))
}

export function formatCheckoutSheetPrintedAt(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now)
}

export function formatCheckoutSheetBookingDate(startTimeIso: string, timeZone: string): string {
  const date = new Date(startTimeIso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

export type BuildCheckoutSheetDataArgs = {
  booking: BookingWithRelations
  /** Staff view warnings; member/student view may be filtered — still safe to show on sheet */
  bookingWarnings: { groups: { warnings: BookingWarningItem[] }[] }
  timeZone: string
  printedAt?: Date
  clubName?: string
  logoUrl?: string | null
}

export function buildCheckoutSheetData({
  booking,
  bookingWarnings,
  timeZone,
  printedAt = new Date(),
  clubName,
  logoUrl,
}: BuildCheckoutSheetDataArgs): CheckoutSheetData {
  const aircraft = resolveCheckoutAircraft(booking)

  return {
    aircraft: formatAircraftLabel(aircraft),
    registration: aircraft?.registration ?? "—",
    instructor: formatInstructorFromBooking(booking),
    member: booking.student ? formatMember(booking.student) : "—",
    flightDescription: buildFlightDescription(booking),
    date: formatCheckoutSheetBookingDate(booking.start_time, timeZone),
    printedAt: formatCheckoutSheetPrintedAt(printedAt, timeZone),
    systemNotices: flattenWarnings(bookingWarnings),
    logoUrl: logoUrl ?? null,
    clubName,
  }
}
