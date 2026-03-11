import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    includeTenant: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!tenantId) return NextResponse.json({ error: "Account not configured" }, { status: 400 })
  if (!isStaff(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data, error } = await supabase
    .from("xero_tax_rates")
    .select("id, xero_tax_type, name, status, effective_rate, display_rate")
    .eq("tenant_id", tenantId)
    .order("xero_tax_type", { ascending: true })

  if (error) return NextResponse.json({ error: "Failed to fetch tax rates" }, { status: 500 })
  return NextResponse.json({ taxRates: data ?? [] }, { headers: { "cache-control": "no-store" } })
}
