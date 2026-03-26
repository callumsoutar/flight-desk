"use client"

import { useQuery } from "@tanstack/react-query"

import type { ChargeablesRow, ChargeableTypesRow } from "@/lib/types/tables"

type ChargeableTypeLite = Pick<ChargeableTypesRow, "id" | "code" | "name" | "gl_code">

export type ChargeableAdmin = Pick<
  ChargeablesRow,
  | "id"
  | "name"
  | "description"
  | "rate"
  | "is_taxable"
  | "is_active"
  | "chargeable_type_id"
  | "updated_at"
> & {
  chargeable_type: ChargeableTypeLite | null
}

type ChargeablesAdminQueryParams = {
  includeInactive?: boolean
  excludeTypeCode?: string
  page: number
  pageSize: number
  searchTerm?: string
  filterTypeId?: string
}

export type ChargeablesAdminResponse = {
  chargeables: ChargeableAdmin[]
  total: number
  page: number
  pageSize: number
}

export const chargeablesAdminBaseQueryKey = ["chargeables-admin"] as const

function buildChargeablesAdminQuery(params: ChargeablesAdminQueryParams) {
  const query = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  })
  if (params.includeInactive) query.set("include_inactive", "true")
  if (params.excludeTypeCode) query.set("exclude_type_code", params.excludeTypeCode)
  if (params.searchTerm?.trim()) query.set("search", params.searchTerm.trim())
  if (params.filterTypeId && params.filterTypeId !== "all") query.set("type_id", params.filterTypeId)
  return query.toString()
}

export function chargeablesAdminQueryKey(params: ChargeablesAdminQueryParams) {
  return [
    ...chargeablesAdminBaseQueryKey,
    params.includeInactive ? "inactive" : "active",
    params.excludeTypeCode ?? "",
    params.page,
    params.pageSize,
    params.searchTerm?.trim() ?? "",
    params.filterTypeId ?? "all",
  ] as const
}

export async function fetchChargeablesAdminQuery(
  params: ChargeablesAdminQueryParams
): Promise<ChargeablesAdminResponse> {
  const response = await fetch(`/api/chargeables?${buildChargeablesAdminQuery(params)}`, {
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

  const data = (await response.json().catch(() => null)) as {
    chargeables?: unknown
    total?: unknown
    page?: unknown
    page_size?: unknown
  } | null

  return {
    chargeables: Array.isArray(data?.chargeables) ? (data.chargeables as ChargeableAdmin[]) : [],
    total: typeof data?.total === "number" && Number.isFinite(data.total) ? data.total : 0,
    page: typeof data?.page === "number" && Number.isFinite(data.page) ? data.page : params.page,
    pageSize:
      typeof data?.page_size === "number" && Number.isFinite(data.page_size) ? data.page_size : params.pageSize,
  }
}

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function createChargeable(input: {
  name: string
  description: string
  chargeable_type_id: string
  is_taxable: boolean
  is_active: boolean
  rate: number
  xero_tax_type: string | null
}) {
  const response = await fetch("/api/chargeables", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to create chargeable"))
  }
}

export async function updateChargeable(input: {
  id: string
  name: string
  description: string
  chargeable_type_id: string
  is_taxable: boolean
  is_active: boolean
  rate: number
  xero_tax_type: string | null
}) {
  const response = await fetch("/api/chargeables", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update chargeable"))
  }
}

export async function deactivateChargeable(id: string) {
  const response = await fetch(`/api/chargeables?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to deactivate chargeable"))
  }
}

export function useChargeablesAdminQuery(params: ChargeablesAdminQueryParams) {
  return useQuery({
    queryKey: chargeablesAdminQueryKey(params),
    queryFn: () => fetchChargeablesAdminQuery(params),
    staleTime: 60 * 1000,
  })
}
