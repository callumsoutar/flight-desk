import { z } from "zod"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged"
import { exportInvoiceToXero } from "@/lib/xero/export-invoice"

export const dynamic = "force-dynamic"

const schema = z.strictObject({
  invoiceId: z.string().uuid(),
})

export async function POST(request: Request) {
  const session = await getTenantScopedRouteContext({ access: "staff" })
  if (session.response) return session.response
  const { user, tenantId } = session.context

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return noStoreJson({ error: "Invalid payload" }, { status: 400 })

  const admin = createPrivilegedSupabaseClient("reset failed Xero export state before retry")
  const { data: failedRow } = await admin
    .from("xero_invoices")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("invoice_id", parsed.data.invoiceId)
    .eq("export_status", "failed")
    .maybeSingle()

  if (!failedRow?.id) {
    return noStoreJson({ error: "Invoice is not in failed export state" }, { status: 400 })
  }

  const { error: resetError } = await admin
    .from("xero_invoices")
    .update({
      export_status: "voided",
      error_message: "Retry requested by user",
    })
    .eq("id", failedRow.id)

  if (resetError) {
    return noStoreJson({ error: "Failed to reset export state" }, { status: 500 })
  }

  const result = await exportInvoiceToXero(tenantId, parsed.data.invoiceId, user.id)

  await admin.from("xero_export_logs").insert({
    tenant_id: tenantId,
    invoice_id: parsed.data.invoiceId,
    action: "retry_export",
    status: result.status === "failed" ? "error" : "success",
    initiated_by: user.id,
    error_message: "error" in result ? result.error : null,
    response_payload: result,
  })

  return noStoreJson(result)
}
