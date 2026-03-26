import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchInvoiceCreateData } from "@/lib/invoices/fetch-invoice-create-data"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  try {
    const createData = await fetchInvoiceCreateData(supabase, tenantId)
    return noStoreJson({ members: createData.members })
  } catch {
    return noStoreJson({ error: "Failed to load members" }, { status: 500 })
  }
}
