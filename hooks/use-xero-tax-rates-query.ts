"use client"

import { useQuery } from "@tanstack/react-query"

export type XeroTaxRateOption = {
  tax_type: string
  name: string
  display_rate: string | null
}

export function xeroTaxRatesQueryKey() {
  return ["xero", "tax-rates"] as const
}

export async function fetchXeroTaxRates(): Promise<XeroTaxRateOption[]> {
  const response = await fetch("/api/xero/tax-rates", { cache: "no-store" })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? "Failed to load tax rates")
  }
  const data = (await response.json().catch(() => null)) as { tax_rates?: XeroTaxRateOption[] } | null
  return data?.tax_rates ?? []
}

export function useXeroTaxRatesQuery(enabled: boolean) {
  return useQuery({
    queryKey: xeroTaxRatesQueryKey(),
    queryFn: fetchXeroTaxRates,
    staleTime: 60_000,
    enabled,
  })
}
