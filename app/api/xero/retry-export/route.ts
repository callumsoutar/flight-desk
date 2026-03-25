import { NextResponse } from "next/server"
import { z } from "zod"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { exportInvoiceToXero } from "@/lib/xero/export-invoice"

export const dynamic = "force-dynamic"

const schema = z.strictObject({
  invoiceId: z.string().uuid(),
})

export async function POST(request: Request) {
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

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { data: failedRow } = await admin
    .from("xero_invoices")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("invoice_id", parsed.data.invoiceId)
    .eq("export_status", "failed")
    .maybeSingle()

  if (!failedRow?.id) {
    return NextResponse.json({ error: "Invoice is not in failed export state" }, { status: 400 })
  }

  const { error: resetError } = await admin
    .from("xero_invoices")
    .update({
      export_status: "voided",
      error_message: "Retry requested by user",
    })
    .eq("id", failedRow.id)

  if (resetError) {
    return NextResponse.json({ error: "Failed to reset export state" }, { status: 500 })
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

  return NextResponse.json(result, { headers: { "cache-control": "no-store" } })
}
