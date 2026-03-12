import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isSettingsAdmin(role: string | null) {
  return role === "owner" || role === "admin"
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

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
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1200).optional().nullable(),
  is_taxable: z.boolean().optional(),
  is_active: z.boolean().optional(),
  rate: z.number().finite().min(0),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(1200).optional().nullable(),
  is_taxable: z.boolean().optional(),
  is_active: z.boolean().optional(),
  rate: z.number().finite().min(0).optional(),
})

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const url = new URL(request.url)
  const includeInactive = url.searchParams.get("include_inactive") === "true"

  const { user, role } = await getAuthSession(supabase, {
    includeRole: includeInactive,
    authoritativeRole: includeInactive,
    requireUser: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (includeInactive && !isSettingsAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })

  const landingFeeTypeId = await getLandingFeeTypeId(supabase, tenantId)
  if (!landingFeeTypeId) {
    return NextResponse.json({ error: "Landing fee chargeable type is not configured" }, { status: 400 })
  }

  let query = supabase
    .from("chargeables")
    .select("id, name, description, rate, is_taxable, is_active, updated_at")
    .eq("tenant_id", tenantId)
    .eq("chargeable_type_id", landingFeeTypeId)
    .is("voided_at", null)
    .order("name", { ascending: true })

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  const { data: chargeables, error } = await query
  if (error) {
    return NextResponse.json({ error: "Failed to fetch landing fees" }, { status: 500 })
  }

  const chargeableIds = (chargeables ?? []).map((row) => row.id).filter((id): id is string => typeof id === "string")

  const { data: rates, error: ratesError } = chargeableIds.length
    ? await supabase
        .from("landing_fee_rates")
        .select("id, chargeable_id, aircraft_type_id, rate, updated_at")
        .eq("tenant_id", tenantId)
        .in("chargeable_id", chargeableIds)
    : { data: [], error: null }

  if (ratesError) {
    return NextResponse.json({ error: "Failed to fetch landing fee rates" }, { status: 500 })
  }

  const ratesByChargeable = new Map<string, typeof rates>()
  for (const rate of rates ?? []) {
    const list = ratesByChargeable.get(rate.chargeable_id) ?? []
    list.push(rate)
    ratesByChargeable.set(rate.chargeable_id, list)
  }

  const landingFees = (chargeables ?? []).map((fee) => ({
    ...fee,
    landing_fee_rates: ratesByChargeable.get(fee.id) ?? [],
  }))

  return NextResponse.json({ landing_fees: landingFees }, { headers: { "cache-control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, {
    includeRole: true,
    authoritativeRole: true,
    requireUser: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSettingsAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

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

  const payload = parsed.data

  const { data, error } = await supabase
    .from("chargeables")
    .insert({
      tenant_id: tenantId,
      chargeable_type_id: landingFeeTypeId,
      name: payload.name.trim(),
      description: normalizeNullableString(payload.description),
      is_taxable: payload.is_taxable ?? true,
      is_active: payload.is_active ?? true,
      rate: payload.rate,
    })
    .select("id, name, description, rate, is_taxable, is_active, updated_at")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create landing fee" }, { status: 500 })
  }

  return NextResponse.json(
    { landing_fee: { ...data, landing_fee_rates: [] } },
    { status: 201, headers: { "cache-control": "no-store" } }
  )
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, {
    includeRole: true,
    authoritativeRole: true,
    requireUser: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSettingsAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })

  const raw = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const landingFeeTypeId = await getLandingFeeTypeId(supabase, tenantId)
  if (!landingFeeTypeId) {
    return NextResponse.json({ error: "Landing fee chargeable type is not configured" }, { status: 400 })
  }

  const { id, ...rest } = parsed.data
  const updateData: Record<string, unknown> = {}
  if (rest.name !== undefined) updateData.name = rest.name.trim()
  if (rest.description !== undefined) updateData.description = normalizeNullableString(rest.description)
  if (rest.is_taxable !== undefined) updateData.is_taxable = rest.is_taxable
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active
  if (rest.rate !== undefined) updateData.rate = rest.rate

  if (!Object.keys(updateData).length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("chargeables")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .eq("chargeable_type_id", landingFeeTypeId)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: "Landing fee not found" }, { status: 404 })
  }

  const { error } = await supabase.from("chargeables").update(updateData).eq("tenant_id", tenantId).eq("id", id)
  if (error) {
    return NextResponse.json({ error: "Failed to update landing fee" }, { status: 500 })
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
  if (!isSettingsAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })

  const url = new URL(request.url)
  const idFromQuery = url.searchParams.get("id")
  const rawBody = await request.json().catch(() => null)
  const idFromBody =
    rawBody && typeof rawBody === "object" && typeof (rawBody as { id?: unknown }).id === "string"
      ? (rawBody as { id: string }).id
      : null
  const id = idFromQuery || idFromBody

  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const landingFeeTypeId = await getLandingFeeTypeId(supabase, tenantId)
  if (!landingFeeTypeId) {
    return NextResponse.json({ error: "Landing fee chargeable type is not configured" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("chargeables")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .eq("chargeable_type_id", landingFeeTypeId)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: "Landing fee not found" }, { status: 404 })
  }

  const { error } = await supabase
    .from("chargeables")
    .update({ is_active: false })
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to delete landing fee" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}
