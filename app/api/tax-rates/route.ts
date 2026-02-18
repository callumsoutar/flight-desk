import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  }

  const isDefaultFilter = request.nextUrl.searchParams.get("is_default")
  const isDefault =
    isDefaultFilter === "true" ? true : isDefaultFilter === "false" ? false : undefined

  let query = supabase
    .from("tax_rates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("effective_from", { ascending: false })

  if (isDefault !== undefined) {
    query = query.eq("is_default", isDefault)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: "Failed to fetch tax rates" }, { status: 500 })
  }

  return NextResponse.json({ tax_rates: data ?? [] }, { headers: { "cache-control": "no-store" } })
}
