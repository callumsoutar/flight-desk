import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import type { Json } from "@/lib/types"

export const dynamic = "force-dynamic"

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function normalizeBenefits(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

const createSchema = z.strictObject({
  name: z.string().trim().min(1).max(140),
  code: z.string().trim().min(1).max(60),
  description: z.string().trim().max(2000).optional().nullable(),
  duration_months: z.number().int().min(1).max(1200),
  benefits: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  is_active: z.boolean().optional(),
  chargeable_id: z.string().uuid().nullable().optional(),
})

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const includeInactive = url.searchParams.get("include_inactive") === "true"
  const session = await getTenantScopedRouteContext({
    access: "admin",
    authoritativeRole: includeInactive,
  })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

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
    return noStoreJson({ error: "Failed to fetch membership types" }, { status: 500 })
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

  return noStoreJson({ membership_types: membershipTypes })
}

export async function POST(request: NextRequest) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
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
      return noStoreJson({ error: "Linked chargeable not found" }, { status: 404 })
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
    return noStoreJson({ error: "Failed to create membership type" }, { status: 500 })
  }

  return noStoreJson({ membership_type: { id: data.id } }, { status: 201 })
}
