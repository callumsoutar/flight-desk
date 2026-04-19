import type { SupabaseClient } from "@supabase/supabase-js"
import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import type { Database } from "@/lib/types/database"

export const dynamic = "force-dynamic"

const instructionTypeSchema = z.enum(["dual", "solo", "trial"])

const createSchema = z.strictObject({
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1200).optional().nullable(),
  instruction_type: instructionTypeSchema,
  aircraft_gl_code: z.string().trim().max(20).optional().nullable(),
  instructor_gl_code: z.string().trim().max(20).optional().nullable(),
  is_active: z.boolean().optional(),
})

const updateSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(1200).optional().nullable(),
  instruction_type: instructionTypeSchema.optional(),
  aircraft_gl_code: z.string().trim().max(20).optional().nullable(),
  instructor_gl_code: z.string().trim().max(20).optional().nullable(),
  is_active: z.boolean().optional(),
})

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

async function tenantHasXeroConnection(supabase: SupabaseClient<Database>, tenantId: string) {
  const { data, error } = await supabase
    .from("xero_connections")
    .select("id")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const includeInactive = url.searchParams.get("include_inactive") === "true"
  const session = await getTenantScopedRouteContext({
    access: includeInactive ? "admin" : "authenticated",
    authoritativeRole: includeInactive,
  })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  let query = supabase
    .from("flight_types")
    .select(
      "id, name, description, instruction_type, aircraft_gl_code, instructor_gl_code, is_active, is_default_solo, updated_at"
    )
    .eq("tenant_id", tenantId)
    .is("voided_at", null)
    .order("name", { ascending: true })

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query

  if (error) {
    return noStoreJson({ error: "Failed to fetch flight types" }, { status: 500 })
  }

  return noStoreJson({ flight_types: data ?? [] })
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
  const xeroLinked = await tenantHasXeroConnection(supabase, tenantId)
  if (
    xeroLinked &&
    payload.instruction_type !== "solo" &&
    !normalizeNullableString(payload.instructor_gl_code)
  ) {
    return noStoreJson({ error: "Instructor GL code is required for dual/trial flight types" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("flight_types")
    .insert({
      tenant_id: tenantId,
      name: payload.name.trim(),
      description: normalizeNullableString(payload.description),
      instruction_type: payload.instruction_type,
      aircraft_gl_code: normalizeNullableString(payload.aircraft_gl_code),
      instructor_gl_code:
        payload.instruction_type === "solo" ? null : normalizeNullableString(payload.instructor_gl_code),
      is_active: payload.is_active ?? true,
      is_default_solo: false,
    })
    .select("id")
    .single()

  if (error || !data) {
    return noStoreJson({ error: "Failed to create flight type" }, { status: 500 })
  }

  return noStoreJson({ ok: true }, { status: 201 })
}

export async function PUT(request: NextRequest) {
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
  if (rest.instruction_type !== undefined) updateData.instruction_type = rest.instruction_type
  if (rest.aircraft_gl_code !== undefined) {
    updateData.aircraft_gl_code = normalizeNullableString(rest.aircraft_gl_code)
  }
  if (rest.instructor_gl_code !== undefined) {
    updateData.instructor_gl_code = normalizeNullableString(rest.instructor_gl_code)
  }
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active

  if (!Object.keys(updateData).length) {
    return noStoreJson({ error: "No fields to update" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("flight_types")
    .select("id, instruction_type, instructor_gl_code")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return noStoreJson({ error: "Flight type not found" }, { status: 404 })
  }

  const nextInstructionType =
    (updateData.instruction_type as "dual" | "solo" | "trial" | undefined) ??
    (existing.instruction_type as "dual" | "solo" | "trial")
  const nextInstructorGlCode =
    (updateData.instructor_gl_code as string | null | undefined) ?? existing.instructor_gl_code

  const xeroLinked = await tenantHasXeroConnection(supabase, tenantId)
  if (xeroLinked && nextInstructionType !== "solo" && !nextInstructorGlCode) {
    return noStoreJson({ error: "Instructor GL code is required for dual/trial flight types" }, { status: 400 })
  }
  if (nextInstructionType === "solo") {
    updateData.instructor_gl_code = null
  }

  const { error } = await supabase
    .from("flight_types")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (error) {
    return noStoreJson({ error: "Failed to update flight type" }, { status: 500 })
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
  const idFromBody = rawBody && typeof rawBody === "object" && typeof (rawBody as { id?: unknown }).id === "string"
    ? ((rawBody as { id: string }).id)
    : null
  const id = idFromQuery || idFromBody

  if (!id || !z.string().uuid().safeParse(id).success) {
    return noStoreJson({ error: "Invalid id" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("flight_types")
    .select("id, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return noStoreJson({ error: "Flight type not found" }, { status: 404 })
  }

  if (!existing.is_active) {
    return noStoreJson({ ok: true })
  }

  const { error } = await supabase
    .from("flight_types")
    .update({ is_active: false })
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (error) {
    return noStoreJson({ error: "Failed to deactivate flight type" }, { status: 500 })
  }

  return noStoreJson({ ok: true })
}
