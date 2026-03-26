import { getTenantAdminRouteContext, getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { z } from "zod"

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
  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const { data, error } = await supabase
    .from("cancellation_categories")
    .select("id, name, description")
    .eq("tenant_id", tenantId)
    .is("voided_at", null)

  if (error) {
    return noStoreJson({ error: "Failed to load cancellation categories" }, { status: 500 })
  }

  const categories = (data as CancellationCategory[]).sort((a, b) => a.name.localeCompare(b.name))

  return noStoreJson({ categories })
}

export async function POST(request: Request) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
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
    return noStoreJson({ error: "Failed to create cancellation category" }, { status: 500 })
  }

  return noStoreJson({ category: { id: data.id } })
}

export async function PATCH(request: Request) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const { id, name, description } = parsed.data

  const { data: existing, error: existingError } = await supabase
    .from("cancellation_categories")
    .select("id, tenant_id, voided_at")
    .eq("id", id)
    .maybeSingle()

  if (existingError) {
    return noStoreJson({ error: "Failed to load cancellation category" }, { status: 500 })
  }

  if (!existing || existing.voided_at) {
    return noStoreJson({ error: "Cancellation category not found" }, { status: 404 })
  }

  if (existing.tenant_id !== tenantId) {
    return noStoreJson({ error: "Cancellation category not found" }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name.trim()
  if (description !== undefined) updates.description = normalizeOptionalString(description) ?? null

  if (Object.keys(updates).length === 0) {
    return noStoreJson({ error: "No updates provided" }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from("cancellation_categories")
    .update(updates)
    .eq("id", id)

  if (updateError) {
    return noStoreJson({ error: "Failed to update cancellation category" }, { status: 500 })
  }

  return noStoreJson({ ok: true })
}

export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get("id")

  if (!id) {
    return noStoreJson({ error: "Missing id" }, { status: 400 })
  }

  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const { data: existing, error: existingError } = await supabase
    .from("cancellation_categories")
    .select("id, tenant_id, voided_at")
    .eq("id", id)
    .maybeSingle()

  if (existingError) {
    return noStoreJson({ error: "Failed to load cancellation category" }, { status: 500 })
  }

  if (!existing || existing.voided_at) {
    return noStoreJson({ error: "Cancellation category not found" }, { status: 404 })
  }

  if (existing.tenant_id !== tenantId) {
    return noStoreJson({ error: "Cancellation category not found" }, { status: 404 })
  }

  const { error: voidError } = await supabase
    .from("cancellation_categories")
    .update({ voided_at: new Date().toISOString() })
    .eq("id", id)

  if (voidError) {
    return noStoreJson({ error: "Failed to delete cancellation category" }, { status: 500 })
  }

  return noStoreJson({ ok: true })
}
