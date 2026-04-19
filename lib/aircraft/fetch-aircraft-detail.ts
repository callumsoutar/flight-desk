import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { fetchBookings } from "@/lib/bookings/fetch-bookings"
import type { Database } from "@/lib/types"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type {
  AircraftDetailData,
  FlightEntry,
  MaintenanceVisitWithUser,
  ObservationWithUsers,
  UpcomingBookingEntry,
} from "@/lib/types/aircraft-detail"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type { AircraftComponentsRow } from "@/lib/types/tables"

function mapBookingsToFlightEntries(bookings: BookingWithRelations[]): FlightEntry[] {
  return bookings
    .filter((b) => b.status === "complete")
    .map((b) => ({
    id: b.id,
    user_id: b.user_id,
    instructor_id: b.instructor_id,
    checked_out_aircraft_id: b.checked_out_aircraft_id,
    checked_out_instructor_id: b.checked_out_instructor_id,
    start_time: b.start_time,
    end_time: b.end_time,
    status: b.status,
    purpose: b.purpose,
    hobbs_start: b.hobbs_start,
    hobbs_end: b.hobbs_end,
    tach_start: b.tach_start,
    tach_end: b.tach_end,
    billing_hours: b.billing_hours,
    created_at: b.created_at,
    student: b.student,
    instructor: b.instructor,
    flight_type: b.flight_type ? { id: b.flight_type.id, name: b.flight_type.name } : null,
    lesson: b.lesson ? { id: b.lesson.id, name: b.lesson.name } : null,
  }))
}

function mapBookingsToUpcomingEntries(bookings: BookingWithRelations[]): UpcomingBookingEntry[] {
  return bookings.map((b) => ({
    id: b.id,
    user_id: b.user_id,
    instructor_id: b.instructor_id,
    start_time: b.start_time,
    end_time: b.end_time,
    status: b.status,
    booking_type: b.booking_type,
    purpose: b.purpose,
    created_at: b.created_at,
    student: b.student,
    instructor: b.instructor,
    flight_type: b.flight_type ? { id: b.flight_type.id, name: b.flight_type.name } : null,
    lesson: b.lesson ? { id: b.lesson.id, name: b.lesson.name } : null,
  }))
}

export async function fetchAircraftDetail(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  aircraftId: string
): Promise<{ data: AircraftDetailData | null; loadErrors: string[] }> {
  const { data: aircraftRow, error: aircraftError } = await supabase
    .from("aircraft")
    .select("*, aircraft_type:aircraft_types(id, name, category)")
    .eq("tenant_id", tenantId)
    .eq("id", aircraftId)
    .is("voided_at", null)
    .maybeSingle()

  if (aircraftError) throw aircraftError
  if (!aircraftRow) return { data: null, loadErrors: [] }

  const nowIso = new Date().toISOString()

  const [
    bookingsResult,
    upcomingBookingsResult,
    maintenanceResult,
    observationsResult,
    componentsResult,
  ] = await Promise.all([
      fetchBookings(supabase, tenantId, {
        aircraft_id: aircraftId,
        status: ["complete"],
        start_time_order: "desc",
        limit: 100,
      })
        .then((bookings) => ({ ok: true as const, bookings }))
        .catch(() => ({ ok: false as const, bookings: [] as BookingWithRelations[] })),
      fetchBookings(supabase, tenantId, {
        aircraft_id: aircraftId,
        status: ["unconfirmed", "confirmed", "briefing", "flying"],
        start_date: nowIso,
        start_time_order: "asc",
        limit: 200,
      })
        .then((bookings) => ({ ok: true as const, bookings }))
        .catch(() => ({ ok: false as const, bookings: [] as BookingWithRelations[] })),
      supabase
        .from("maintenance_visits")
        .select(
          "*, performed_by_user:user_directory!maintenance_visits_performed_by_fkey(id, first_name, last_name, email)"
        )
        .eq("tenant_id", tenantId)
        .eq("aircraft_id", aircraftId)
        .order("visit_date", { ascending: false })
        .limit(100),
      supabase
        .from("observations")
        .select(
          "*, reported_by_user:user_directory!observations_reported_by_fkey(id, first_name, last_name, email), assigned_to_user:user_directory!observations_assigned_to_fkey(id, first_name, last_name, email)"
        )
        .eq("tenant_id", tenantId)
        .eq("aircraft_id", aircraftId)
        .order("reported_date", { ascending: false })
        .limit(200),
      supabase
        .from("aircraft_components")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("aircraft_id", aircraftId)
        .is("voided_at", null)
        .order("name", { ascending: true }),
    ])

  const loadErrors: string[] = []
  if (!bookingsResult.ok) loadErrors.push("flight history")
  if (!upcomingBookingsResult.ok) loadErrors.push("upcoming bookings")
  if (maintenanceResult.error) loadErrors.push("maintenance history")
  if (observationsResult.error) loadErrors.push("observations")
  if (componentsResult.error) loadErrors.push("maintenance items")

  const flights: FlightEntry[] = bookingsResult.ok
    ? mapBookingsToFlightEntries(bookingsResult.bookings)
    : []

  const upcomingBookings: UpcomingBookingEntry[] = upcomingBookingsResult.ok
    ? mapBookingsToUpcomingEntries(upcomingBookingsResult.bookings)
    : []

  const allMaintenance = (maintenanceResult.data ?? []) as MaintenanceVisitWithUser[]
  const upcomingMaintenance = allMaintenance.filter((visit) => {
    if (visit.date_out_of_maintenance) return false
    const candidate = visit.scheduled_end ?? visit.scheduled_for ?? visit.visit_date
    if (!candidate) return false
    const candidateDate = new Date(candidate)
    if (Number.isNaN(candidateDate.getTime())) return false
    return candidateDate.getTime() >= Date.now()
  })

  const data: AircraftDetailData = {
    aircraft: aircraftRow as AircraftWithType,
    flights,
    upcomingBookings,
    upcomingMaintenance,
    maintenanceVisits: allMaintenance,
    observations: (observationsResult.data ?? []) as ObservationWithUsers[],
    components: (componentsResult.data ?? []) as AircraftComponentsRow[],
  }

  return { data, loadErrors }
}
