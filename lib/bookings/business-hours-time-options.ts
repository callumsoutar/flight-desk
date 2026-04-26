import { parseTimeToMinutes } from "@/lib/roster/availability"
import type { BusinessHoursSettings } from "@/lib/settings/general-settings"

const HALF_HOUR = 30

function minutesToHHmm(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function halfHourSlotsInclusive(startMin: number, endMin: number): string[] {
  const times: string[] = []
  for (let t = startMin; t <= endMin; t += HALF_HOUR) {
    times.push(minutesToHHmm(t))
  }
  return times
}

/** Full day in 30-minute steps (00:00 … 23:30). */
export function buildFullDayHalfHourTimeOptions(): string[] {
  return halfHourSlotsInclusive(0, 24 * 60 - HALF_HOUR)
}

/**
 * Half-hour booking time slots derived from tenant business hours.
 * Matches scheduler timeline `buildTimelineConfig` in `resource-timeline-scheduler.tsx`.
 */
export function buildHalfHourTimeOptionsFromBusinessHours(
  businessHours: Pick<BusinessHoursSettings, "openTime" | "closeTime" | "is24Hours" | "isClosed">
): string[] {
  if (businessHours.is24Hours || businessHours.isClosed) {
    return buildFullDayHalfHourTimeOptions()
  }

  const openMin = parseTimeToMinutes(businessHours.openTime)
  const closeMin = parseTimeToMinutes(businessHours.closeTime)
  if (openMin === null || closeMin === null) {
    return halfHourSlotsInclusive(7 * 60, 19 * 60)
  }

  if (closeMin <= openMin) {
    return buildFullDayHalfHourTimeOptions()
  }

  return halfHourSlotsInclusive(openMin, closeMin)
}

/** Keeps selects usable when an existing booking time falls outside the current option list. */
export function ensureHhmmInTimeOptions(options: string[], hhmm: string | null | undefined): string[] {
  if (!hhmm) return options
  if (options.includes(hhmm)) return options
  return [...options, hhmm].sort((a, b) => (parseTimeToMinutes(a) ?? 0) - (parseTimeToMinutes(b) ?? 0))
}
