"use client"

import { useQuery } from "@tanstack/react-query"

import type { ObservationWithUser, ObservationWithUsers } from "@/lib/types/observations"

export function aircraftObservationsQueryKey(aircraftId: string) {
  return ["aircraft-observations", aircraftId] as const
}

export function aircraftObservationDetailQueryKey(observationId: string) {
  return ["aircraft-observation", observationId] as const
}

function getObservationErrorMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

export async function fetchAircraftObservations(aircraftId: string): Promise<ObservationWithUsers[]> {
  const response = await fetch(`/api/observations?aircraft_id=${encodeURIComponent(aircraftId)}`, {
    method: "GET",
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => [])) as ObservationWithUsers[] | { error?: string }

  if (!response.ok) {
    throw new Error(getObservationErrorMessage(payload, "Failed to load observations"))
  }

  return Array.isArray(payload) ? payload : []
}

export async function fetchAircraftObservation(observationId: string): Promise<ObservationWithUser> {
  const response = await fetch(`/api/observations?id=${encodeURIComponent(observationId)}`, {
    method: "GET",
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => ({}))) as ObservationWithUser & { error?: string }

  if (!response.ok) {
    throw new Error(getObservationErrorMessage(payload, "Failed to fetch observation"))
  }

  return payload
}

export async function createAircraftObservation(input: {
  aircraft_id: string
  name: string
  description?: string | null
  priority?: "low" | "medium" | "high"
  stage?: "open" | "investigation" | "resolution" | "closed"
}) {
  const response = await fetch("/api/observations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as ObservationWithUsers & { error?: string }

  if (!response.ok) {
    throw new Error(getObservationErrorMessage(payload, "Failed to create observation"))
  }

  return payload
}

export async function updateAircraftObservation(input: {
  id: string
  name?: string
  description?: string | null
  priority?: "low" | "medium" | "high"
  stage?: "open" | "investigation" | "resolution" | "closed"
  resolution_comments?: string | null
  resolved_at?: string | null
}) {
  const response = await fetch("/api/observations", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as ObservationWithUser & { error?: string }

  if (!response.ok) {
    throw new Error(getObservationErrorMessage(payload, "Failed to update observation"))
  }

  return payload
}

export function useAircraftObservationsQuery(aircraftId: string, initialData: ObservationWithUsers[]) {
  return useQuery({
    queryKey: aircraftObservationsQueryKey(aircraftId),
    queryFn: () => fetchAircraftObservations(aircraftId),
    enabled: Boolean(aircraftId),
    initialData,
    staleTime: 60 * 1000,
  })
}

export function useAircraftObservationQuery(observationId: string, enabled = true) {
  return useQuery({
    queryKey: aircraftObservationDetailQueryKey(observationId),
    queryFn: () => fetchAircraftObservation(observationId),
    enabled: enabled && Boolean(observationId),
    staleTime: 30 * 1000,
  })
}
