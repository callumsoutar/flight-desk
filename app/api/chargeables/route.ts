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

const xeroTaxTypeSchema = z.preprocess(
  (value) => {
    const normalized = normalizeNullableString(value)
    return normalized ? normalized.toUpperCase() : null
  },
  z.string().max(40).nullable().optional()
)

async function resolveTypeIdByCode(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  code: string
) {
  const { data, error } = await supabase
    .from("chargeable_types")
    .select("id")
    .eq("code", code)
    .eq("is_active", true)
    .or(`tenant_id.eq.${tenantId},is_global.eq.true`)
    .order("is_global", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1200).optional().nullable(),
  chargeable_type_id: z.string().uuid(),
  rate: z.number().finite().min(0),
  xero_tax_type: xeroTaxTypeSchema,
  is_taxable: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(1200).optional().nullable(),
  chargeable_type_id: z.string().uuid().optional(),
  rate: z.number().finite().min(0).optional(),
  xero_tax_type: xeroTaxTypeSchema,
  is_taxable: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const url = new URL(request.url)
  const includeInactive = url.searchParams.get("include_inactive") === "true"
  const typeIdFromQuery = url.searchParams.get("type_id")
  const typeCode = url.searchParams.get("type") || url.searchParams.get("type_code")
  const excludeTypeCode = url.searchParams.get("exclude_type_code")

  const { user, role } = await getAuthSession(supabase, {
    includeRole: includeInactive,
    authoritativeRole: includeInactive,
    requireUser: true,
  })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (includeInactive && !isSettingsAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  }

  const resolvedTypeId = !typeIdFromQuery && typeCode
    ? await resolveTypeIdByCode(supabase, tenantId, typeCode).catch(() => null)
    : null
  const typeId = typeIdFromQuery || resolvedTypeId

  if (typeCode && !typeIdFromQuery && !resolvedTypeId) {
    return NextResponse.json({ chargeables: [] }, { headers: { "cache-control": "no-store" } })
  }

  const excludeTypeId = excludeTypeCode
    ? await resolveTypeIdByCode(supabase, tenantId, excludeTypeCode).catch(() => null)
    : null

  let query = supabase
    .from("chargeables")
    .select(
      "id, name, description, rate, xero_tax_type, is_taxable, is_active, chargeable_type_id, updated_at"
    )
    .eq("tenant_id", tenantId)
    .is("voided_at", null)
    .order("name", { ascending: true })

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }
  if (typeId) {
    query = query.eq("chargeable_type_id", typeId)
  }
  if (excludeTypeId) {
    query = query.neq("chargeable_type_id", excludeTypeId)
  }

  const { data: rows, error } = await query
  if (error) {
    return NextResponse.json({ error: "Failed to fetch chargeables" }, { status: 500 })
  }

  const typeIds = Array.from(new Set((rows ?? []).map((row) => row.chargeable_type_id).filter(Boolean)))
  const { data: types, error: typesError } = typeIds.length
    ? await supabase
        .from("chargeable_types")
        .select("id, code, name, gl_code")
        .or(`tenant_id.eq.${tenantId},is_global.eq.true`)
        .in("id", typeIds)
    : { data: [], error: null }

  if (typesError) {
    return NextResponse.json({ error: "Failed to fetch chargeable types" }, { status: 500 })
  }

  const typeById = new Map<string, { id: string; code: string; name: string; gl_code: string | null }>()
  for (const type of types ?? []) {
    typeById.set(type.id, type)
  }

  const chargeables = (rows ?? []).map((row) => ({
    ...row,
    chargeable_type: typeById.get(row.chargeable_type_id) ?? null,
  }))

  return NextResponse.json({ chargeables }, { headers: { "cache-control": "no-store" } })
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

  const payload = parsed.data

  const { data: type, error: typeError } = await supabase
    .from("chargeable_types")
    .select("id, code")
    .or(`tenant_id.eq.${tenantId},is_global.eq.true`)
    .eq("id", payload.chargeable_type_id)
    .eq("is_active", true)
    .maybeSingle()

  if (typeError || !type) {
    return NextResponse.json({ error: "Chargeable type not found" }, { status: 404 })
  }
  if (type.code === "landing_fee") {
    return NextResponse.json({ error: "Landing fees are managed in the Landing fees tab" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("chargeables")
    .insert({
      tenant_id: tenantId,
      chargeable_type_id: payload.chargeable_type_id,
      name: payload.name.trim(),
      description: normalizeNullableString(payload.description),
      rate: payload.rate,
      xero_tax_type: payload.xero_tax_type ?? null,
      is_taxable: payload.is_taxable ?? true,
      is_active: payload.is_active ?? true,
    })
    .select("id")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create chargeable" }, { status: 500 })
  }

  return NextResponse.json(
    { chargeable: { id: data.id } },
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

  const { id, ...rest } = parsed.data
  const updateData: Record<string, unknown> = {}
  if (rest.name !== undefined) updateData.name = rest.name.trim()
  if (rest.description !== undefined) updateData.description = normalizeNullableString(rest.description)
  if (rest.rate !== undefined) updateData.rate = rest.rate
  if (rest.xero_tax_type !== undefined) {
    updateData.xero_tax_type = rest.xero_tax_type ?? null
  }
  if (rest.is_taxable !== undefined) updateData.is_taxable = rest.is_taxable
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active

  if (rest.chargeable_type_id !== undefined) {
    const { data: type, error: typeError } = await supabase
      .from("chargeable_types")
      .select("id, code")
      .or(`tenant_id.eq.${tenantId},is_global.eq.true`)
      .eq("id", rest.chargeable_type_id)
      .eq("is_active", true)
      .maybeSingle()

    if (typeError || !type) {
      return NextResponse.json({ error: "Chargeable type not found" }, { status: 404 })
    }
    if (type.code === "landing_fee") {
      return NextResponse.json({ error: "Landing fees are managed in the Landing fees tab" }, { status: 400 })
    }
    updateData.chargeable_type_id = rest.chargeable_type_id
  }

  if (!Object.keys(updateData).length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("chargeables")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: "Chargeable not found" }, { status: 404 })
  }

  const { error } = await supabase.from("chargeables").update(updateData).eq("tenant_id", tenantId).eq("id", id)
  if (error) {
    return NextResponse.json({ error: "Failed to update chargeable" }, { status: 500 })
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

  const { data: existing, error: existingError } = await supabase
    .from("chargeables")
    .select("id, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: "Chargeable not found" }, { status: 404 })
  }

  if (!existing.is_active) {
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
  }

  const { error } = await supabase
    .from("chargeables")
    .update({ is_active: false })
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to deactivate chargeable" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}
