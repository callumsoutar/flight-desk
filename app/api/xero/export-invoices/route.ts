import { NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { exportInvoiceToXero } from "@/lib/xero/export-invoice"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1),
})

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

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
  if (!isStaff(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const results = await Promise.all(
    parsed.data.invoiceIds.map((invoiceId) => exportInvoiceToXero(tenantId, invoiceId, user.id))
  )

  return NextResponse.json({ results }, { headers: { "cache-control": "no-store" } })
}
