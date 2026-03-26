"use client"

import { useQuery } from "@tanstack/react-query"

import type { ChargeablesRow, LandingFeeRatesRow } from "@/lib/types/tables"

export type LandingFeeRate = Pick<LandingFeeRatesRow, "id" | "chargeable_id" | "aircraft_type_id" | "rate">

export type LandingFee = Pick<
  ChargeablesRow,
  "id" | "name" | "description" | "rate" | "is_taxable" | "is_active" | "updated_at"
> & {
  landing_fee_rates: LandingFeeRate[]
}

type LandingFeesQueryParams = {
  includeInactive?: boolean
}

type LandingFeesResponse = {
  landing_fees?: LandingFee[]
}

function buildLandingFeesQuery(params: LandingFeesQueryParams) {
  const query = new URLSearchParams()
  if (params.includeInactive) query.set("include_inactive", "true")
  return query.toString()
}

export function landingFeesQueryKey(params: LandingFeesQueryParams) {
  return ["landing-fees", params.includeInactive ? "inactive" : "active"] as const
}

export async function fetchLandingFeesQuery(params: LandingFeesQueryParams): Promise<LandingFee[]> {
  const response = await fetch(`/api/landing-fees?${buildLandingFeesQuery(params)}`, {
    cache: "no-store",
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message =
      data && typeof data === "object" && typeof data.error === "string"
        ? data.error
        : "Failed to load landing fees"
    throw new Error(message)
  }

  const data = (await response.json().catch(() => null)) as LandingFeesResponse | null
  return Array.isArray(data?.landing_fees) ? data.landing_fees : []
}

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function createLandingFee(input: {
  name: string
  description: string
  is_taxable: boolean
  is_active: boolean
  rate: number
}) {
  const response = await fetch("/api/landing-fees", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to create landing fee"))
  }
  const payload = (await response.json().catch(() => null)) as { landing_fee?: LandingFee } | null
  if (!payload?.landing_fee?.id) {
    throw new Error("Landing fee was created but could not be loaded.")
  }
  return payload.landing_fee
}

export async function updateLandingFee(input: {
  id: string
  name: string
  description: string
  is_taxable: boolean
  is_active: boolean
  rate: number
}) {
  const response = await fetch("/api/landing-fees", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update landing fee"))
  }
}

export async function deactivateLandingFee(id: string) {
  const response = await fetch(`/api/landing-fees?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to deactivate landing fee"))
  }
}

export async function createLandingFeeRate(input: {
  chargeable_id: string
  aircraft_type_id: string
  rate: number
}) {
  const response = await fetch("/api/landing-fee-rates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to save landing fee rates"))
  }
}

export async function updateLandingFeeRate(input: {
  chargeable_id: string
  aircraft_type_id: string
  rate: number
}) {
  const response = await fetch("/api/landing-fee-rates", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to save landing fee rates"))
  }
}

export async function deleteLandingFeeRate(chargeableId: string, aircraftTypeId: string) {
  const response = await fetch(
    `/api/landing-fee-rates?chargeable_id=${encodeURIComponent(chargeableId)}&aircraft_type_id=${encodeURIComponent(aircraftTypeId)}`,
    { method: "DELETE" }
  )
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to save landing fee rates"))
  }
}

export function useLandingFeesQuery(params: LandingFeesQueryParams) {
  return useQuery({
    queryKey: landingFeesQueryKey(params),
    queryFn: () => fetchLandingFeesQuery(params),
    staleTime: 60 * 1000,
  })
}
