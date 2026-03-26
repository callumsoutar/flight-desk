"use client"

import { useQuery } from "@tanstack/react-query"

import type { FlightTypesRow } from "@/lib/types/tables"

export type FlightType = Pick<
  FlightTypesRow,
  | "id"
  | "name"
  | "description"
  | "instruction_type"
  | "aircraft_gl_code"
  | "instructor_gl_code"
  | "is_active"
  | "is_default_solo"
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
  aircraft_gl_code: string | null
  instructor_gl_code: string | null
  is_active: boolean
}) {
  const response = await fetch("/api/flight-types", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to create flight type"))
  }
}

export async function updateFlightType(input: {
  id: string
  name: string
  description: string
  instruction_type: "dual" | "solo" | "trial"
  aircraft_gl_code: string | null
  instructor_gl_code: string | null
  is_active: boolean
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
