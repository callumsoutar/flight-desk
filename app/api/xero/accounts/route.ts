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
    .from("xero_accounts")
    .select("id, xero_account_id, code, name, type, status")
    .eq("tenant_id", tenantId)
    .order("code", { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 })
  return NextResponse.json({ accounts: data ?? [] }, { headers: { "cache-control": "no-store" } })
}
