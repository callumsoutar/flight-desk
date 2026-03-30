import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { callSupabaseRpc } from "@/lib/reports/call-supabase-rpc"
import { fetchBookingsSettings } from "@/lib/settings/fetch-bookings-settings"
import type { AircraftUtilisationDashboard, HoursByFlightTypeRow, StaffDashboard } from "@/lib/types/reports"
import type { Database } from "@/lib/types"

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

export async function getStaffDashboard(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<StaffDashboard | null> {
  try {
    const { data, error } = await callSupabaseRpc(supabase, "get_staff_dashboard", {
      p_tenant_id: tenantId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    })
    if (error || data == null) return null

    const raw = data as unknown as StaffDashboard
    return {
      dual_hours_salary: asNumber(raw.dual_hours_salary),
      dual_hours_contractor: asNumber(raw.dual_hours_contractor),
      instructors: ensureArray(raw.instructors).map((item) => ({
        ...item,
        dual_hours: asNumber(item.dual_hours),
        solo_hours: asNumber(item.solo_hours),
        flights: asNumber(item.flights),
        unique_students: asNumber(item.unique_students),
        instruction_revenue: asNumber(item.instruction_revenue),
      })),
    students_per_instructor: ensureArray(raw.students_per_instructor).map((item) => ({
        ...item,
        student_count: asNumber(item.student_count),
        students: ensureArray(item.students),
      })),
    }
  } catch {
    return null
  }
}

export async function getAircraftUtilisationDashboard(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<AircraftUtilisationDashboard | null> {
  try {
    const settings = await fetchBookingsSettings(supabase, tenantId)
    const dailyAvailableHours = settings.aircraft_daily_available_hours ?? 10

    const { data, error } = await callSupabaseRpc(supabase, "get_aircraft_utilisation_dashboard", {
      p_tenant_id: tenantId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_daily_available_hours: dailyAvailableHours,
    })
    if (error || data == null) return null

    const raw = data as unknown as AircraftUtilisationDashboard
    return {
      period_days: asNumber(raw.period_days, 1),
      daily_available_hours: asNumber(raw.daily_available_hours, dailyAvailableHours),
      aircraft: ensureArray(raw.aircraft).map((row) => ({
        ...row,
        current_ttis: asNumber(row.current_ttis),
        hours_flown: asNumber(row.hours_flown),
        maintenance_days: asNumber(row.maintenance_days),
        available_hours: asNumber(row.available_hours),
        utilisation_pct: asNumber(row.utilisation_pct),
        hire_revenue: asNumber(row.hire_revenue),
        flights: asNumber(row.flights),
        open_observations: asNumber(row.open_observations),
      })),
      monthly_by_aircraft: ensureArray(raw.monthly_by_aircraft).map((row) => ({
        ...row,
        hours_flown: asNumber(row.hours_flown),
      })),
    }
  } catch {
    return null
  }
}

export async function getHoursByFlightType(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<HoursByFlightTypeRow[]> {
  try {
    const { data, error } = await callSupabaseRpc(supabase, "get_hours_by_flight_type", {
      p_tenant_id: tenantId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    })
    if (error || data == null) return []

    return ensureArray(data as unknown as HoursByFlightTypeRow[]).map((row) => ({
      ...row,
      flights: asNumber(row.flights),
      total_hours: asNumber(row.total_hours),
      dual_hours: asNumber(row.dual_hours),
      solo_hours: asNumber(row.solo_hours),
      pct_of_total: asNumber(row.pct_of_total),
    }))
  } catch {
    return []
  }
}
