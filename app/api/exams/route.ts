import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isSettingsAdmin(role: string | null) {
  return role === "owner" || role === "admin"
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(2000).optional().nullable(),
  syllabus_id: z.string().uuid().optional().nullable(),
  passing_score: z.number().int().min(0).max(100),
  is_active: z.boolean().optional(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  syllabus_id: z.string().uuid().optional().nullable(),
  passing_score: z.number().int().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const includeInactive = request.nextUrl.searchParams.get("include_inactive") === "true"
  const { user, tenantId, role } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: includeInactive,
    authoritativeRole: includeInactive,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Account not configured" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  if (includeInactive && !isSettingsAdmin(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

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
    return NextResponse.json(
      { error: "Failed to load exams" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { exams: data ?? [] },
    { headers: { "cache-control": "no-store" } }
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId, role } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } })
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Account not configured" }, { status: 400, headers: { "cache-control": "no-store" } })
  }
  if (!isSettingsAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "cache-control": "no-store" } })
  }

  const raw = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: { "cache-control": "no-store" } })
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
    return NextResponse.json(
      { error: "Failed to create exam" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json({ exam: { id: data.id } }, { status: 201, headers: { "cache-control": "no-store" } })
}

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId, role } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } })
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Account not configured" }, { status: 400, headers: { "cache-control": "no-store" } })
  }
  if (!isSettingsAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "cache-control": "no-store" } })
  }

  const raw = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: { "cache-control": "no-store" } })
  }

  const { id, ...rest } = parsed.data
  const updateData: Record<string, unknown> = {}
  if (rest.name !== undefined) updateData.name = rest.name.trim()
  if (rest.description !== undefined) updateData.description = normalizeNullableString(rest.description)
  if (rest.syllabus_id !== undefined) updateData.syllabus_id = rest.syllabus_id
  if (rest.passing_score !== undefined) updateData.passing_score = rest.passing_score
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active

  if (!Object.keys(updateData).length) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: existing, error: existingError } = await supabase
    .from("exam")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Exam not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  const { error } = await supabase.from("exam").update(updateData).eq("tenant_id", tenantId).eq("id", id)
  if (error) {
    return NextResponse.json(
      { error: "Failed to update exam" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId, role } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } })
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Account not configured" }, { status: 400, headers: { "cache-control": "no-store" } })
  }
  if (!isSettingsAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "cache-control": "no-store" } })
  }

  const url = new URL(request.url)
  const idFromQuery = url.searchParams.get("id")
  const rawBody = await request.json().catch(() => null)
  const idFromBody =
    rawBody && typeof rawBody === "object" && typeof (rawBody as { id?: unknown }).id === "string"
      ? (rawBody as { id: string }).id
      : null
  const id = idFromQuery || idFromBody

  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: { "cache-control": "no-store" } })
  }

  const { data: existing, error: existingError } = await supabase
    .from("exam")
    .select("id, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Exam not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  if (!existing.is_active) {
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
  }

  const { error } = await supabase.from("exam").update({ is_active: false }).eq("tenant_id", tenantId).eq("id", id)
  if (error) {
    return NextResponse.json(
      { error: "Failed to deactivate exam" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}
