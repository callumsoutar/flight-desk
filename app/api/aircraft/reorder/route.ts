import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

const reorderSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      id: z.string().uuid(),
      order: z.number().int().min(1),
    })
  ),
})

export async function PATCH(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ access: "staff" })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = reorderSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const items = parsed.data.items
  if (!items.length) {
    return noStoreJson({ error: "No aircraft to reorder" }, { status: 400 })
  }

  const ids = items.map((item) => item.id)

  const { data: existing, error: existingError } = await supabase
    .from("aircraft")
    .select("id")
    .eq("tenant_id", tenantId)
    .is("voided_at", null)
    .in("id", ids)

  if (existingError) {
    return noStoreJson({ error: "Failed to validate aircraft list" }, { status: 500 })
  }

  const existingIds = new Set((existing ?? []).map((row) => row.id))
  if (existingIds.size !== ids.length) {
    return noStoreJson({ error: "One or more aircraft were not found" }, { status: 404 })
  }

  const updateResults = await Promise.all(
    items.map((item) =>
      supabase
        .from("aircraft")
        .update({ order: item.order })
        .eq("tenant_id", tenantId)
        .eq("id", item.id)
        .is("voided_at", null)
    )
  )

  const updateError = updateResults.find((result) => result.error)?.error
  if (updateError) {
    return noStoreJson({ error: "Failed to update aircraft order" }, { status: 500 })
  }

  return noStoreJson({ success: true })
}
