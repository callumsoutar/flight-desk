import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("flight_types")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .is("voided_at", null)
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: "Failed to fetch flight types" }, { status: 500 })
  }

  return NextResponse.json({ flight_types: data ?? [] }, { headers: { "cache-control": "no-store" } })
}
