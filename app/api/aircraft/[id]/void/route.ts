import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await getTenantScopedRouteContext({ access: "admin" })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const voidedAt = new Date().toISOString()

  const { data, error } = await supabase
    .from("aircraft")
    .update({ voided_at: voidedAt })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("voided_at", null)
    .select("id")
    .maybeSingle()

  if (error) {
    return noStoreJson({ error: "Failed to void aircraft" }, { status: 500 })
  }

  if (!data) {
    return noStoreJson(
      { error: "Aircraft not found or already removed from the active fleet." },
      { status: 404 }
    )
  }

  return noStoreJson({ success: true, voided_at: voidedAt })
}
