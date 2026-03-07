import {
  formatDate as centralFormatDate,
  formatDateTime as centralFormatDateTime,
} from "@/lib/utils/date-format"
import type { FlightEntry } from "@/lib/types/aircraft-detail"

export function formatDate(value: string | null | undefined, timeZone: string): string {
  return centralFormatDate(value, timeZone, "medium") || "—"
}

export function formatDateTime(value: string | null | undefined, timeZone: string): string {
  return centralFormatDateTime(value, timeZone, "medium") || "—"
}

export function formatTotalHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "0.0h"
  return `${hours.toFixed(1)}h`
}

export function personName(
  value:
    | {
        first_name: string | null
        last_name: string | null
        email?: string | null
      }
    | null
    | undefined
): string {
  if (!value) return "—"

  const full = [value.first_name, value.last_name].filter(Boolean).join(" ").trim()
  if (full.length) return full
  if (value.email) return value.email
  return "—"
}

export function flightInstructorName(flight: FlightEntry): string {
  const nested = personName(flight.instructor?.user)
  if (nested !== "—") return nested
  return personName(flight.instructor)
}
