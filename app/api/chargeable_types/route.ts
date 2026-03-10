import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isSettingsAdmin(role: string | null) {
  return role === "owner" || role === "admin"
}

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

const createSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1200).nullable().optional(),
  gl_code: z.string().trim().max(20).nullable().optional(),
  is_active: z.boolean().optional(),
})

const updateSchema = z.object({
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

  let query = supabase
    .from("chargeable_types")
    .select("id, code, name, description, gl_code, is_active, is_global, is_system, tenant_id, updated_at")
    .or(`tenant_id.eq.${tenantId},is_global.eq.true`)
    .order("name", { ascending: true })

  if (isActive !== undefined) {
    query = query.eq("is_active", isActive)
  }
  if (excludeCode) {
    query = query.neq("code", excludeCode)
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
  if (!isSettingsAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

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
      is_global: false,
      is_system: false,
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
  if (!isSettingsAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  const { id, ...rest } = parsed.data

  const { data: existing, error: existingError } = await supabase
    .from("chargeable_types")
    .select("id, is_system")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle()
  if (existingError || !existing) {
    return NextResponse.json({ error: "Chargeable type not found" }, { status: 404 })
  }
  if (existing.is_system) {
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

  const { error } = await supabase.from("chargeable_types").update(updateData).eq("id", id)
  if (error) return NextResponse.json({ error: "Failed to update chargeable type" }, { status: 500 })
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}

