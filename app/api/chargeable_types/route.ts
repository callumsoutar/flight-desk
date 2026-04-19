import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

type ChargeableTypeScope = "tenant" | "system"

function parseBoolean(value: string | null) {
  if (value === "true") return true
  if (value === "false") return false
  return undefined
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const createSchema = z.strictObject({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1200).nullable().optional(),
  gl_code: z.string().trim().max(20).nullable().optional(),
  is_active: z.boolean().optional(),
})

const updateSchema = z.strictObject({
  id: z.string().uuid(),
  code: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(1200).nullable().optional(),
  gl_code: z.string().trim().max(20).nullable().optional(),
  is_active: z.boolean().optional(),
})

const CHARGEABLE_TYPE_SELECT =
  "id, code, name, description, gl_code, is_active, scope, system_key, tenant_id, updated_at" as const

export async function GET(request: NextRequest) {
  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const url = new URL(request.url)
  const isActive = parseBoolean(url.searchParams.get("is_active"))
  const excludeCode = url.searchParams.get("exclude_code")
  const excludeSystemKey = url.searchParams.get("exclude_system_key")

  /**
   * Previously: single query with `.or(\`tenant_id.eq.${tenantId},scope.eq.system\`)` plus filters.
   * PostgREST can return incomplete rows when OR is combined with neq/is_active filters.
   * Fetch tenant-scoped types and system types separately, then merge (same logical result).
   */
  let tenantQuery = supabase
    .from("chargeable_types")
    .select(CHARGEABLE_TYPE_SELECT)
    .eq("tenant_id", tenantId)

  let systemQuery = supabase.from("chargeable_types").select(CHARGEABLE_TYPE_SELECT).eq("scope", "system")

  if (isActive !== undefined) {
    tenantQuery = tenantQuery.eq("is_active", isActive)
    systemQuery = systemQuery.eq("is_active", isActive)
  }
  if (excludeCode) {
    tenantQuery = tenantQuery.neq("code", excludeCode)
    systemQuery = systemQuery.neq("code", excludeCode)
  }
  if (excludeSystemKey) {
    tenantQuery = tenantQuery.neq("system_key", excludeSystemKey)
    systemQuery = systemQuery.neq("system_key", excludeSystemKey)
  }

  const [{ data: tenantRows, error: tenantError }, { data: systemRows, error: systemError }] = await Promise.all([
    tenantQuery,
    systemQuery,
  ])

  if (tenantError || systemError) {
    return noStoreJson({ error: "Failed to fetch chargeable types" }, { status: 500 })
  }

  const seen = new Set<string>()
  const merged = [...(tenantRows ?? []), ...(systemRows ?? [])].filter((row) => {
    if (!row?.id || seen.has(row.id)) return false
    seen.add(row.id)
    return true
  })
  merged.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }))

  return noStoreJson({ chargeable_types: merged })
}

export async function POST(request: NextRequest) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return noStoreJson({ error: "Invalid payload" }, { status: 400 })

  const payload = parsed.data
  const { data, error } = await supabase
    .from("chargeable_types")
    .insert({
      tenant_id: tenantId,
      code: payload.code.trim(),
      name: payload.name.trim(),
      description: normalizeNullableString(payload.description),
      gl_code: normalizeNullableString(payload.gl_code),
      scope: "tenant" satisfies ChargeableTypeScope,
      system_key: null,
      is_active: payload.is_active ?? true,
    })
    .select("id")
    .single()

  if (error || !data) return noStoreJson({ error: "Failed to create chargeable type" }, { status: 500 })
  return noStoreJson({ chargeable_type: { id: data.id } }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  const { id, ...rest } = parsed.data

  const { data: existing, error: existingError } = await supabase
    .from("chargeable_types")
    .select("id, scope")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle()
  if (existingError || !existing) {
    return noStoreJson({ error: "Chargeable type not found" }, { status: 404 })
  }
  if (existing.scope === "system") {
    return noStoreJson({ error: "System chargeable types cannot be modified" }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (rest.code !== undefined) updateData.code = rest.code.trim()
  if (rest.name !== undefined) updateData.name = rest.name.trim()
  if (rest.description !== undefined) updateData.description = normalizeNullableString(rest.description)
  if (rest.gl_code !== undefined) updateData.gl_code = normalizeNullableString(rest.gl_code)
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active

  if (!Object.keys(updateData).length) {
    return noStoreJson({ error: "No fields to update" }, { status: 400 })
  }

  const { error } = await supabase.from("chargeable_types").update(updateData).eq("id", id).eq("tenant_id", tenantId)
  if (error) return noStoreJson({ error: "Failed to update chargeable type" }, { status: 500 })
  return noStoreJson({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const url = new URL(request.url)
  const idFromQuery = url.searchParams.get("id")
  const rawBody = await request.json().catch(() => null)
  const idFromBody =
    rawBody && typeof rawBody === "object" && typeof (rawBody as { id?: unknown }).id === "string"
      ? (rawBody as { id: string }).id
      : null
  const id = idFromQuery || idFromBody

  if (!id || !z.string().uuid().safeParse(id).success) {
    return noStoreJson({ error: "Invalid id" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("chargeable_types")
    .select("id, scope")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (existingError || !existing) {
    return noStoreJson({ error: "Chargeable type not found" }, { status: 404 })
  }
  if (existing.scope === "system") {
    return noStoreJson({ error: "System chargeable types cannot be deleted" }, { status: 400 })
  }

  const { count, error: countError } = await supabase
    .from("chargeables")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("chargeable_type_id", id)
    .is("voided_at", null)

  if (countError) {
    return noStoreJson({ error: "Failed to validate chargeable type usage" }, { status: 500 })
  }
  if ((count ?? 0) > 0) {
    return noStoreJson({ error: "Cannot delete a type that is in use" }, { status: 400 })
  }

  const { error } = await supabase.from("chargeable_types").delete().eq("tenant_id", tenantId).eq("id", id)
  if (error) return noStoreJson({ error: "Failed to delete chargeable type" }, { status: 500 })

  return noStoreJson({ ok: true })
}
