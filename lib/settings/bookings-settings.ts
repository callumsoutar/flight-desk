import type { Json } from "@/lib/types"
import { isJsonObject, normalizeNonNegativeInt } from "@/lib/settings/utils"

export type BookingsSettings = {
  default_booking_duration_hours: number
  minimum_booking_duration_minutes: number
}

export const DEFAULT_BOOKINGS_SETTINGS: BookingsSettings = {
  default_booking_duration_hours: 2,
  minimum_booking_duration_minutes: 30,
}

function normalizeNonNegativeNumber(value: unknown, fallback: number, max: number) {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN
  if (!Number.isFinite(raw)) return fallback
  if (raw < 0) return fallback
  return Math.min(max, raw)
}

function roundToQuarterHour(value: number) {
  return Math.round(value * 4) / 4
}

export function resolveBookingsSettings(settings: Json | null | undefined): BookingsSettings {
  if (!isJsonObject(settings)) return DEFAULT_BOOKINGS_SETTINGS

  return {
    default_booking_duration_hours: roundToQuarterHour(
      normalizeNonNegativeNumber(
        settings.default_booking_duration_hours,
        DEFAULT_BOOKINGS_SETTINGS.default_booking_duration_hours,
        24
      )
    ),
    minimum_booking_duration_minutes: normalizeNonNegativeInt(
      settings.minimum_booking_duration_minutes,
      DEFAULT_BOOKINGS_SETTINGS.minimum_booking_duration_minutes,
      1440
    ),
  }
}

