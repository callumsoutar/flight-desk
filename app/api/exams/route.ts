import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const createSchema = z.strictObject({
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(2000).optional().nullable(),
  syllabus_id: z.string().uuid().optional().nullable(),
  passing_score: z.number().int().min(0).max(100),
  is_active: z.boolean().optional(),
})

const updateSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  syllabus_id: z.string().uuid().optional().nullable(),
  passing_score: z.number().int().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get("include_inactive") === "true"
  const session = await getTenantScopedRouteContext({
    access: includeInactive ? "admin" : "authenticated",
    authoritativeRole: includeInactive,
  })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const syllabusId = request.nextUrl.searchParams.get("syllabus_id")

  let query = supabase
    .from("exam")
    .select("id, name, description, passing_score, syllabus_id, is_active, updated_at")
    .eq("tenant_id", tenantId)
    .is("voided_at", null)
    .order("name", { ascending: true })

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  if (syllabusId) query = query.eq("syllabus_id", syllabusId)

  const { data, error } = await query

  if (error) {
    return noStoreJson({ error: "Failed to load exams" }, { status: 500 })
  }

  return noStoreJson({ exams: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const ctx = await getTenantAdminRouteContext(supabase)
  if (ctx.response) return ctx.response
  const { tenantId } = ctx.context

  const raw = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data
  const { data, error } = await supabase
    .from("exam")
    .insert({
      tenant_id: tenantId,
      name: payload.name.trim(),
      description: normalizeNullableString(payload.description),
      syllabus_id: payload.syllabus_id ?? null,
      passing_score: payload.passing_score,
      is_active: payload.is_active ?? true,
    })
    .select("id")
    .single()

  if (error || !data) {
    return noStoreJson({ error: "Failed to create exam" }, { status: 500 })
  }

  return noStoreJson({ exam: { id: data.id } }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const ctx = await getTenantAdminRouteContext(supabase)
  if (ctx.response) return ctx.response
  const { tenantId } = ctx.context

  const raw = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const { id, ...rest } = parsed.data
  const updateData: Record<string, unknown> = {}
  if (rest.name !== undefined) updateData.name = rest.name.trim()
  if (rest.description !== undefined) updateData.description = normalizeNullableString(rest.description)
  if (rest.syllabus_id !== undefined) updateData.syllabus_id = rest.syllabus_id
  if (rest.passing_score !== undefined) updateData.passing_score = rest.passing_score
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active

  if (!Object.keys(updateData).length) {
    return noStoreJson({ error: "No fields to update" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("exam")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return noStoreJson({ error: "Exam not found" }, { status: 404 })
  }

  const { error } = await supabase.from("exam").update(updateData).eq("tenant_id", tenantId).eq("id", id)
  if (error) {
    return noStoreJson({ error: "Failed to update exam" }, { status: 500 })
  }

  return noStoreJson({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const ctx = await getTenantAdminRouteContext(supabase)
  if (ctx.response) return ctx.response
  const { tenantId } = ctx.context

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
    .from("exam")
    .select("id, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return noStoreJson({ error: "Exam not found" }, { status: 404 })
  }

  if (!existing.is_active) {
    return noStoreJson({ ok: true })
  }

  const { error } = await supabase.from("exam").update({ is_active: false }).eq("tenant_id", tenantId).eq("id", id)
  if (error) {
    return noStoreJson({ error: "Failed to deactivate exam" }, { status: 500 })
  }

  return noStoreJson({ ok: true })
}
