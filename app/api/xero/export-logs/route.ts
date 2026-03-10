import { NextRequest, NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isAdmin(role: string | null) {
  return role === "owner" || role === "admin"
}

export async function GET(request: NextRequest) {
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
  if (!isAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(request.url)
  const invoiceId = url.searchParams.get("invoiceId")
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10)
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, rawLimit)) : 50

  let query = supabase
    .from("xero_export_logs")
    .select("id, invoice_id, action, status, error_message, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (invoiceId) query = query.eq("invoice_id", invoiceId)
  const { data, error } = await query

  if (error) return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 })
  return NextResponse.json({ logs: data ?? [] }, { headers: { "cache-control": "no-store" } })
}
