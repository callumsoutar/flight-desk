"use client"

import type { BookingsSettings } from "@/lib/settings/bookings-settings"

type BookingsSettingsResponse = { settings: BookingsSettings }

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function updateBookingsSettings(input: {
  bookings: {
    default_booking_duration_hours: number
    minimum_booking_duration_minutes: number
    default_booking_briefing_charge_enabled: boolean
    default_booking_briefing_chargeable_id: string | null
    aircraft_daily_available_hours: number
  }
}) {
  const response = await fetch("/api/settings/bookings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update booking settings"))
  }
  return (await response.json()) as BookingsSettingsResponse
}
