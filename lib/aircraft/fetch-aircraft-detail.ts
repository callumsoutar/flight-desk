import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type {
  AircraftDetailData,
  FlightEntry,
  MaintenanceVisitWithUser,
  ObservationWithUsers,
} from "@/lib/types/aircraft-detail"
import type { AircraftComponentsRow } from "@/lib/types/tables"

const BOOKING_DETAIL_SELECT = `
  id,
  user_id,
  instructor_id,
  checked_out_aircraft_id,
  checked_out_instructor_id,
  start_time,
  end_time,
  status,
  purpose,
  hobbs_start,
  hobbs_end,
  tach_start,
  tach_end,
  flight_time,
  created_at
` as const

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
    .maybeSingle()

  if (aircraftError) throw aircraftError
  if (!aircraftRow) return { data: null, loadErrors: [] }

  const [flightsResult, maintenanceResult, observationsResult, componentsResult] =
    await Promise.all([
      supabase
        .from("bookings")
        .select(BOOKING_DETAIL_SELECT)
        .eq("tenant_id", tenantId)
        .eq("aircraft_id", aircraftId)
        .order("start_time", { ascending: false })
        .limit(100),
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
  if (flightsResult.error) loadErrors.push("flight history")
  if (maintenanceResult.error) loadErrors.push("maintenance history")
  if (observationsResult.error) loadErrors.push("observations")
  if (componentsResult.error) loadErrors.push("maintenance items")

  const flights: FlightEntry[] = (flightsResult.data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    instructor_id: row.instructor_id,
    checked_out_aircraft_id: row.checked_out_aircraft_id,
    checked_out_instructor_id: row.checked_out_instructor_id,
    start_time: row.start_time,
    end_time: row.end_time,
    status: row.status,
    purpose: row.purpose,
    hobbs_start: row.hobbs_start,
    hobbs_end: row.hobbs_end,
    tach_start: row.tach_start,
    tach_end: row.tach_end,
    flight_time: row.flight_time,
    created_at: row.created_at,
    student: null,
    instructor: null,
    flight_type: null,
    lesson: null,
  }))

  const data: AircraftDetailData = {
    aircraft: aircraftRow as AircraftWithType,
    flights,
    maintenanceVisits: (maintenanceResult.data ?? []) as MaintenanceVisitWithUser[],
    observations: (observationsResult.data ?? []) as ObservationWithUsers[],
    components: (componentsResult.data ?? []) as AircraftComponentsRow[],
  }

  return { data, loadErrors }
}
