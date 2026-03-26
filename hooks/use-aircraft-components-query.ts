"use client"

import { useQuery } from "@tanstack/react-query"

import type { AircraftComponentsRow } from "@/lib/types/tables"

export function aircraftComponentsQueryKey(aircraftId: string) {
  return ["aircraft-components", aircraftId] as const
}

export function aircraftComponentDetailQueryKey(componentId: string) {
  return ["aircraft-component", componentId] as const
}

function getAircraftComponentsErrorMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

export async function fetchAircraftComponents(aircraftId: string): Promise<AircraftComponentsRow[]> {
  const response = await fetch(`/api/aircraft-components?aircraft_id=${aircraftId}`, {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const message =
      payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : "Failed to load maintenance items"
    throw new Error(message)
  }

  return (await response.json().catch(() => [])) as AircraftComponentsRow[]
}

export async function fetchAircraftComponent(componentId: string): Promise<AircraftComponentsRow> {
  const response = await fetch(`/api/aircraft-components?id=${encodeURIComponent(componentId)}`, {
    method: "GET",
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => ({}))) as AircraftComponentsRow & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(getAircraftComponentsErrorMessage(payload, "Failed to load maintenance item"))
  }

  return payload
}

export async function createAircraftComponent(
  input: Partial<AircraftComponentsRow> & { aircraft_id: string }
): Promise<AircraftComponentsRow> {
  const response = await fetch("/api/aircraft-components", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as AircraftComponentsRow & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(getAircraftComponentsErrorMessage(payload, "Failed to create maintenance item"))
  }

  return payload
}

export async function updateAircraftComponent(
  input: Partial<AircraftComponentsRow> & { id: string }
): Promise<AircraftComponentsRow> {
  const response = await fetch("/api/aircraft-components", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as AircraftComponentsRow & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(getAircraftComponentsErrorMessage(payload, "Failed to update maintenance item"))
  }

  return payload
}

export function useAircraftComponentsQuery(aircraftId: string, initialComponents?: AircraftComponentsRow[]) {
  return useQuery({
    queryKey: aircraftComponentsQueryKey(aircraftId),
    queryFn: () => fetchAircraftComponents(aircraftId),
    enabled: Boolean(aircraftId),
    initialData: initialComponents?.length ? initialComponents : undefined,
    staleTime: 60 * 1000,
  })
}
