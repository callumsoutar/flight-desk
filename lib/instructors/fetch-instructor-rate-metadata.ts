import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { InstructorFlightTypeLite } from "@/lib/types/instructors"

export type InstructorRateMetadata = {
  flightTypes: InstructorFlightTypeLite[]
  defaultTaxRate: number | null
}

export async function fetchInstructorRateMetadata(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<InstructorRateMetadata> {
  const today = new Date().toISOString().slice(0, 10)
  const [flightTypesResult, taxResult] = await Promise.all([
    supabase
      .from("flight_types")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .is("voided_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("tax_rates")
      .select("rate")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .eq("is_default", true)
      .lte("effective_from", today)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (flightTypesResult.error) throw flightTypesResult.error
  if (taxResult.error) throw taxResult.error

  return {
    flightTypes: (flightTypesResult.data ?? []) as InstructorFlightTypeLite[],
    defaultTaxRate: taxResult.data?.rate ?? null,
  }
}
