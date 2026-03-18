import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { AircraftTechLogResponse, AircraftTechLogRow } from "@/lib/types/aircraft-tech-log"

const DEFAULT_TIME_ZONE = "Pacific/Auckland"

function normalizeTimeZone(value: string | null | undefined): string {
  if (!value) return DEFAULT_TIME_ZONE
  try {
    new Intl.DateTimeFormat("en-NZ", { timeZone: value }).format(new Date())
    return value
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

export async function fetchTenantTimeZone(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<string> {
  const { data } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .maybeSingle()

  return normalizeTimeZone(data?.timezone)
}

type FetchAircraftTechLogParams = {
  aircraftId: string
  tenantId: string
  page?: number
  pageSize?: number
  timeZone?: string
}

export async function fetchAircraftTechLog(
  supabase: SupabaseClient<Database>,
  {
    aircraftId,
    tenantId,
    page = 1,
    pageSize = 25,
    timeZone,
  }: FetchAircraftTechLogParams
): Promise<AircraftTechLogResponse> {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1
  const safePageSize = Number.isFinite(pageSize)
    ? Math.min(100, Math.max(1, Math.floor(pageSize)))
    : 25
  const offset = (safePage - 1) * safePageSize

  const resolvedTimeZone = normalizeTimeZone(
    timeZone ?? (await fetchTenantTimeZone(supabase, tenantId))
  )

  const { data, error } = await supabase.rpc("get_aircraft_tech_log", {
    p_aircraft_id: aircraftId,
    p_time_zone: resolvedTimeZone,
    p_limit: safePageSize,
    p_offset: offset,
  })

  if (error) throw error

  const rows: AircraftTechLogRow[] = (data ?? []).map((row) => ({
    tech_log_date: row.tech_log_date,
    latest_reading: row.latest_reading,
    daily_delta: row.daily_delta,
    daily_ttis_delta: row.daily_ttis_delta,
    computed_ttis: row.computed_ttis,
    reading_source: row.reading_source === "tacho" ? "tacho" : "hobbs",
    total_time_method: row.total_time_method,
    latest_entry_at: row.latest_entry_at,
    entry_count: row.entry_count ?? 0,
  }))

  const totalRows = data?.[0]?.total_rows ?? 0

  return {
    rows,
    page: safePage,
    pageSize: safePageSize,
    totalRows,
    totalPages: totalRows > 0 ? Math.ceil(totalRows / safePageSize) : 0,
    timeZone: resolvedTimeZone,
  }
}
