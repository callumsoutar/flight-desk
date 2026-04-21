import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const createSchema = z.strictObject({
  aircraft_id: z.string().uuid(),
  flight_type_id: z.string().uuid(),
  rate_per_hour: z.number().nonnegative(),
  fixed_package_price: z.number().positive().nullable().optional(),
  charge_hobbs: z.boolean().optional(),
  charge_tacho: z.boolean().optional(),
  charge_airswitch: z.boolean().optional(),
})

const updateSchema = z.strictObject({
  id: z.string().uuid(),
  flight_type_id: z.string().uuid().optional(),
  rate_per_hour: z.number().nonnegative().optional(),
  fixed_package_price: z.number().positive().nullable().optional(),
  charge_hobbs: z.boolean().optional(),
  charge_tacho: z.boolean().optional(),
  charge_airswitch: z.boolean().optional(),
})

const deleteSchema = z.strictObject({
  id: z.string().uuid(),
})

type ValidateRefsResult =
  | { ok: true; flightType: { id: string; billing_mode: string } }
  | { ok: false; message: "Aircraft not found" | "Flight type not found" }

async function validateReferences(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  aircraftId: string,
  flightTypeId: string
): Promise<ValidateRefsResult> {
  const [aircraftResult, flightTypeResult] = await Promise.all([
    supabase
      .from("aircraft")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", aircraftId)
      .is("voided_at", null)
      .maybeSingle(),
    supabase
      .from("flight_types")
      .select("id, billing_mode")
      .eq("tenant_id", tenantId)
      .eq("id", flightTypeId)
      .is("voided_at", null)
      .maybeSingle(),
  ])

  if (aircraftResult.error || !aircraftResult.data) {
    return { ok: false, message: "Aircraft not found" }
  }
  if (flightTypeResult.error || !flightTypeResult.data) {
    return { ok: false, message: "Flight type not found" }
  }

  return { ok: true, flightType: flightTypeResult.data }
}

export async function GET(request: NextRequest) {
  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const aircraftId = request.nextUrl.searchParams.get("aircraft_id")
  const flightTypeId = request.nextUrl.searchParams.get("flight_type_id")

  if (!aircraftId && flightTypeId) {
    const { data, error } = await supabase
      .from("aircraft_charge_rates")
      .select(
        "id, aircraft_id, flight_type_id, rate_per_hour, fixed_package_price, charge_hobbs, charge_tacho, charge_airswitch, updated_at, created_at"
      )
      .eq("tenant_id", tenantId)
      .eq("flight_type_id", flightTypeId)
      .order("created_at", { ascending: true })

    if (error) {
      return noStoreJson({ error: "Failed to fetch aircraft charge rates" }, { status: 500 })
    }

    return noStoreJson({ rates: data ?? [] })
  }

  if (!aircraftId) {
    return noStoreJson({ error: "aircraft_id is required" }, { status: 400 })
  }

  if (flightTypeId) {
    const { data, error } = await supabase
      .from("aircraft_charge_rates")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("aircraft_id", aircraftId)
      .eq("flight_type_id", flightTypeId)
      .order("created_at", { ascending: false })
      .maybeSingle()

    if (error) {
      return noStoreJson({ error: "Failed to fetch aircraft charge rate" }, { status: 500 })
    }

    return noStoreJson({ charge_rate: data ?? null })
  }

  const { data, error } = await supabase
    .from("aircraft_charge_rates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("aircraft_id", aircraftId)
    .order("created_at", { ascending: true })

  if (error) {
    return noStoreJson({ error: "Failed to fetch aircraft charge rates" }, { status: 500 })
  }

  return noStoreJson({ rates: data ?? [] })
}

export async function POST(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ access: "staff" })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data
  const referenceCheck = await validateReferences(
    supabase,
    tenantId,
    payload.aircraft_id,
    payload.flight_type_id
  )
  if (!referenceCheck.ok) {
    return noStoreJson({ error: referenceCheck.message }, { status: 404 })
  }

  const billingMode = referenceCheck.flightType.billing_mode as "hourly" | "fixed_package"
  let ratePerHour = payload.rate_per_hour
  let fixedPackagePrice: number | null = payload.fixed_package_price ?? null

  if (billingMode === "fixed_package") {
    if (fixedPackagePrice == null || fixedPackagePrice <= 0) {
      return noStoreJson({ error: "Package price is required for fixed-package flight types" }, { status: 400 })
    }
    ratePerHour = 0
  } else {
    if (ratePerHour <= 0) {
      return noStoreJson({ error: "Rate per hour must be greater than zero for hourly billing" }, { status: 400 })
    }
    fixedPackagePrice = null
  }

  const { data, error } = await supabase
    .from("aircraft_charge_rates")
    .insert({
      tenant_id: tenantId,
      aircraft_id: payload.aircraft_id,
      flight_type_id: payload.flight_type_id,
      rate_per_hour: ratePerHour,
      fixed_package_price: fixedPackagePrice,
      charge_hobbs: payload.charge_hobbs ?? false,
      charge_tacho: payload.charge_tacho ?? false,
      charge_airswitch: payload.charge_airswitch ?? false,
    })
    .select("*")
    .single()

  if (error || !data) {
    return noStoreJson({ error: "Failed to create aircraft charge rate" }, { status: 500 })
  }

  return noStoreJson({ rate: data }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ access: "staff" })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const { id, ...rest } = parsed.data

  const { data: existing, error: existingError } = await supabase
    .from("aircraft_charge_rates")
    .select("id, aircraft_id, flight_type_id, rate_per_hour, fixed_package_price")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (existingError || !existing) {
    return noStoreJson({ error: "Charge rate not found" }, { status: 404 })
  }

  const targetFlightTypeId = rest.flight_type_id ?? existing.flight_type_id
  const referenceCheck = await validateReferences(supabase, tenantId, existing.aircraft_id, targetFlightTypeId)
  if (!referenceCheck.ok) {
    return noStoreJson({ error: referenceCheck.message }, { status: 404 })
  }

  const billingMode = referenceCheck.flightType.billing_mode as "hourly" | "fixed_package"
  const nextRate =
    rest.rate_per_hour !== undefined ? rest.rate_per_hour : existing.rate_per_hour
  const nextFixed =
    rest.fixed_package_price !== undefined ? rest.fixed_package_price : existing.fixed_package_price

  const updateData: Record<string, unknown> = {
    ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)),
  }

  if (billingMode === "fixed_package") {
    if (nextFixed == null || Number(nextFixed) <= 0) {
      return noStoreJson({ error: "Package price is required for fixed-package flight types" }, { status: 400 })
    }
    updateData.rate_per_hour = 0
    updateData.fixed_package_price = nextFixed
  } else {
    if (nextRate <= 0) {
      return noStoreJson({ error: "Rate per hour must be greater than zero for hourly billing" }, { status: 400 })
    }
    updateData.rate_per_hour = nextRate
    updateData.fixed_package_price = null
  }

  delete updateData.id

  if (!Object.keys(updateData).length) {
    return noStoreJson({ error: "No fields to update" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("aircraft_charge_rates")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error || !data) {
    return noStoreJson({ error: "Failed to update aircraft charge rate" }, { status: 500 })
  }

  return noStoreJson({ rate: data })
}

export async function DELETE(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ access: "staff" })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = deleteSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const { error } = await supabase
    .from("aircraft_charge_rates")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", parsed.data.id)

  if (error) {
    return noStoreJson({ error: "Failed to delete aircraft charge rate" }, { status: 500 })
  }

  return noStoreJson({ success: true })
}
