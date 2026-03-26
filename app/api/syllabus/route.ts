import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const createSchema = z.strictObject({
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1200).optional().nullable(),
  number_of_exams: z.number().int().min(0).max(99).optional(),
  is_active: z.boolean().optional(),
})

const updateSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(1200).optional().nullable(),
  number_of_exams: z.number().int().min(0).max(99).optional(),
  is_active: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const includeInactive = url.searchParams.get("include_inactive") === "true"
  const session = await getTenantScopedRouteContext({
    access: includeInactive ? "admin" : "staff",
  })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  let query = supabase
    .from("syllabus")
    .select("id, name, description, number_of_exams, is_active, created_at, updated_at, voided_at, tenant_id")
    .eq("tenant_id", tenantId)
    .is("voided_at", null)
    .order("name", { ascending: true })

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query
  if (error) {
    return noStoreJson({ error: "Failed to load syllabi" }, { status: 500 })
  }

  return noStoreJson({ syllabi: data ?? [] })
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
  const { data, error } = await supabase
    .from("syllabus")
    .insert({
      tenant_id: tenantId,
      name: payload.name.trim(),
      description: normalizeNullableString(payload.description),
      number_of_exams: payload.number_of_exams ?? 0,
      is_active: payload.is_active ?? true,
    })
    .select("id")
    .single()

  if (error || !data) {
    return noStoreJson({ error: "Failed to create syllabus" }, { status: 500 })
  }

  return noStoreJson({ syllabus: { id: data.id } }, { status: 201 })
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
  if (rest.number_of_exams !== undefined) updateData.number_of_exams = rest.number_of_exams
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active

  if (!Object.keys(updateData).length) {
    return noStoreJson({ error: "No fields to update" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("syllabus")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return noStoreJson({ error: "Syllabus not found" }, { status: 404 })
  }

  const { error } = await supabase.from("syllabus").update(updateData).eq("tenant_id", tenantId).eq("id", id)
  if (error) {
    return noStoreJson({ error: "Failed to update syllabus" }, { status: 500 })
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
    .from("syllabus")
    .select("id, voided_at")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (existingError || !existing) {
    return noStoreJson({ error: "Syllabus not found" }, { status: 404 })
  }

  if (existing.voided_at) {
    return noStoreJson({ ok: true })
  }

  const { error } = await supabase
    .from("syllabus")
    .update({ is_active: false, voided_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (error) {
    return noStoreJson({ error: "Failed to delete syllabus" }, { status: 500 })
  }

  return noStoreJson({ ok: true })
}
