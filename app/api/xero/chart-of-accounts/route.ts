import { NextRequest, NextResponse } from "next/server"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { logWarn } from "@/lib/security/logger"
import { createSupabaseServerClient } from "@/lib/supabase/server"
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
  if (!isStaffRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

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

    return NextResponse.json(
      { accounts, source: "live" },
      { headers: { "cache-control": "no-store" } }
    )
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
      return NextResponse.json(
        { error: "Failed to fetch accounts" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { accounts: data ?? [], source: "cache" },
      { headers: { "cache-control": "no-store" } }
    )
  }
}
