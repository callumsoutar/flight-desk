import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getTenantScopedRouteContext({ access: "staff" })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const { data, error } = await supabase
    .from("xero_accounts")
    .select("id, xero_account_id, code, name, type, status")
    .eq("tenant_id", tenantId)
    .order("code", { ascending: true, nullsFirst: false })

  if (error) return noStoreJson({ error: "Failed to fetch accounts" }, { status: 500 })
  return noStoreJson({ accounts: data ?? [] })
}
