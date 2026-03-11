import { getXeroClient } from "@/lib/xero/get-xero-client"

/**
 * Refreshes only the accounts already cached in xero_accounts.
 * Does NOT pull in new accounts — new accounts are only cached
 * when a user selects them from the live Xero dropdown.
 *
 * This ensures account metadata (name, code, status) stays current
 * for accounts the tenant actually uses, and archives any that
 * Xero has since deactivated.
 */
export async function syncXeroAccounts(tenantId: string, initiatedBy: string) {
  const { admin, client } = await getXeroClient(tenantId)

  try {
    const { data: cachedAccounts, error: cachedError } = await admin
      .from("xero_accounts")
      .select("id, xero_account_id")
      .eq("tenant_id", tenantId)

    if (cachedError) throw cachedError

    if (!cachedAccounts?.length) {
      await admin.from("xero_export_logs").insert({
        tenant_id: tenantId,
        action: "sync_accounts",
        status: "success",
        initiated_by: initiatedBy,
        request_payload: { mode: "refresh_cached_only" },
        response_payload: { refreshed: 0, archived: 0, message: "No cached accounts to refresh" },
      })
      return { refreshed: 0, archived: 0 }
    }

    const accountsResponse = await client.getAccounts()
    const xeroAccounts = accountsResponse.Accounts ?? []

    const xeroMap = new Map(
      xeroAccounts.map((account) => [account.AccountID, account])
    )

    const cachedXeroIds = cachedAccounts.map((row) => row.xero_account_id)

    const toRefresh = cachedXeroIds
      .filter((xeroId) => xeroMap.has(xeroId))
      .map((xeroId) => {
        const account = xeroMap.get(xeroId)!
        return {
          tenant_id: tenantId,
          xero_account_id: account.AccountID,
          code: account.Code ?? null,
          name: account.Name,
          type: account.Type ?? null,
          status: account.Status ?? "ACTIVE",
          class: account.Class ?? null,
        }
      })

    if (toRefresh.length > 0) {
      const { error: upsertError } = await admin
        .from("xero_accounts")
        .upsert(toRefresh, { onConflict: "tenant_id,xero_account_id" })
      if (upsertError) throw upsertError
    }

    const idsToArchive = cachedAccounts
      .filter((row) => {
        const xeroAccount = xeroMap.get(row.xero_account_id)
        return !xeroAccount || xeroAccount.Status !== "ACTIVE"
      })
      .map((row) => row.id)

    if (idsToArchive.length > 0) {
      const { error: archiveError } = await admin
        .from("xero_accounts")
        .update({ status: "ARCHIVED" })
        .eq("tenant_id", tenantId)
        .in("id", idsToArchive)
      if (archiveError) throw archiveError
    }

    await admin.from("xero_export_logs").insert({
      tenant_id: tenantId,
      action: "sync_accounts",
      status: "success",
      initiated_by: initiatedBy,
      request_payload: { mode: "refresh_cached_only" },
      response_payload: { refreshed: toRefresh.length, archived: idsToArchive.length },
    })

    return { refreshed: toRefresh.length, archived: idsToArchive.length }
  } catch (error) {
    console.error("[xero] Account sync failed", {
      tenantId,
      error: error instanceof Error ? error.message : "Unknown account sync error",
    })
    throw error
  }
}
