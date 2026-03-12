import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { isAdminRole, isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { publicSyllabusStageSchema } from "@/lib/schema/generated"

export const dynamic = "force-dynamic"

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const createSchema = z.object({
  syllabus_id: z.string().uuid(),
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(2000).optional().nullable(),
  is_required: z.boolean().optional(),
  syllabus_stage: publicSyllabusStageSchema.optional().nullable(),
  is_active: z.boolean().optional(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  is_required: z.boolean().optional(),
  syllabus_stage: publicSyllabusStageSchema.optional().nullable(),
  is_active: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const url = new URL(request.url)
  const syllabusId = url.searchParams.get("syllabus_id")
  const includeInactive = url.searchParams.get("include_inactive") === "true"

  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: includeInactive,
    authoritativeTenant: includeInactive,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  if (!syllabusId || !z.string().uuid().safeParse(syllabusId).success) {
    return NextResponse.json({ error: "Invalid syllabus id" }, { status: 400 })
  }

  if (includeInactive) {
    if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  } else if (!isStaffRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let query = supabase
    .from("lessons")
    .select("id, name, description, order, syllabus_id, syllabus_stage, is_required, is_active, created_at, updated_at, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("syllabus_id", syllabusId)
    .order("order", { ascending: true })

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: "Failed to load lessons" }, { status: 500 })
  }

  return NextResponse.json({ lessons: data ?? [] }, { headers: { "cache-control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const raw = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data
  const { data: maxRow, error: maxError } = await supabase
    .from("lessons")
    .select("order")
    .eq("tenant_id", tenantId)
    .eq("syllabus_id", payload.syllabus_id)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxError) {
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 })
  }

  const nextOrder = typeof maxRow?.order === "number" ? maxRow.order + 1 : 1

  const { data, error } = await supabase
    .from("lessons")
    .insert({
      tenant_id: tenantId,
      syllabus_id: payload.syllabus_id,
      name: payload.name.trim(),
      description: normalizeNullableString(payload.description),
      is_required: payload.is_required ?? true,
      syllabus_stage: payload.syllabus_stage ?? null,
      is_active: payload.is_active ?? true,
      order: nextOrder,
    })
    .select("id")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 })
  }

  return NextResponse.json({ lesson: { id: data.id } }, { status: 201, headers: { "cache-control": "no-store" } })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const raw = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { id, ...rest } = parsed.data
  const updateData: Record<string, unknown> = {}
  if (rest.name !== undefined) updateData.name = rest.name.trim()
  if (rest.description !== undefined) updateData.description = normalizeNullableString(rest.description)
  if (rest.is_required !== undefined) updateData.is_required = rest.is_required
  if (rest.syllabus_stage !== undefined) updateData.syllabus_stage = rest.syllabus_stage
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active

  if (!Object.keys(updateData).length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("lessons")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  const { error } = await supabase.from("lessons").update(updateData).eq("tenant_id", tenantId).eq("id", id)
  if (error) {
    return NextResponse.json({ error: "Failed to update lesson" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

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
    .from("lessons")
    .select("id, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  if (!existing.is_active) {
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
  }

  const { error } = await supabase.from("lessons").update({ is_active: false }).eq("tenant_id", tenantId).eq("id", id)
  if (error) {
    return NextResponse.json({ error: "Failed to delete lesson" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}

