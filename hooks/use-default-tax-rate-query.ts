"use client"

import { useQuery } from "@tanstack/react-query"

export const defaultTaxRateQueryKey = ["default-tax-rate"] as const

export async function fetchDefaultTaxRate(): Promise<number> {
  try {
    const response = await fetch("/api/tax-rates?is_default=true", { cache: "no-store" })
    if (!response.ok) return 0.15
    const data = (await response.json().catch(() => null)) as { tax_rates?: unknown } | null
    const first = Array.isArray(data?.tax_rates)
      ? (data?.tax_rates[0] as { rate?: unknown } | undefined)
      : undefined
    return typeof first?.rate === "number" && Number.isFinite(first.rate) ? first.rate : 0.15
  } catch {
    return 0.15
  }
}

export function useDefaultTaxRateQuery() {
  return useQuery({
    queryKey: defaultTaxRateQueryKey,
    queryFn: fetchDefaultTaxRate,
    staleTime: 5 * 60 * 1000,
  })
}
