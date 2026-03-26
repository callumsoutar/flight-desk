"use client"

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"

import type { AircraftType } from "@/lib/types/aircraft"

export const aircraftTypesQueryKey = ["aircraft-types"] as const

function getAircraftTypesErrorMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

export async function fetchAircraftTypes(): Promise<AircraftType[]> {
  const res = await fetch("/api/aircraft-types", { cache: "no-store" })
  if (!res.ok) {
    throw new Error("Failed to load aircraft types")
  }

  const payload = (await res.json().catch(() => ({}))) as { aircraft_types?: AircraftType[] }
  return Array.isArray(payload.aircraft_types) ? payload.aircraft_types : []
}

export async function createAircraftType(input: {
  name: string
  category?: string | null
  description?: string | null
}): Promise<AircraftType> {
  const res = await fetch("/api/aircraft-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await res.json().catch(() => ({}))) as {
    error?: string
    aircraft_type?: AircraftType
  }

  if (!res.ok || !payload.aircraft_type) {
    throw new Error(getAircraftTypesErrorMessage(payload, "Failed to create aircraft type"))
  }

  return payload.aircraft_type
}

function sortAircraftTypes(types: AircraftType[]) {
  return [...types].sort((a, b) => a.name.localeCompare(b.name))
}

export function mergeAircraftTypeIntoCache(queryClient: QueryClient, aircraftType: AircraftType) {
  queryClient.setQueryData<AircraftType[]>(aircraftTypesQueryKey, (current) => {
    const existing = current ?? []
    const withoutMatch = existing.filter((item) => item.id !== aircraftType.id)
    return sortAircraftTypes([...withoutMatch, aircraftType])
  })
}

export function useAircraftTypesQuery(enabled = true) {
  return useQuery({
    queryKey: aircraftTypesQueryKey,
    queryFn: fetchAircraftTypes,
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function useAircraftTypesCache() {
  const queryClient = useQueryClient()

  return {
    mergeAircraftType(aircraftType: AircraftType) {
      mergeAircraftTypeIntoCache(queryClient, aircraftType)
    },
  }
}
