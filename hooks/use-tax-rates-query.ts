"use client"

import { useQuery } from "@tanstack/react-query"

import type { TaxRate } from "@/lib/types/tax-rates"

type TaxRatesResponse = {
  tax_rates?: TaxRate[]
  error?: string
}

export const taxRatesQueryKey = ["tax-rates"] as const

export async function fetchTaxRatesQuery(): Promise<TaxRate[]> {
  const response = await fetch("/api/tax-rates", { cache: "no-store" })
  const data = (await response.json().catch(() => null)) as TaxRatesResponse | null
  if (!response.ok) {
    throw new Error(data?.error ?? "Failed to fetch tax rates")
  }
  return data?.tax_rates ?? []
}

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function setDefaultTaxRate(id: string) {
  const response = await fetch("/api/tax-rates", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, is_default: true }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update tax rate"))
  }
}

export async function createTaxRate(input: {
  tax_name: string
  rate_percent: number
  effective_from?: string
  description?: string
  region_code?: string
  make_default: boolean
}) {
  const response = await fetch("/api/tax-rates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to create tax rate"))
  }
}

export function useTaxRatesQuery() {
  return useQuery({
    queryKey: taxRatesQueryKey,
    queryFn: fetchTaxRatesQuery,
    staleTime: 60 * 1000,
  })
}
