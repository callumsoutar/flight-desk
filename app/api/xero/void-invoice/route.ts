import { NextResponse } from "next/server"
import { z } from "zod"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { invalidPayloadResponse } from "@/lib/security/http"
import { logError } from "@/lib/security/logger"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const schema = z.strictObject({
  invoiceId: z.string().uuid(),
  reason: z.string().min(1, "A reason is required"),
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
  if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

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
    return NextResponse.json({ error: "Failed to void invoice" }, { status: 500 })
  }

  const result = data as { success: boolean; error?: string; message?: string; xero_invoice_id?: string }

  if (!result.success) {
    logError("[xero] Void invoice rejected", {
      error: result.error ?? "Void failed",
      tenantId,
      invoiceId: parsed.data.invoiceId,
    })
    return NextResponse.json({ error: "Unable to void invoice" }, { status: 400 })
  }

  return NextResponse.json(result, { headers: { "cache-control": "no-store" } })
}
