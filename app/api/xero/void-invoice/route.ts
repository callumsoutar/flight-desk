import { z } from "zod"

import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { invalidPayloadResponse } from "@/lib/security/http"
import { logError } from "@/lib/security/logger"

export const dynamic = "force-dynamic"

const schema = z.strictObject({
  invoiceId: z.string().uuid(),
  reason: z.string().min(1, "A reason is required"),
})

export async function POST(request: Request) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return invalidPayloadResponse()

  const { data, error } = await supabase.rpc("void_and_reissue_xero_invoice", {
    p_invoice_id: parsed.data.invoiceId,
    p_reason: parsed.data.reason,
  })

  if (error) {
    logError("[xero] Void invoice RPC failed", {
      error: error.message,
      tenantId,
      invoiceId: parsed.data.invoiceId,
    })
    return noStoreJson({ error: "Failed to void invoice" }, { status: 500 })
  }

  const result = data as { success: boolean; error?: string; message?: string; xero_invoice_id?: string }

  if (!result.success) {
    logError("[xero] Void invoice rejected", {
      error: result.error ?? "Void failed",
      tenantId,
      invoiceId: parsed.data.invoiceId,
    })
    return noStoreJson({ error: "Unable to void invoice" }, { status: 400 })
  }

  return noStoreJson(result)
}
