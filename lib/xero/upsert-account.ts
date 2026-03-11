import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types"

type XeroAccountPayload = {
  AccountID: string
  Code?: string | null
  Name: string
  Type?: string | null
  Status?: string | null
  Class?: string | null
}

export async function upsertXeroAccount(
  client: SupabaseClient<Database>,
  tenantId: string,
  account: XeroAccountPayload
) {
  const { error } = await client
    .from("xero_accounts")
    .upsert(
      {
        tenant_id: tenantId,
        xero_account_id: account.AccountID,
        code: account.Code ?? null,
        name: account.Name,
        type: account.Type ?? null,
        status: account.Status ?? "ACTIVE",
        class: account.Class ?? null,
      },
      { onConflict: "tenant_id,xero_account_id" }
    )

  if (error) {
    console.error("[xero] Failed to upsert account", {
      tenantId,
      accountId: account.AccountID,
      error: error.message,
    })
    throw error
  }
}

export async function upsertXeroAccountsBatch(
  client: SupabaseClient<Database>,
  tenantId: string,
  accounts: XeroAccountPayload[]
) {
  if (accounts.length === 0) return

  const rows = accounts.map((account) => ({
    tenant_id: tenantId,
    xero_account_id: account.AccountID,
    code: account.Code ?? null,
    name: account.Name,
    type: account.Type ?? null,
    status: account.Status ?? "ACTIVE",
    class: account.Class ?? null,
  }))

  const { error } = await client
    .from("xero_accounts")
    .upsert(rows, { onConflict: "tenant_id,xero_account_id" })

  if (error) {
    console.error("[xero] Failed to batch upsert accounts", {
      tenantId,
      count: accounts.length,
      error: error.message,
    })
    throw error
  }
}
