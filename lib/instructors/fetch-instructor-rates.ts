import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { InstructorRateWithFlightType } from "@/lib/types/instructors"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function fetchInstructorRates(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  instructorId: string
): Promise<InstructorRateWithFlightType[]> {
  const { data, error } = await supabase
    .from("instructor_flight_type_rates")
    .select(
      "id, instructor_id, flight_type_id, rate, currency, effective_from, flight_type:flight_types!instructor_flight_type_rates_flight_type_id_fkey(id, name, instruction_type)"
    )
    .eq("tenant_id", tenantId)
    .eq("instructor_id", instructorId)
    .order("effective_from", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    instructor_id: row.instructor_id,
    flight_type_id: row.flight_type_id,
    rate: row.rate,
    currency: row.currency,
    effective_from: row.effective_from,
    flight_type: pickMaybeOne(row.flight_type),
  }))
}
