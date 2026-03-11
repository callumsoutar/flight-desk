import { getXeroClient } from "@/lib/xero/get-xero-client"

export async function syncXeroAccounts(tenantId: string, initiatedBy: string) {
  const { admin, client } = await getXeroClient(tenantId)

  try {
    const accountsResponse = await client.getAccounts()
    const accounts = (accountsResponse.Accounts ?? []).filter((account) => account.Type === "REVENUE")

    const xeroIds = accounts.map((account) => account.AccountID)
    const upserts = accounts.map((account) => ({
      tenant_id: tenantId,
      xero_account_id: account.AccountID,
      code: account.Code ?? null,
      name: account.Name,
      type: account.Type ?? null,
      status: account.Status ?? "ACTIVE",
      class: account.Class ?? null,
    }))

    if (upserts.length > 0) {
      const { error: upsertError } = await admin
        .from("xero_accounts")
        .upsert(upserts, { onConflict: "tenant_id,xero_account_id" })
      if (upsertError) throw upsertError
    }

    let archived = 0
    const { data: previous, error: previousError } = await admin
      .from("xero_accounts")
      .select("id, xero_account_id")
      .eq("tenant_id", tenantId)

    if (previousError) throw previousError

    const idsToArchive = (previous ?? [])
      .filter((row) => !xeroIds.includes(row.xero_account_id))
      .map((row) => row.id)
    archived = idsToArchive.length

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
      request_payload: { type: "REVENUE", include_tax_rates: false },
      response_payload: { synced: upserts.length, archived },
    })

    return { synced: upserts.length, archived }
  } catch (error) {
    console.error("[xero] Account sync failed", {
      tenantId,
      error: error instanceof Error ? error.message : "Unknown account sync error",
    })
    throw error
  }
}
