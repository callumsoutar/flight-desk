import { NextResponse } from "next/server"
import { z } from "zod"

import { isAdminRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const schema = z.object({
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
  if (!isAdminRole(role)) return NextResponse.json({ error: "Forbidden — only admins can void invoices" }, { status: 403 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase.rpc("void_and_reissue_xero_invoice", {
    p_invoice_id: parsed.data.invoiceId,
    p_reason: parsed.data.reason,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const result = data as { success: boolean; error?: string; message?: string; xero_invoice_id?: string }

  if (!result.success) {
    return NextResponse.json({ error: result.error || "Void failed" }, { status: 400 })
  }

  return NextResponse.json(result, { headers: { "cache-control": "no-store" } })
}
