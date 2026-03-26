import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import type { Json } from "@/lib/types"

export const dynamic = "force-dynamic"

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const patchSchema = z.strictObject({
  name: z.string().trim().min(1).max(140).optional(),
  code: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  duration_months: z.number().int().min(1).max(1200).optional(),
  benefits: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  is_active: z.boolean().optional(),
  chargeable_id: z.string().uuid().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return noStoreJson({ error: "Invalid id" }, { status: 400 })
  }

  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const payload = parsed.data
  const updateData: Record<string, unknown> = {}
  if (payload.name !== undefined) updateData.name = payload.name.trim()
  if (payload.code !== undefined) updateData.code = payload.code.trim()
  if (payload.description !== undefined) updateData.description = normalizeNullableString(payload.description)
  if (payload.duration_months !== undefined) updateData.duration_months = payload.duration_months
  if (payload.is_active !== undefined) updateData.is_active = payload.is_active
  if (payload.chargeable_id !== undefined) updateData.chargeable_id = payload.chargeable_id
  if (payload.benefits !== undefined) updateData.benefits = payload.benefits as unknown as Json

  if (!Object.keys(updateData).length) {
    return noStoreJson({ error: "No fields to update" }, { status: 400 })
  }

  if (payload.chargeable_id) {
    const { data: chargeable, error: chargeableError } = await supabase
      .from("chargeables")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", payload.chargeable_id)
      .eq("is_active", true)
      .is("voided_at", null)
      .maybeSingle()

    if (chargeableError || !chargeable) {
      return noStoreJson({ error: "Linked chargeable not found" }, { status: 404 })
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from("membership_types")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (existingError || !existing) {
    return noStoreJson({ error: "Membership type not found" }, { status: 404 })
  }

  const { error } = await supabase
    .from("membership_types")
    .update(updateData)
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (error) {
    return noStoreJson({ error: "Failed to update membership type" }, { status: 500 })
  }

  return noStoreJson({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return noStoreJson({ error: "Invalid id" }, { status: 400 })
  }

  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const { data: existing, error: existingError } = await supabase
    .from("membership_types")
    .select("id, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle()

  if (existingError || !existing) {
    return noStoreJson({ error: "Membership type not found" }, { status: 404 })
  }

  if (!existing.is_active) {
    return noStoreJson({ ok: true })
  }

  const { error } = await supabase
    .from("membership_types")
    .update({ is_active: false })
    .eq("tenant_id", tenantId)
    .eq("id", id)

  if (error) {
    return noStoreJson({ error: "Failed to delete membership type" }, { status: 500 })
  }

  return noStoreJson({ ok: true })
}
