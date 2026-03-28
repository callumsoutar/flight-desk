import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { isStaffRole } from "@/lib/auth/roles"
import { getEffectiveInvoiceStatus } from "@/lib/invoices/effective-status"

export const dynamic = "force-dynamic"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getTenantScopedRouteContext({ includeRole: true })
  if (session.response) return session.response
  const { supabase, user, role, tenantId } = session.context

  const { id } = await context.params
  const { data: tenant } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .maybeSingle()
  const timeZone = tenant?.timezone?.trim() || "Pacific/Auckland"

  const { data, error } = await supabase
    .from("invoices")
    .select("*, user:user_directory!invoices_user_id_fkey(id, first_name, last_name, email)")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return noStoreJson({ error: "Failed to load invoice" }, { status: 500 })
  }

  if (!data) {
    return noStoreJson({ error: "Invoice not found" }, { status: 404 })
  }

  if (!isStaffRole(role) && data.user_id !== user.id) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 })
  }

  const invoice = {
    ...data,
    user: pickMaybeOne(data.user),
    status: getEffectiveInvoiceStatus({
      status: data.status,
      dueDate: data.due_date,
      balanceDue: data.balance_due,
      timeZone,
    }),
  }

  const { data: xeroStatus } = await supabase
    .from("xero_invoices")
    .select("export_status, xero_invoice_id, exported_at, error_message")
    .eq("tenant_id", tenantId)
    .eq("invoice_id", id)
    .maybeSingle()

  return noStoreJson({
    invoice,
    xero_status: xeroStatus
      ? {
          export_status: xeroStatus.export_status,
          xero_invoice_id: xeroStatus.xero_invoice_id,
          exported_at: xeroStatus.exported_at,
          error_message: xeroStatus.error_message,
        }
      : null,
  })
}
