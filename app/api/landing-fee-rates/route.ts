import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

async function getLandingFeeTypeId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, tenantId: string) {
  const { data, error } = await supabase
    .from("chargeable_types")
    .select("id")
    .eq("code", "landing_fees")
    .eq("is_active", true)
    .or(`tenant_id.eq.${tenantId},scope.eq.system`)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

const createSchema = z.object({
  chargeable_id: z.string().uuid(),
  aircraft_type_id: z.string().uuid(),
  rate: z.number().finite().min(0),
})

const updateSchema = z.object({
  chargeable_id: z.string().uuid(),
  aircraft_type_id: z.string().uuid(),
  rate: z.number().finite().min(0),
})

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, {
    includeRole: true,
    authoritativeRole: true,
    requireUser: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })

  const raw = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const landingFeeTypeId = await getLandingFeeTypeId(supabase, tenantId)
  if (!landingFeeTypeId) {
    return NextResponse.json({ error: "Landing fee chargeable type is not configured" }, { status: 400 })
  }

  const { chargeable_id, aircraft_type_id, rate } = parsed.data

  const [chargeableResult, aircraftTypeResult] = await Promise.all([
    supabase
      .from("chargeables")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", chargeable_id)
      .eq("chargeable_type_id", landingFeeTypeId)
      .is("voided_at", null)
      .maybeSingle(),
    supabase
      .from("aircraft_types")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", aircraft_type_id)
      .maybeSingle(),
  ])

  if (chargeableResult.error || !chargeableResult.data) {
    return NextResponse.json({ error: "Landing fee chargeable not found" }, { status: 404 })
  }
  if (aircraftTypeResult.error || !aircraftTypeResult.data) {
    return NextResponse.json({ error: "Aircraft type not found" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("landing_fee_rates")
    .insert({
      tenant_id: tenantId,
      chargeable_id,
      aircraft_type_id,
      rate,
    })
    .select("id, chargeable_id, aircraft_type_id, rate")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create landing fee rate" }, { status: 500 })
  }

  return NextResponse.json({ landing_fee_rate: data }, { status: 201, headers: { "cache-control": "no-store" } })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, {
    includeRole: true,
    authoritativeRole: true,
    requireUser: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })

  const raw = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { chargeable_id, aircraft_type_id, rate } = parsed.data

  const { data: existing, error: existingError } = await supabase
    .from("landing_fee_rates")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("chargeable_id", chargeable_id)
    .eq("aircraft_type_id", aircraft_type_id)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: "Landing fee rate not found" }, { status: 404 })
  }

  const { error } = await supabase
    .from("landing_fee_rates")
    .update({ rate })
    .eq("tenant_id", tenantId)
    .eq("id", existing.id)

  if (error) {
    return NextResponse.json({ error: "Failed to update landing fee rate" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, {
    includeRole: true,
    authoritativeRole: true,
    requireUser: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })

  const url = new URL(request.url)
  const chargeableId = url.searchParams.get("chargeable_id")
  const aircraftTypeId = url.searchParams.get("aircraft_type_id")

  const parsed = z
    .object({
      chargeable_id: z.string().uuid(),
      aircraft_type_id: z.string().uuid(),
    })
    .safeParse({ chargeable_id: chargeableId, aircraft_type_id: aircraftTypeId })

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
  }

  const { error } = await supabase
    .from("landing_fee_rates")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("chargeable_id", parsed.data.chargeable_id)
    .eq("aircraft_type_id", parsed.data.aircraft_type_id)

  if (error) {
    return NextResponse.json({ error: "Failed to delete landing fee rate" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}

