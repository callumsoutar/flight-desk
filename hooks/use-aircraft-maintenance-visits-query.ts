"use client"

import { useQuery } from "@tanstack/react-query"

import type {
  AircraftMaintenanceVisitEntry,
  AircraftMaintenanceVisitsResponse,
} from "@/lib/types/maintenance-history"

export function aircraftMaintenanceVisitsQueryKey(aircraftId: string) {
  return ["aircraft-maintenance-visits", aircraftId] as const
}

export function aircraftMaintenanceVisitDetailQueryKey(maintenanceVisitId: string) {
  return ["aircraft-maintenance-visit", maintenanceVisitId] as const
}

function getMaintenanceVisitErrorMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

export async function fetchAircraftMaintenanceVisits(aircraftId: string): Promise<AircraftMaintenanceVisitEntry[]> {
  const response = await fetch(`/api/maintenance-visits?aircraft_id=${aircraftId}`, {
    method: "GET",
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => ({}))) as Partial<AircraftMaintenanceVisitsResponse> & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(payload.error || "Failed to load maintenance visits")
  }

  return payload.visits ?? []
}

export async function fetchAircraftMaintenanceVisit(maintenanceVisitId: string) {
  const response = await fetch(
    `/api/maintenance-visits?maintenance_visit_id=${encodeURIComponent(maintenanceVisitId)}`,
    {
      method: "GET",
      cache: "no-store",
    }
  )
  const payload = (await response.json().catch(() => ({}))) as AircraftMaintenanceVisitEntry & {
    component?: { id: string; name: string } | null
    error?: string
  }

  if (!response.ok) {
    throw new Error(getMaintenanceVisitErrorMessage(payload, "Failed to load maintenance visit"))
  }

  return payload
}

type MaintenanceVisitMutationInput = {
  aircraft_id: string
  component_id?: string | null
  visit_date: string
  visit_type: string
  description: string
  total_cost?: number | null
  hours_at_visit?: number | null
  notes?: string | null
  date_out_of_maintenance?: string | null
  performed_by?: string | null
  component_due_hours?: number | null
  component_due_date?: string | null
  next_due_hours?: number | null
  next_due_date?: string | null
}

export async function createAircraftMaintenanceVisit(input: MaintenanceVisitMutationInput) {
  const response = await fetch("/api/maintenance-visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as AircraftMaintenanceVisitEntry & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(getMaintenanceVisitErrorMessage(payload, "Failed to log maintenance visit"))
  }

  return payload
}

export async function updateAircraftMaintenanceVisit(
  input: Partial<MaintenanceVisitMutationInput> & { id: string }
) {
  const response = await fetch("/api/maintenance-visits", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as AircraftMaintenanceVisitEntry & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(getMaintenanceVisitErrorMessage(payload, "Failed to update maintenance visit"))
  }

  return payload
}

export function useAircraftMaintenanceVisitsQuery(
  aircraftId: string,
  initialVisits?: AircraftMaintenanceVisitEntry[]
) {
  return useQuery({
    queryKey: aircraftMaintenanceVisitsQueryKey(aircraftId),
    queryFn: () => fetchAircraftMaintenanceVisits(aircraftId),
    enabled: Boolean(aircraftId),
    initialData: initialVisits?.length ? initialVisits : undefined,
    staleTime: 60 * 1000,
  })
}
