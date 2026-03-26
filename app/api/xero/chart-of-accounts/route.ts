import { NextRequest } from "next/server"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { logWarn } from "@/lib/security/logger"
import { getXeroClient } from "@/lib/xero/get-xero-client"
import type { XeroAccount } from "@/lib/xero/types"

export const dynamic = "force-dynamic"

type AccountResult = {
  xero_account_id: string
  code: string | null
  name: string
  type: string | null
  status: string | null
}

function mapXeroAccount(account: XeroAccount): AccountResult {
  return {
    xero_account_id: account.AccountID,
    code: account.Code ?? null,
    name: account.Name,
    type: account.Type ?? null,
    status: account.Status ?? null,
  }
}

export async function GET(request: NextRequest) {
  const session = await getTenantScopedRouteContext({ access: "staff" })
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const url = new URL(request.url)
  const typeFilter = url.searchParams.get("type")

  try {
    const { client } = await getXeroClient(tenantId)
    const accountsResponse = await client.getAccounts()
    const allAccounts = accountsResponse.Accounts ?? []

    let filtered = allAccounts.filter(
      (account) => account.Status === "ACTIVE"
    )

    if (typeFilter) {
      const types = typeFilter.split(",").map((t) => t.trim().toUpperCase())
      filtered = filtered.filter((account) =>
        account.Type ? types.includes(account.Type.toUpperCase()) : false
      )
    }

    const accounts: AccountResult[] = filtered.map(mapXeroAccount)

    return noStoreJson({ accounts, source: "live" })
  } catch (error) {
    logWarn("[xero] Live fetch failed, falling back to cache", {
      tenantId,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    let query = supabase
      .from("xero_accounts")
      .select("xero_account_id, code, name, type, status")
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE")
      .order("code", { ascending: true, nullsFirst: false })

    if (typeFilter) {
      const types = typeFilter.split(",").map((t) => t.trim().toUpperCase())
      query = query.in("type", types)
    }

    const { data, error: dbError } = await query
    if (dbError) {
      return noStoreJson({ error: "Failed to fetch accounts" }, { status: 500 })
    }

    return noStoreJson({ accounts: data ?? [], source: "cache" })
  }
}
