import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

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
  description: z.string().trim().max(1200).optional().nullable(),
  is_active: z.boolean().optional(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(1200).optional().nullable(),
  is_active: z.boolean().optional(),
})

async function loadSession(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  options: { includeRole?: boolean; includeTenant?: boolean; requireUser?: boolean; authoritativeRole?: boolean; authoritativeTenant?: boolean }
) {
  return getAuthSession(supabase, {
    includeRole: options.includeRole ?? true,
    includeTenant: options.includeTenant ?? true,
    requireUser: options.requireUser ?? true,
    authoritativeRole: options.authoritativeRole ?? true,
    authoritativeTenant: options.authoritativeTenant ?? true,
  })
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const url = new URL(request.url)
  const includeInactive = url.searchParams.get("include_inactive") === "true"

  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: includeInactive,
    authoritativeTenant: includeInactive,
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

  if (includeInactive) {
    if (!isSettingsAdmin(role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: { "cache-control": "no-store" } }
      )
    }
  } else if (!isStaff(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  let query = supabase
    .from("experience_types")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("voided_at", null)
    .order("name", { ascending: true })

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { error: "Failed to load experience types" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { experience_types: data ?? [] },
    { headers: { "cache-control": "no-store" } }
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await loadSession(supabase, {})

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

  if (!isSettingsAdmin(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const raw = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const payload = parsed.data
  const { data, error } = await supabase
    .from("experience_types")
    .insert({
      tenant_id: tenantId,
      name: payload.name.trim(),
      description: normalizeNullableString(payload.description),
      is_active: payload.is_active ?? true,
    })
    .select("id")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to create experience type" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { experience_type: { id: data.id } },
    { status: 201, headers: { "cache-control": "no-store" } }
  )
}

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await loadSession(supabase, {})

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

  if (!isSettingsAdmin(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const raw = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { id, ...rest } = parsed.data
  const updateData: Record<string, unknown> = {}
  if (rest.name !== undefined) updateData.name = rest.name.trim()
  if (rest.description !== undefined) updateData.description = normalizeNullableString(rest.description)
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active

  if (!Object.keys(updateData).length) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: existing, error: existingError } = await supabase
    .from("experience_types")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Experience type not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  const { error } = await supabase
    .from("experience_types")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (error) {
    return NextResponse.json(
      { error: "Failed to update experience type" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await loadSession(supabase, {})

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

  if (!isSettingsAdmin(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
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
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: existing, error: existingError } = await supabase
    .from("experience_types")
    .select("id, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle()

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Experience type not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  if (!existing.is_active) {
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
  }

  const { error } = await supabase
    .from("experience_types")
    .update({ is_active: false })
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (error) {
    return NextResponse.json(
      { error: "Failed to deactivate experience type" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}
