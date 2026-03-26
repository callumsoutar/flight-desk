import { NextRequest } from "next/server"

import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ invoiceId: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { invoiceId } = await context.params
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const { data, error } = await supabase
    .from("xero_invoices")
    .select("invoice_id, export_status, xero_invoice_id, exported_at, error_message")
    .eq("tenant_id", tenantId)
    .eq("invoice_id", invoiceId)
    .maybeSingle()

  if (error) return noStoreJson({ error: "Failed to load export status" }, { status: 500 })
  return noStoreJson({ status: data ?? null })
}
