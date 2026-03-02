import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isSettingsAdmin(role: string | null) {
  return role === "owner" || role === "admin"
}

const instructionTypeSchema = z.enum(["dual", "solo", "trial"])

const createSchema = z.object({
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1200).optional().nullable(),
  instruction_type: instructionTypeSchema,
  is_active: z.boolean().optional(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(1200).optional().nullable(),
  instruction_type: instructionTypeSchema.optional(),
  is_active: z.boolean().optional(),
})

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const url = new URL(request.url)
  const includeInactive = url.searchParams.get("include_inactive") === "true"

  const { user, role } = await getAuthSession(supabase, {
    includeRole: includeInactive,
    authoritativeRole: includeInactive,
  })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (includeInactive && !isSettingsAdmin(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  }

  let query = supabase
    .from("flight_types")
    .select("id, name, description, instruction_type, is_active, is_default_solo, updated_at")
    .eq("tenant_id", tenantId)
    .is("voided_at", null)
    .order("name", { ascending: true })

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: "Failed to fetch flight types" }, { status: 500 })
  }

  return NextResponse.json({ flight_types: data ?? [] }, { headers: { "cache-control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, {
    includeRole: true,
    authoritativeRole: true,
    requireUser: true,
  })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isSettingsAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

  const { data, error } = await supabase
    .from("flight_types")
    .insert({
      tenant_id: tenantId,
      name: payload.name.trim(),
      description: normalizeNullableString(payload.description),
      instruction_type: payload.instruction_type,
      is_active: payload.is_active ?? true,
      is_default_solo: false,
    })
    .select("id")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create flight type" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201, headers: { "cache-control": "no-store" } })
}

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, {
    includeRole: true,
    authoritativeRole: true,
    requireUser: true,
  })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isSettingsAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
  const updateData: Record<string, unknown> = {}
  if (rest.name !== undefined) updateData.name = rest.name.trim()
  if (rest.description !== undefined) updateData.description = normalizeNullableString(rest.description)
  if (rest.instruction_type !== undefined) updateData.instruction_type = rest.instruction_type
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active

  if (!Object.keys(updateData).length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("flight_types")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: "Flight type not found" }, { status: 404 })
  }

  const { error } = await supabase
    .from("flight_types")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to update flight type" }, { status: 500 })
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

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isSettingsAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  }

  const url = new URL(request.url)
  const idFromQuery = url.searchParams.get("id")
  const rawBody = await request.json().catch(() => null)
  const idFromBody = rawBody && typeof rawBody === "object" && typeof (rawBody as { id?: unknown }).id === "string"
    ? ((rawBody as { id: string }).id)
    : null
  const id = idFromQuery || idFromBody

  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("flight_types")
    .select("id, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: "Flight type not found" }, { status: 404 })
  }

  if (!existing.is_active) {
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
  }

  const { error } = await supabase
    .from("flight_types")
    .update({ is_active: false })
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to deactivate flight type" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}
