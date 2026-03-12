import { NextRequest, NextResponse } from "next/server"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ invoiceId: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { invoiceId } = await context.params
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
  if (!isStaffRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data, error } = await supabase
    .from("xero_invoices")
    .select("invoice_id, export_status, xero_invoice_id, exported_at, error_message")
    .eq("tenant_id", tenantId)
    .eq("invoice_id", invoiceId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: "Failed to load export status" }, { status: 500 })
  return NextResponse.json({ status: data ?? null }, { headers: { "cache-control": "no-store" } })
}
