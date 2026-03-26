"use client"

import { useQuery } from "@tanstack/react-query"

import type { InvoiceCreateChargeable } from "@/lib/types/invoice-create"

type ChargeablesQueryParams = {
  includeInactive?: boolean
  type?: string
  excludeTypeCode?: string
  pageSize?: number
}

type ChargeablesResponse = { chargeables: InvoiceCreateChargeable[] }

function buildChargeablesQuery(params: ChargeablesQueryParams) {
  const query = new URLSearchParams()
  if (params.includeInactive) query.set("include_inactive", "true")
  if (params.type) query.set("type", params.type)
  if (params.excludeTypeCode) query.set("exclude_type_code", params.excludeTypeCode)
  if (params.pageSize) query.set("page_size", String(params.pageSize))
  return query.toString()
}

export function chargeablesQueryKey(params: ChargeablesQueryParams) {
  return [
    "chargeables",
    params.includeInactive ? "inactive" : "active",
    params.type ?? "",
    params.excludeTypeCode ?? "",
    params.pageSize ?? 25,
  ] as const
}

export async function fetchChargeablesQuery(params: ChargeablesQueryParams): Promise<InvoiceCreateChargeable[]> {
  const response = await fetch(`/api/chargeables?${buildChargeablesQuery(params)}`, {
    cache: "no-store",
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message =
      data && typeof data === "object" && typeof data.error === "string"
        ? data.error
        : "Failed to load chargeables"
    throw new Error(message)
  }

  const data = (await response.json().catch(() => null)) as ChargeablesResponse | null
  return Array.isArray(data?.chargeables) ? data.chargeables : []
}

export function useChargeablesQuery(params: ChargeablesQueryParams) {
  return useQuery({
    queryKey: chargeablesQueryKey(params),
    queryFn: () => fetchChargeablesQuery(params),
    staleTime: 60 * 1000,
  })
}
