import { NextResponse } from "next/server"
import { z } from "zod"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type CancellationCategory = {
  id: string
  name: string
  description: string | null
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const payloadSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
})

const patchSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
})

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

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

  const { data, error } = await supabase
    .from("cancellation_categories")
    .select("id, name, description")
    .eq("tenant_id", tenantId)
    .is("voided_at", null)

  if (error) {
    return NextResponse.json(
      { error: "Failed to load cancellation categories" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  const categories = (data as CancellationCategory[]).sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json(
    { categories },
    { headers: { "cache-control": "no-store" } }
  )
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
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

  if (!isAdminRole(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { name, description } = parsed.data

  const { data, error } = await supabase
    .from("cancellation_categories")
    .insert({
      name: name.trim(),
      description: normalizeOptionalString(description) ?? null,
      tenant_id: tenantId,
    })
    .select("id")
    .single()

  if (error) {
    return NextResponse.json(
      { error: "Failed to create cancellation category" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { category: { id: data.id } },
    { headers: { "cache-control": "no-store" } }
  )
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
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

  if (!isAdminRole(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { id, name, description } = parsed.data

  const { data: existing, error: existingError } = await supabase
    .from("cancellation_categories")
    .select("id, tenant_id, voided_at")
    .eq("id", id)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json(
      { error: "Failed to load cancellation category" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  if (!existing || existing.voided_at) {
    return NextResponse.json(
      { error: "Cancellation category not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  if (existing.tenant_id !== tenantId) {
    return NextResponse.json(
      { error: "Cancellation category not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name.trim()
  if (description !== undefined) updates.description = normalizeOptionalString(description) ?? null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No updates provided" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { error: updateError } = await supabase
    .from("cancellation_categories")
    .update(updates)
    .eq("id", id)

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update cancellation category" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } }
  )
}

export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get("id")

  if (!id) {
    return NextResponse.json(
      { error: "Missing id" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
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

  if (!isAdminRole(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: existing, error: existingError } = await supabase
    .from("cancellation_categories")
    .select("id, tenant_id, voided_at")
    .eq("id", id)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json(
      { error: "Failed to load cancellation category" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  if (!existing || existing.voided_at) {
    return NextResponse.json(
      { error: "Cancellation category not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  if (existing.tenant_id !== tenantId) {
    return NextResponse.json(
      { error: "Cancellation category not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  const { error: voidError } = await supabase
    .from("cancellation_categories")
    .update({ voided_at: new Date().toISOString() })
    .eq("id", id)

  if (voidError) {
    return NextResponse.json(
      { error: "Failed to delete cancellation category" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } }
  )
}
