import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { logWarn } from "@/lib/security/logger"
import { getXeroClient } from "@/lib/xero/get-xero-client"
import { XeroAuthError } from "@/lib/xero/types"
import type { XeroTaxRate } from "@/lib/xero/types"

export const dynamic = "force-dynamic"

type TaxRateOption = {
  tax_type: string
  name: string
  display_rate: string | null
}

function mapXeroTaxRate(rate: XeroTaxRate): TaxRateOption {
  return {
    tax_type: rate.TaxType,
    name: rate.Name ?? rate.TaxType,
    display_rate: rate.DisplayTaxRate ?? null,
  }
}

export async function GET() {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { tenantId } = session.context

  try {
    const { client } = await getXeroClient(tenantId)
    const response = await client.getTaxRates()
    const allRates = response.TaxRates ?? []

    const filtered = allRates.filter(
      (rate) =>
        rate.Status === "ACTIVE" &&
        (rate.CanApplyToRevenue === true || rate.CanApplyToRevenue === undefined)
    )

    const taxRates: TaxRateOption[] = filtered.map(mapXeroTaxRate)

    const hasNone = taxRates.some((r) => r.tax_type === "NONE")
    if (!hasNone) {
      taxRates.unshift({ tax_type: "NONE", name: "No tax", display_rate: "0%" })
    }

    return noStoreJson({ tax_rates: taxRates })
  } catch (error) {
    if (error instanceof XeroAuthError) {
      return noStoreJson({ error: "Xero is not connected. Connect Xero in Settings -> Integrations." }, { status: 400 })
    }
    logWarn("[xero] Fetch tax rates failed", {
      tenantId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return noStoreJson({ error: "Failed to load Xero tax rates" }, { status: 500 })
  }
}
