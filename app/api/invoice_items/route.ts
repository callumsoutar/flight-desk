import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { isStaffRole } from "@/lib/auth/roles"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ includeRole: true })
  if (session.response) return session.response
  const { supabase, user, role, tenantId } = session.context

  const invoiceId = request.nextUrl.searchParams.get("invoice_id")
  if (!invoiceId) {
    return noStoreJson({ error: "invoice_id is required" }, { status: 400 })
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, user_id")
    .eq("tenant_id", tenantId)
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (invoiceError) {
    return noStoreJson({ error: "Failed to load invoice" }, { status: 500 })
  }

  if (!invoice) {
    return noStoreJson({ error: "Invoice not found" }, { status: 404 })
  }

  if (!isStaffRole(role) && invoice.user_id !== user.id) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("invoice_id", invoiceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) {
    return noStoreJson({ error: "Failed to load invoice items" }, { status: 500 })
  }

  return noStoreJson({ invoice_items: data ?? [] })
}
