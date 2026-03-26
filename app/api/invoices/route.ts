import { NextRequest } from "next/server"

import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchInvoices } from "@/lib/invoices/fetch-invoices"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const includeXero = request.nextUrl.searchParams.get("include_xero") === "true"

  try {
    const invoices = await fetchInvoices(supabase, tenantId, undefined, includeXero)
    return noStoreJson({ invoices })
  } catch {
    return noStoreJson({ error: "Failed to load invoices" }, { status: 500 })
  }
}
