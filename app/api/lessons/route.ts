import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { publicSyllabusStageSchema } from "@/lib/schema/generated"

export const dynamic = "force-dynamic"

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const createSchema = z.strictObject({
  syllabus_id: z.string().uuid(),
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(2000).optional().nullable(),
  is_required: z.boolean().optional(),
  syllabus_stage: publicSyllabusStageSchema.optional().nullable(),
  is_active: z.boolean().optional(),
})

const updateSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  is_required: z.boolean().optional(),
  syllabus_stage: publicSyllabusStageSchema.optional().nullable(),
  is_active: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const syllabusId = url.searchParams.get("syllabus_id")
  const includeInactive = url.searchParams.get("include_inactive") === "true"
  const session = await getTenantScopedRouteContext({
    access: includeInactive ? "admin" : "staff",
  })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context
  if (!syllabusId || !z.string().uuid().safeParse(syllabusId).success) {
    return noStoreJson({ error: "Invalid syllabus id" }, { status: 400 })
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
    return noStoreJson({ error: "Failed to load lessons" }, { status: 500 })
  }

  return noStoreJson({ lessons: data ?? [] })
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
  const { data: maxRow, error: maxError } = await supabase
    .from("lessons")
    .select("order")
    .eq("tenant_id", tenantId)
    .eq("syllabus_id", payload.syllabus_id)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxError) {
    return noStoreJson({ error: "Failed to create lesson" }, { status: 500 })
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
    return noStoreJson({ error: "Failed to create lesson" }, { status: 500 })
  }

  return noStoreJson({ lesson: { id: data.id } }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const { id, ...rest } = parsed.data
  const updateData: Record<string, unknown> = {}
  if (rest.name !== undefined) updateData.name = rest.name.trim()
  if (rest.description !== undefined) updateData.description = normalizeNullableString(rest.description)
  if (rest.is_required !== undefined) updateData.is_required = rest.is_required
  if (rest.syllabus_stage !== undefined) updateData.syllabus_stage = rest.syllabus_stage
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active

  if (!Object.keys(updateData).length) {
    return noStoreJson({ error: "No fields to update" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("lessons")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (existingError || !existing) {
    return noStoreJson({ error: "Lesson not found" }, { status: 404 })
  }

  const { error } = await supabase.from("lessons").update(updateData).eq("tenant_id", tenantId).eq("id", id)
  if (error) {
    return noStoreJson({ error: "Failed to update lesson" }, { status: 500 })
  }

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
    .from("lessons")
    .select("id, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (existingError || !existing) {
    return noStoreJson({ error: "Lesson not found" }, { status: 404 })
  }

  if (!existing.is_active) {
    return noStoreJson({ ok: true })
  }

  const { error } = await supabase.from("lessons").update({ is_active: false }).eq("tenant_id", tenantId).eq("id", id)
  if (error) {
    return noStoreJson({ error: "Failed to delete lesson" }, { status: 500 })
  }

  return noStoreJson({ ok: true })
}
