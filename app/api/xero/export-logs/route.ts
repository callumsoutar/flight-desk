import { NextRequest } from "next/server"

import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

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

  if (error) return noStoreJson({ error: "Failed to fetch logs" }, { status: 500 })
  return noStoreJson({ logs: data ?? [] })
}
