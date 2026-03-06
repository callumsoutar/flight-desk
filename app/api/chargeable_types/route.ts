import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function parseBoolean(value: string | null) {
  if (value === "true") return true
  if (value === "false") return false
  return undefined
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase, { requireUser: true })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
  }

  const url = new URL(request.url)
  const isActive = parseBoolean(url.searchParams.get("is_active"))
  const excludeCode = url.searchParams.get("exclude_code")

  let query = supabase
    .from("chargeable_types")
    .select("id, code, name, description, is_active, is_global, is_system, tenant_id, updated_at")
    .or(`tenant_id.eq.${tenantId},is_global.eq.true`)
    .order("name", { ascending: true })

  if (isActive !== undefined) {
    query = query.eq("is_active", isActive)
  }
  if (excludeCode) {
    query = query.neq("code", excludeCode)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: "Failed to fetch chargeable types" }, { status: 500 })
  }

  return NextResponse.json({ chargeable_types: data ?? [] }, { headers: { "cache-control": "no-store" } })
}

