import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const createSchema = z.object({
  aircraft_id: z.string().uuid(),
  flight_type_id: z.string().uuid(),
  rate_per_hour: z.number().nonnegative(),
  charge_hobbs: z.boolean().optional(),
  charge_tacho: z.boolean().optional(),
  charge_airswitch: z.boolean().optional(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  flight_type_id: z.string().uuid().optional(),
  rate_per_hour: z.number().nonnegative().optional(),
  charge_hobbs: z.boolean().optional(),
  charge_tacho: z.boolean().optional(),
  charge_airswitch: z.boolean().optional(),
})

const deleteSchema = z.object({
  id: z.string().uuid(),
})

async function validateReferences(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  aircraftId: string,
  flightTypeId: string
) {
  const [aircraftResult, flightTypeResult] = await Promise.all([
    supabase
      .from("aircraft")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", aircraftId)
      .maybeSingle(),
    supabase
      .from("flight_types")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", flightTypeId)
      .is("voided_at", null)
      .maybeSingle(),
  ])

  if (aircraftResult.error || !aircraftResult.data) {
    return { ok: false, message: "Aircraft not found" as const }
  }
  if (flightTypeResult.error || !flightTypeResult.data) {
    return { ok: false, message: "Flight type not found" as const }
  }

  return { ok: true as const }
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  }

  const aircraftId = request.nextUrl.searchParams.get("aircraft_id")
  if (!aircraftId) {
    return NextResponse.json({ error: "aircraft_id is required" }, { status: 400 })
  }

  const flightTypeId = request.nextUrl.searchParams.get("flight_type_id")
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
      return NextResponse.json(
        { error: "Failed to fetch aircraft charge rate" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { charge_rate: data ?? null },
      { headers: { "cache-control": "no-store" } }
    )
  }

  const { data, error } = await supabase
    .from("aircraft_charge_rates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("aircraft_id", aircraftId)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: "Failed to fetch aircraft charge rates" }, { status: 500 })
  }

  return NextResponse.json({ rates: data ?? [] }, { headers: { "cache-control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data
  const referenceCheck = await validateReferences(
    supabase,
    tenantId,
    payload.aircraft_id,
    payload.flight_type_id
  )
  if (!referenceCheck.ok) {
    return NextResponse.json({ error: referenceCheck.message }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("aircraft_charge_rates")
    .insert({
      tenant_id: tenantId,
      aircraft_id: payload.aircraft_id,
      flight_type_id: payload.flight_type_id,
      rate_per_hour: payload.rate_per_hour,
      charge_hobbs: payload.charge_hobbs ?? false,
      charge_tacho: payload.charge_tacho ?? false,
      charge_airswitch: payload.charge_airswitch ?? false,
    })
    .select("*")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create aircraft charge rate" }, { status: 500 })
  }

  return NextResponse.json({ rate: data }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { id, ...rest } = parsed.data

  const { data: existing, error: existingError } = await supabase
    .from("aircraft_charge_rates")
    .select("id, aircraft_id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: "Charge rate not found" }, { status: 404 })
  }

  if (rest.flight_type_id) {
    const referenceCheck = await validateReferences(
      supabase,
      tenantId,
      existing.aircraft_id,
      rest.flight_type_id
    )
    if (!referenceCheck.ok) {
      return NextResponse.json({ error: referenceCheck.message }, { status: 404 })
    }
  }

  const updateData = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  )
  if (!Object.keys(updateData).length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("aircraft_charge_rates")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: "Failed to update aircraft charge rate" }, { status: 500 })
  }

  return NextResponse.json({ rate: data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = deleteSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { error } = await supabase
    .from("aircraft_charge_rates")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", parsed.data.id)

  if (error) {
    return NextResponse.json({ error: "Failed to delete aircraft charge rate" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
