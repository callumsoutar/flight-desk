import { getXeroClient } from "@/lib/xero/get-xero-client"

export async function syncXeroAccounts(tenantId: string, initiatedBy: string) {
  const { admin, client } = await getXeroClient(tenantId)

  try {
    const [accountsResponse, taxRatesResponse] = await Promise.all([
      client.getAccounts(),
      client.getTaxRates(),
    ])
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

    const taxRates = (taxRatesResponse.TaxRates ?? []).filter(
      (taxRate) => typeof taxRate.TaxType === "string" && taxRate.TaxType.trim().length > 0
    )
    const taxRateUpserts = taxRates.map((taxRate) => ({
      tenant_id: tenantId,
      xero_tax_type: taxRate.TaxType,
      name: taxRate.Name,
      status: taxRate.Status ?? "ACTIVE",
      effective_rate: taxRate.EffectiveRate ?? null,
      display_rate: taxRate.DisplayTaxRate ?? null,
      can_apply_to_assets: taxRate.CanApplyToAssets ?? null,
      can_apply_to_equity: taxRate.CanApplyToEquity ?? null,
      can_apply_to_expenses: taxRate.CanApplyToExpenses ?? null,
      can_apply_to_liabilities: taxRate.CanApplyToLiabilities ?? null,
      can_apply_to_revenue: taxRate.CanApplyToRevenue ?? null,
      report_tax_type: taxRate.ReportTaxType ?? null,
      updated_date_utc: taxRate.UpdatedDateUTC ?? null,
    }))

    if (taxRateUpserts.length > 0) {
      const { error: taxRateUpsertError } = await admin
        .from("xero_tax_rates")
        .upsert(taxRateUpserts, { onConflict: "tenant_id,xero_tax_type" })
      if (taxRateUpsertError) throw taxRateUpsertError
    }

    await admin.from("xero_export_logs").insert({
      tenant_id: tenantId,
      action: "sync_accounts",
      status: "success",
      initiated_by: initiatedBy,
      request_payload: { type: "REVENUE", include_tax_rates: true },
      response_payload: { synced: upserts.length, archived, tax_rates_synced: taxRateUpserts.length },
    })

    return { synced: upserts.length, archived, taxRatesSynced: taxRateUpserts.length }
  } catch (error) {
    console.error("[xero] Account sync failed", {
      tenantId,
      error: error instanceof Error ? error.message : "Unknown account sync error",
    })
    throw error
  }
}
