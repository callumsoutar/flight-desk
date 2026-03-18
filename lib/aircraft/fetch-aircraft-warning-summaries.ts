import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { buildAircraftWarnings } from "@/lib/aircraft/aircraft-warning-utils"
import type { Database } from "@/lib/types"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type { SchedulerAircraftWarningSummary } from "@/lib/types/scheduler"
import { zonedTodayYyyyMmDd } from "@/lib/utils/timezone"

function createEmptySummary(): SchedulerAircraftWarningSummary {
  return {
    status: "clear",
    has_blockers: false,
    total_count: 0,
    blocking_count: 0,
    counts: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    warnings: [],
  }
}

export async function fetchAircraftWarningSummaries({
  supabase,
  tenantId,
  timeZone,
  aircraft,
}: {
  supabase: SupabaseClient<Database>
  tenantId: string
  timeZone: string
  aircraft: AircraftWithType[]
}): Promise<Record<string, SchedulerAircraftWarningSummary>> {
  if (aircraft.length === 0) return {}

  const aircraftIds = aircraft.map((item) => item.id)
  const todayKey = zonedTodayYyyyMmDd(timeZone)

  const [componentsResult, observationsResult, maintenanceVisitsResult] = await Promise.all([
    supabase
      .from("aircraft_components")
      .select("id, aircraft_id, name, current_due_date, current_due_hours, notes")
      .eq("tenant_id", tenantId)
      .in("aircraft_id", aircraftIds)
      .eq("status", "active")
      .is("voided_at", null),
    supabase
      .from("observations")
      .select("id, aircraft_id, name, priority, stage, reported_date")
      .eq("tenant_id", tenantId)
      .in("aircraft_id", aircraftIds)
      .neq("stage", "closed")
      .order("reported_date", { ascending: false }),
    supabase
      .from("maintenance_visits")
      .select("id, aircraft_id, description, scheduled_for, visit_date")
      .eq("tenant_id", tenantId)
      .in("aircraft_id", aircraftIds)
      .is("date_out_of_maintenance", null)
      .order("scheduled_for", { ascending: false }),
  ])

  if (componentsResult.error) throw componentsResult.error
  if (observationsResult.error) throw observationsResult.error
  if (maintenanceVisitsResult.error) throw maintenanceVisitsResult.error

  const componentsByAircraftId = new Map<string, NonNullable<typeof componentsResult.data>>()
  for (const component of componentsResult.data ?? []) {
    const items = componentsByAircraftId.get(component.aircraft_id) ?? []
    items.push(component)
    componentsByAircraftId.set(component.aircraft_id, items)
  }

  const observationsByAircraftId = new Map<string, NonNullable<typeof observationsResult.data>>()
  for (const observation of observationsResult.data ?? []) {
    const items = observationsByAircraftId.get(observation.aircraft_id) ?? []
    items.push(observation)
    observationsByAircraftId.set(observation.aircraft_id, items)
  }

  const maintenanceByAircraftId = new Map<string, NonNullable<typeof maintenanceVisitsResult.data>>()
  for (const visit of maintenanceVisitsResult.data ?? []) {
    const items = maintenanceByAircraftId.get(visit.aircraft_id) ?? []
    items.push(visit)
    maintenanceByAircraftId.set(visit.aircraft_id, items)
  }

  const warningsByAircraftId: Record<string, SchedulerAircraftWarningSummary> = {}

  for (const aircraftItem of aircraft) {
    const warnings = buildAircraftWarnings({
      aircraft: {
        id: aircraftItem.id,
        registration: aircraftItem.registration,
        on_line: aircraftItem.on_line,
        total_time_in_service: aircraftItem.total_time_in_service,
      },
      components: componentsByAircraftId.get(aircraftItem.id) ?? [],
      observations: observationsByAircraftId.get(aircraftItem.id) ?? [],
      maintenanceVisits: maintenanceByAircraftId.get(aircraftItem.id) ?? [],
      todayKey,
    })

    const summary = createEmptySummary()
    summary.warnings = warnings
    summary.total_count = warnings.length

    for (const warning of warnings) {
      summary.counts[warning.severity] += 1
      if (warning.blocking) summary.blocking_count += 1
    }

    summary.has_blockers = summary.blocking_count > 0
    summary.status = summary.has_blockers ? "blocked" : summary.total_count > 0 ? "warning" : "clear"
    warningsByAircraftId[aircraftItem.id] = summary
  }

  return warningsByAircraftId
}
