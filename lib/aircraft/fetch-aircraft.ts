import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { AircraftFilter, AircraftWithType } from "@/lib/types/aircraft"

export async function fetchAircraft(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  filters?: AircraftFilter
): Promise<AircraftWithType[]> {
  const search = filters?.search?.trim()

  let query = supabase
    .from("aircraft")
    .select("*, aircraft_type:aircraft_types(id, name, category)")
    .eq("tenant_id", tenantId)
    .order("order", { ascending: true })
    .order("registration", { ascending: true })

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  if (filters?.aircraft_type_id) {
    query = query.eq("aircraft_type_id", filters.aircraft_type_id)
  }

  if (search) {
    const normalized = search.replaceAll(",", " ")
    query = query.or(
      [
        `registration.ilike.%${normalized}%`,
        `manufacturer.ilike.%${normalized}%`,
        `model.ilike.%${normalized}%`,
        `type.ilike.%${normalized}%`,
      ].join(",")
    )
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []) as AircraftWithType[]
}
