import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

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

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase, { requireUser: true })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  }

  const url = new URL(request.url)
  const isActive = parseBoolean(url.searchParams.get("is_active"))
  const excludeCode = url.searchParams.get("exclude_code")
  const excludeSystemKey = url.searchParams.get("exclude_system_key")

  let query = supabase
    .from("chargeable_types")
    .select("id, code, name, description, gl_code, is_active, scope, system_key, tenant_id, updated_at")
    .or(`tenant_id.eq.${tenantId},scope.eq.system`)
    .order("name", { ascending: true })

  if (isActive !== undefined) {
    query = query.eq("is_active", isActive)
  }
  if (excludeCode) {
    query = query.neq("code", excludeCode)
  }
  if (excludeSystemKey) {
    query = query.neq("system_key", excludeSystemKey)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: "Failed to fetch chargeable types" }, { status: 500 })
  }

  return NextResponse.json({ chargeable_types: data ?? [] }, { headers: { "cache-control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    authoritativeRole: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

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

  if (error || !data) return NextResponse.json({ error: "Failed to create chargeable type" }, { status: 500 })
  return NextResponse.json({ chargeable_type: { id: data.id } }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    authoritativeRole: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  const { id, ...rest } = parsed.data

  const { data: existing, error: existingError } = await supabase
    .from("chargeable_types")
    .select("id, scope")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle()
  if (existingError || !existing) {
    return NextResponse.json({ error: "Chargeable type not found" }, { status: 404 })
  }
  if (existing.scope === "system") {
    return NextResponse.json({ error: "System chargeable types cannot be modified" }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (rest.code !== undefined) updateData.code = rest.code.trim()
  if (rest.name !== undefined) updateData.name = rest.name.trim()
  if (rest.description !== undefined) updateData.description = normalizeNullableString(rest.description)
  if (rest.gl_code !== undefined) updateData.gl_code = normalizeNullableString(rest.gl_code)
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active

  if (!Object.keys(updateData).length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const { error } = await supabase.from("chargeable_types").update(updateData).eq("id", id).eq("tenant_id", tenantId)
  if (error) return NextResponse.json({ error: "Failed to update chargeable type" }, { status: 500 })
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
    .from("chargeable_types")
    .select("id, scope")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: "Chargeable type not found" }, { status: 404 })
  }
  if (existing.scope === "system") {
    return NextResponse.json({ error: "System chargeable types cannot be deleted" }, { status: 400 })
  }

  const { count, error: countError } = await supabase
    .from("chargeables")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("chargeable_type_id", id)
    .is("voided_at", null)

  if (countError) {
    return NextResponse.json({ error: "Failed to validate chargeable type usage" }, { status: 500 })
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "Cannot delete a type that is in use" }, { status: 400 })
  }

  const { error } = await supabase.from("chargeable_types").delete().eq("tenant_id", tenantId).eq("id", id)
  if (error) return NextResponse.json({ error: "Failed to delete chargeable type" }, { status: 500 })

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}

