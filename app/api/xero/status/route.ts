import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchXeroSettings } from "@/lib/settings/fetch-xero-settings"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const [{ data: connection, error }, settings] = await Promise.all([
    supabase
      .from("xero_connections")
      .select("xero_tenant_name, created_at")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    fetchXeroSettings(supabase, tenantId),
  ])

  if (error) return noStoreJson({ error: "Failed to fetch status" }, { status: 500 })

  return noStoreJson(
    {
      connected: Boolean(connection),
      xero_tenant_name: connection?.xero_tenant_name ?? null,
      connected_at: settings.connected_at ?? connection?.created_at ?? null,
      enabled: settings.enabled,
    }
  )
}
