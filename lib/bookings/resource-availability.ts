import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { BookingStatus } from "@/lib/types/bookings"

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "unconfirmed",
  "confirmed",
  "briefing",
  "flying",
  "complete",
]

export async function fetchUnavailableResourceIds({
  supabase,
  tenantId,
  startTimeIso,
  endTimeIso,
  excludeBookingId,
}: {
  supabase: SupabaseClient<Database>
  tenantId: string
  startTimeIso: string
  endTimeIso: string
  excludeBookingId?: string
}) {
  let query = supabase
    .from("bookings")
    .select("id, aircraft_id, instructor_id")
    .eq("tenant_id", tenantId)
    .lt("start_time", endTimeIso)
    .gt("end_time", startTimeIso)
    .in("status", ACTIVE_BOOKING_STATUSES)

  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId)
  }

  const { data, error } = await query
  if (error) throw error

  const unavailableAircraftIds = new Set<string>()
  const unavailableInstructorIds = new Set<string>()

  for (const booking of data ?? []) {
    if (booking.aircraft_id) unavailableAircraftIds.add(booking.aircraft_id)
    if (booking.instructor_id) unavailableInstructorIds.add(booking.instructor_id)
  }

  return {
    unavailableAircraftIds: [...unavailableAircraftIds],
    unavailableInstructorIds: [...unavailableInstructorIds],
  }
}
