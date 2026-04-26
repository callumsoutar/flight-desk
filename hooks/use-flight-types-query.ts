"use client"

import { useQuery } from "@tanstack/react-query"

import type { FlightTypesRow } from "@/lib/types/tables"

export type FlightType = Pick<
  FlightTypesRow,
  | "id"
  | "name"
  | "description"
  | "instruction_type"
  | "billing_mode"
  | "duration_minutes"
  | "fixed_package_price"
  | "aircraft_gl_code"
  | "instructor_gl_code"
  | "is_active"
  | "is_default_solo"
  | "is_revenue"
  | "updated_at"
>

type FlightTypesQueryParams = {
  includeInactive?: boolean
}

type FlightTypesResponse = {
  flight_types?: FlightType[]
}

function buildFlightTypesQuery(params: FlightTypesQueryParams) {
  const query = new URLSearchParams()
  if (params.includeInactive) query.set("include_inactive", "true")
  return query.toString()
}

export function flightTypesQueryKey(params: FlightTypesQueryParams) {
  return ["flight-types", params.includeInactive ? "inactive" : "active"] as const
}

export async function fetchFlightTypesQuery(params: FlightTypesQueryParams): Promise<FlightType[]> {
  const response = await fetch(`/api/flight-types?${buildFlightTypesQuery(params)}`, {
    cache: "no-store",
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message =
      data && typeof data === "object" && typeof data.error === "string"
        ? data.error
        : "Failed to load flight types"
    throw new Error(message)
  }

  const data = (await response.json().catch(() => null)) as FlightTypesResponse | null
  return Array.isArray(data?.flight_types) ? data.flight_types : []
}

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function createFlightType(input: {
  name: string
  description: string
  instruction_type: "dual" | "solo" | "trial"
  billing_mode?: "hourly" | "fixed_package"
  duration_minutes?: number | null
  fixed_package_price?: number | null
  aircraft_gl_code: string | null
  instructor_gl_code: string | null
  is_active: boolean
  is_revenue: boolean
}): Promise<{ id: string }> {
  const response = await fetch("/api/flight-types", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to create flight type"))
  }
  const payload = (await response.json().catch(() => null)) as { id?: string } | null
  return { id: payload?.id ?? "" }
}

export async function updateFlightType(input: {
  id: string
  name: string
  description: string
  instruction_type: "dual" | "solo" | "trial"
  billing_mode?: "hourly" | "fixed_package"
  duration_minutes?: number | null
  fixed_package_price?: number | null
  aircraft_gl_code: string | null
  instructor_gl_code: string | null
  is_active: boolean
  is_revenue: boolean
}) {
  const response = await fetch("/api/flight-types", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to update flight type"))
  }
}

export type DuplicateFlightTypeResult = {
  id: string
  aircraft_rates_copied: number
  instructor_rates_copied: number
}

export async function duplicateFlightType(input: {
  source_id: string
  name: string
  copy_aircraft_rates?: boolean
  copy_instructor_rates?: boolean
}): Promise<DuplicateFlightTypeResult> {
  const response = await fetch("/api/flight-types/duplicate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to duplicate flight type"))
  }
  const payload = (await response.json().catch(() => null)) as DuplicateFlightTypeResult | null
  return {
    id: payload?.id ?? "",
    aircraft_rates_copied: payload?.aircraft_rates_copied ?? 0,
    instructor_rates_copied: payload?.instructor_rates_copied ?? 0,
  }
}

export async function deactivateFlightType(id: string) {
  const response = await fetch(`/api/flight-types?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to deactivate flight type"))
  }
}

export function useFlightTypesQuery(params: FlightTypesQueryParams) {
  return useQuery({
    queryKey: flightTypesQueryKey(params),
    queryFn: () => fetchFlightTypesQuery(params),
    staleTime: 60 * 1000,
  })
}

export type FlightTypeBillingSummary = {
  flight_type_id: string
  aircraft_total: number
  aircraft_priced: number
  min_price: number | null
  max_price: number | null
}

export const flightTypesBillingSummaryKey = ["flight-types", "billing-summary"] as const

async function fetchFlightTypesBillingSummary(): Promise<FlightTypeBillingSummary[]> {
  const response = await fetch("/api/flight-types/billing-summary", { cache: "no-store" })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to load billing summary"))
  }
  const data = (await response.json().catch(() => null)) as { summaries?: FlightTypeBillingSummary[] } | null
  return Array.isArray(data?.summaries) ? data.summaries : []
}

export function useFlightTypesBillingSummaryQuery() {
  return useQuery({
    queryKey: flightTypesBillingSummaryKey,
    queryFn: fetchFlightTypesBillingSummary,
    staleTime: 30 * 1000,
  })
}
