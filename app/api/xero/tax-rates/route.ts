import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getXeroClient } from "@/lib/xero/get-xero-client"
import { XeroAuthError } from "@/lib/xero/types"
import type { XeroTaxRate } from "@/lib/xero/types"

export const dynamic = "force-dynamic"

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

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
  if (!isStaff(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

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

    return NextResponse.json(
      { tax_rates: taxRates },
      { headers: { "cache-control": "no-store" } }
    )
  } catch (error) {
    if (error instanceof XeroAuthError) {
      return NextResponse.json(
        { error: "Xero is not connected. Connect Xero in Settings → Integrations." },
        { status: 400 }
      )
    }
    console.warn("[xero] Fetch tax rates failed", {
      tenantId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return NextResponse.json(
      { error: "Failed to load Xero tax rates" },
      { status: 500 }
    )
  }
}
