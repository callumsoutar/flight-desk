import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { logError } from "@/lib/security/logger"
import { syncXeroAccounts } from "@/lib/xero/sync-accounts"

export const dynamic = "force-dynamic"

export async function POST() {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { user, tenantId } = session.context

  try {
    const result = await syncXeroAccounts(tenantId, user.id)
    return noStoreJson(result)
  } catch (error) {
    logError("[xero] Account sync endpoint failed", { error, tenantId, userId: user.id })
    return noStoreJson({ error: "Sync failed" }, { status: 500 })
  }
}
