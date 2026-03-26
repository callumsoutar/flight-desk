import { z } from "zod"

import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { exportInvoiceToXero } from "@/lib/xero/export-invoice"

export const dynamic = "force-dynamic"

const bodySchema = z.strictObject({
  invoiceIds: z.array(z.string().uuid()).min(1).max(100),
})

const EXPORT_CONCURRENCY = 3

export async function POST(request: Request) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { user, tenantId } = session.context

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return noStoreJson({ error: "Invalid payload" }, { status: 400 })

  const results: Awaited<ReturnType<typeof exportInvoiceToXero>>[] = []
  const invoiceIds = parsed.data.invoiceIds

  for (let i = 0; i < invoiceIds.length; i += EXPORT_CONCURRENCY) {
    const batch = invoiceIds.slice(i, i + EXPORT_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map((invoiceId) => exportInvoiceToXero(tenantId, invoiceId, user.id))
    )
    results.push(...batchResults)
  }

  return noStoreJson({ results })
}
