import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/types"

export const dynamic = "force-dynamic"

function isSettingsAdmin(role: string | null) {
  return role === "owner" || role === "admin"
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function normalizeBenefits(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(140),
  code: z.string().trim().min(1).max(60),
  description: z.string().trim().max(2000).optional().nullable(),
  duration_months: z.number().int().min(1).max(1200),
  benefits: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  is_active: z.boolean().optional(),
  chargeable_id: z.string().uuid().nullable().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const url = new URL(request.url)
  const includeInactive = url.searchParams.get("include_inactive") === "true"

  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    requireUser: true,
    authoritativeRole: includeInactive,
    authoritativeTenant: includeInactive,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }
  if (!isSettingsAdmin(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  let query = supabase
    .from("membership_types")
    .select(
      "id, name, code, description, duration_months, benefits, is_active, chargeable_id, updated_at, chargeables:chargeables!fk_membership_chargeable(id, name, rate, is_taxable)"
    )
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch membership types" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  const membershipTypes = (data ?? []).map((row) => {
    const chargeablesValue = (row as unknown as { chargeables?: unknown }).chargeables
    const chargeable =
      Array.isArray(chargeablesValue) ? chargeablesValue[0] ?? null : (chargeablesValue ?? null)

    const rawBenefits = (row as unknown as { benefits?: unknown }).benefits
    const benefits = normalizeBenefits(rawBenefits)

    return {
      ...row,
      benefits: benefits as unknown as Json,
      chargeables: chargeable,
    }
  })

  return NextResponse.json(
    { membership_types: membershipTypes },
    { headers: { "cache-control": "no-store" } }
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }
  if (!isSettingsAdmin(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const raw = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const payload = parsed.data

  if (payload.chargeable_id) {
    const { data: chargeable, error: chargeableError } = await supabase
      .from("chargeables")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", payload.chargeable_id)
      .eq("is_active", true)
      .is("voided_at", null)
      .maybeSingle()

    if (chargeableError || !chargeable) {
      return NextResponse.json(
        { error: "Linked chargeable not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }
  }

  const { data, error } = await supabase
    .from("membership_types")
    .insert({
      tenant_id: tenantId,
      name: payload.name.trim(),
      code: payload.code.trim(),
      description: normalizeNullableString(payload.description),
      duration_months: payload.duration_months,
      benefits: (payload.benefits ?? []) as unknown as Json,
      is_active: payload.is_active ?? true,
      chargeable_id: payload.chargeable_id ?? null,
    })
    .select("id")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to create membership type" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { membership_type: { id: data.id } },
    { status: 201, headers: { "cache-control": "no-store" } }
  )
}

