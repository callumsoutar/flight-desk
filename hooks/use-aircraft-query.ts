"use client"

import type { AircraftWithType } from "@/lib/types/aircraft"

export function aircraftListQueryKey() {
  return ["aircraft", "list"] as const
}

export function aircraftDetailQueryKey(aircraftId: string) {
  return ["aircraft", "detail", aircraftId] as const
}

function getAircraftErrorMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

export async function createAircraft(input: {
  registration: string
  type: string
  model?: string | null
  manufacturer?: string | null
  year_manufactured?: number | null
  aircraft_type_id?: string | null
  total_time_method: string
  current_hobbs: number
  current_tach: number
  on_line: boolean
  prioritise_scheduling: boolean
  record_hobbs: boolean
  record_tacho: boolean
  record_airswitch: boolean
}): Promise<{ id: string }> {
  const response = await fetch("/api/aircraft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    aircraft?: { id?: string }
  }

  const createdAircraftId = payload.aircraft?.id
  if (!response.ok || !createdAircraftId) {
    throw new Error(getAircraftErrorMessage(payload, "Failed to create aircraft"))
  }

  return { id: createdAircraftId }
}

export async function fetchAircraftDetail(aircraftId: string): Promise<AircraftWithType> {
  const response = await fetch(`/api/aircraft/${aircraftId}`, {
    method: "GET",
    cache: "no-store",
  })

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    aircraft?: AircraftWithType
  }

  if (!response.ok || !payload.aircraft) {
    throw new Error(getAircraftErrorMessage(payload, "Failed to load aircraft"))
  }

  return payload.aircraft
}

export async function updateAircraft(
  aircraftId: string,
  input: {
    manufacturer?: string | null
    type?: string | null
    model?: string | null
    year_manufactured?: number | null
    registration?: string
    capacity?: number | null
    on_line?: boolean
    for_ato?: boolean
    prioritise_scheduling?: boolean
    aircraft_image_url?: string | null
    current_tach?: number | null
    current_hobbs?: number | null
    record_tacho?: boolean
    record_hobbs?: boolean
    record_airswitch?: boolean
    fuel_consumption?: number | null
    total_time_method?: string | null
    aircraft_type_id?: string | null
  }
): Promise<AircraftWithType> {
  const response = await fetch(`/api/aircraft/${aircraftId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    aircraft?: AircraftWithType
  }

  if (!response.ok || !payload.aircraft) {
    throw new Error(getAircraftErrorMessage(payload, "Failed to update aircraft"))
  }

  return payload.aircraft
}

export async function reorderAircraft(items: { id: string; order: number }[]) {
  const response = await fetch("/api/aircraft/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })

  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) {
    throw new Error(getAircraftErrorMessage(payload, "Failed to update aircraft order"))
  }
}
