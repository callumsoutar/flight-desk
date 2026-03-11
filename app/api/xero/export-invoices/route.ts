import { NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { exportInvoiceToXero } from "@/lib/xero/export-invoice"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1).max(100),
})

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

const EXPORT_CONCURRENCY = 3

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

  const results: Awaited<ReturnType<typeof exportInvoiceToXero>>[] = []
  const invoiceIds = parsed.data.invoiceIds

  for (let i = 0; i < invoiceIds.length; i += EXPORT_CONCURRENCY) {
    const batch = invoiceIds.slice(i, i + EXPORT_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map((invoiceId) => exportInvoiceToXero(tenantId, invoiceId, user.id))
    )
    results.push(...batchResults)
  }

  return NextResponse.json({ results }, { headers: { "cache-control": "no-store" } })
}
