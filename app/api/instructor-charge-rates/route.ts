import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

type RateResponse = {
  id: string
  instructor_id: string
  flight_type_id: string
  rate_per_hour: number
  charge_hobbs: boolean
  charge_tacho: boolean
  charge_airswitch: boolean
  effective_from: string | null
}

function toRateResponse(row: {
  id: string
  instructor_id: string
  flight_type_id: string
  rate: number
  effective_from: string | null
}): RateResponse {
  return {
    id: row.id,
    instructor_id: row.instructor_id,
    flight_type_id: row.flight_type_id,
    rate_per_hour: row.rate,
    // Instructor rates in this schema do not carry meter-basis flags.
    // Default to Hobbs so clients expecting legacy flags can still function.
    charge_hobbs: true,
    charge_tacho: false,
    charge_airswitch: false,
    effective_from: row.effective_from,
  }
}

export async function GET(request: NextRequest) {
  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const instructorId = request.nextUrl.searchParams.get("instructor_id")
  if (!instructorId) {
    return noStoreJson({ error: "instructor_id is required" }, { status: 400 })
  }

  const flightTypeId = request.nextUrl.searchParams.get("flight_type_id")

  if (flightTypeId) {
    const { data, error } = await supabase
      .from("instructor_flight_type_rates")
      .select("id, instructor_id, flight_type_id, rate, effective_from")
      .eq("tenant_id", tenantId)
      .eq("instructor_id", instructorId)
      .eq("flight_type_id", flightTypeId)
      .order("effective_from", { ascending: false })
      .maybeSingle()

    if (error) {
      return noStoreJson({ error: "Failed to fetch instructor charge rate" }, { status: 500 })
    }

    return noStoreJson({ charge_rate: data ? toRateResponse(data) : null })
  }

  const { data, error } = await supabase
    .from("instructor_flight_type_rates")
    .select("id, instructor_id, flight_type_id, rate, effective_from")
    .eq("tenant_id", tenantId)
    .eq("instructor_id", instructorId)
    .order("effective_from", { ascending: false })

  if (error) {
    return noStoreJson({ error: "Failed to fetch instructor charge rates" }, { status: 500 })
  }

  return noStoreJson({ rates: (data ?? []).map(toRateResponse) })
}
