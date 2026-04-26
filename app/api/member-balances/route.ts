import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchMembersWithBalanceMetrics } from "@/lib/members/fetch-member-balances"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  try {
    const { members, timeZone } = await fetchMembersWithBalanceMetrics(supabase, tenantId)
    return noStoreJson({ members, timeZone })
  } catch {
    return noStoreJson({ error: "Failed to load member balances" }, { status: 500 })
  }
}
