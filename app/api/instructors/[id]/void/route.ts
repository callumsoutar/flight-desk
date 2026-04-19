import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params

  const session = await getTenantScopedRouteContext({ access: "admin" })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const voidedAt = new Date().toISOString()

  const { data, error } = await supabase
    .from("instructors")
    .update({ voided_at: voidedAt, updated_at: voidedAt })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .is("voided_at", null)
    .select("id")
    .maybeSingle()

  if (error) {
    return noStoreJson({ error: "Failed to remove instructor" }, { status: 500 })
  }

  if (!data) {
    return noStoreJson(
      { error: "Instructor not found or already removed." },
      { status: 404 }
    )
  }

  return noStoreJson({ success: true, voided_at: voidedAt })
}
